import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq, desc } from 'drizzle-orm'
import { weeklyMenus } from '../db/schema'
import { authMiddleware, adminMiddleware } from '../middleware/auth'
import { callAI } from '../lib/ai'
import type { Env } from '../types'

export const menuRoutes = new Hono<Env>()
menuRoutes.use('*', authMiddleware)

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const MENU_CATEGORIES = ['主荤', '半荤', '素菜', '杂粮', '主食', '汤粥']
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_IMAGE_SIZE = 10 * 1024 * 1024

const MENU_SYSTEM_PROMPT = '你是一个菜单信息提取助手。你的任务是从公司每周菜单图片中提取结构化数据。只返回严格 JSON，不要 Markdown，不要解释，不要代码块。'

const MENU_USER_PROMPT = `请识别这张公司每周菜单图片，并返回严格 JSON。

要求：
1. 顶层只能有："午餐"、"水果"、"晚餐"
2. 日期键只能是："周一"、"周二"、"周三"、"周四"、"周五"、"周六"、"周日"
3. 周一到周日可能缺失若干天，这是正常情况，缺失的日期不要输出
4. 午餐和晚餐下，每一天只能有："主荤"、"半荤"、"素菜"、"杂粮"、"主食"、"汤粥"
5. 上述分类的值都必须是字符串数组
6. 水果下每一天的值也必须是字符串数组
7. 如果某个分类没有内容，返回空数组 []
8. 保留菜名中的备注，例如"（含猪）""（辣）"
9. 不要补充图片里没有的信息
10. 最终输出必须能被 JSON.parse 直接解析

输出示例：
{
  "午餐": { "周二": { "主荤": [], "半荤": [], "素菜": [], "杂粮": [], "主食": [], "汤粥": [] } },
  "水果": { "周二": [] },
  "晚餐": { "周二": { "主荤": [], "半荤": [], "素菜": [], "杂粮": [], "主食": [], "汤粥": [] } }
}`

function getWeekStart(target?: Date): string {
  const d = target || new Date()
  const day = d.getDay() // 0=Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
  const monday = new Date(d)
  monday.setDate(diff)
  return monday.toISOString().slice(0, 10)
}

function stripCodeFences(content: string): string {
  let cleaned = content.trim()
  if (cleaned.includes('```json')) {
    cleaned = cleaned.split('```json')[1].split('```')[0].trim()
  } else if (cleaned.includes('```')) {
    cleaned = cleaned.split('```')[1].split('```')[0].trim()
  }
  return cleaned
}

function normalizeDayMenu(payload: Record<string, unknown>) {
  const normalized: Record<string, string[]> = {}
  for (const category of MENU_CATEGORIES) {
    let rawItems = payload[category]
    if (!Array.isArray(rawItems)) {
      rawItems = rawItems ? [rawItems] : []
    }
    normalized[category] = (rawItems as unknown[]).map(i => String(i).trim()).filter(Boolean)
  }
  return normalized
}

function normalizeMenuPayload(payload: Record<string, unknown>) {
  if (typeof payload !== 'object' || !payload) throw new Error('菜单 JSON 必须是对象')

  const normalized: Record<string, Record<string, unknown>> = { '午餐': {}, '水果': {}, '晚餐': {} }

  for (const mealKey of ['午餐', '晚餐'] as const) {
    const mealPayload = (payload[mealKey] || {}) as Record<string, Record<string, unknown>>
    for (const [weekday, dayMenu] of Object.entries(mealPayload)) {
      if (!WEEKDAYS.includes(weekday)) continue
      normalized[mealKey][weekday] = normalizeDayMenu(dayMenu || {})
    }
  }

  const fruitPayload = (payload['水果'] || {}) as Record<string, unknown>
  for (const [weekday, items] of Object.entries(fruitPayload)) {
    if (!WEEKDAYS.includes(weekday)) continue
    const arr = Array.isArray(items) ? items : items ? [items] : []
    normalized['水果'][weekday] = arr.map((i: unknown) => String(i).trim()).filter(Boolean)
  }

  return normalized
}

function getTodayMenuEntry(menuData: Record<string, Record<string, unknown>>) {
  const now = new Date()
  const dayIndex = (now.getDay() + 6) % 7 // Monday=0
  const weekdayKey = WEEKDAYS[dayIndex]
  return {
    weekday: weekdayKey,
    lunch: (menuData['午餐'] || {})[weekdayKey] || null,
    fruit: (menuData['水果'] || {})[weekdayKey] || [],
    dinner: (menuData['晚餐'] || {})[weekdayKey] || null,
  }
}

function menuToDict(m: typeof weeklyMenus.$inferSelect) {
  const menu = JSON.parse(m.menu_json)
  return { id: m.id, week_start: m.week_start, menu, uploaded_by: m.uploaded_by, created_at: m.created_at, updated_at: m.updated_at }
}

// GET /list
menuRoutes.get('/list', async (c) => {
  const db = drizzle(c.env.DB)
  const menus = await db.select().from(weeklyMenus).orderBy(desc(weeklyMenus.week_start)).limit(20)
  return c.json({ items: menus.map(menuToDict) })
})

// GET /today
menuRoutes.get('/today', async (c) => {
  const db = drizzle(c.env.DB)
  const weekStart = getWeekStart()
  const now = new Date()
  const dayIndex = (now.getDay() + 6) % 7
  const weekdayKey = WEEKDAYS[dayIndex]

  const [menu] = await db.select().from(weeklyMenus).where(eq(weeklyMenus.week_start, weekStart)).limit(1)

  if (!menu) {
    return c.json({
      week_start: weekStart,
      weekday: weekdayKey,
      lunch: null,
      fruit: [],
      dinner: null,
      available: false,
    })
  }

  const menuData = JSON.parse(menu.menu_json)
  const todayEntry = getTodayMenuEntry(menuData)
  return c.json({
    week_start: weekStart,
    uploaded_at: menu.updated_at || null,
    available: !!(todayEntry.lunch || (todayEntry.fruit as unknown[]).length || todayEntry.dinner),
    ...todayEntry,
  })
})

// POST /upload (admin only, multipart)
menuRoutes.post('/upload', adminMiddleware, async (c) => {
  const formData = await c.req.formData()
  const image = formData.get('image') as File | null
  const weekStartStr = formData.get('week_start') as string | null

  if (!image || !(image instanceof File)) {
    return c.json({ error: '请上传图片' }, 400)
  }
  if (!ALLOWED_TYPES.has(image.type)) {
    return c.json({ error: '仅支持 jpg/png/webp 图片' }, 400)
  }

  let normalizedWeekStart: string
  try {
    if (weekStartStr) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartStr)) throw new Error('week_start 格式必须为 YYYY-MM-DD')
      normalizedWeekStart = getWeekStart(new Date(weekStartStr))
    } else {
      normalizedWeekStart = getWeekStart()
    }
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400)
  }

  const imageBytes = await image.arrayBuffer()
  if (!imageBytes.byteLength) {
    return c.json({ error: '图片不能为空' }, 400)
  }
  if (imageBytes.byteLength > MAX_IMAGE_SIZE) {
    return c.json({ error: '图片大小不能超过 10MB' }, 400)
  }

  // Base64 encode for vision API
  const base64 = btoa(String.fromCharCode(...new Uint8Array(imageBytes)))
  const dataUrl = `data:${image.type};base64,${base64}`

  let content: string
  try {
    content = await callAI(c.env, [
      { role: 'system', content: MENU_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: MENU_USER_PROMPT },
        ],
      },
    ], { temperature: 0, max_tokens: 2200 })
  } catch {
    return c.json({ error: '菜单识别失败，请检查模型配置或稍后重试' }, 503)
  }

  if (!content) {
    return c.json({ error: '菜单识别失败，请检查模型配置或稍后重试' }, 503)
  }

  let menuPayload: Record<string, Record<string, unknown>>
  try {
    const cleaned = stripCodeFences(content)
    const parsed = JSON.parse(cleaned)
    menuPayload = normalizeMenuPayload(parsed)
  } catch {
    return c.json({ error: '菜单识别结果格式无效，请重新上传更清晰的图片' }, 422)
  }

  const db = drizzle(c.env.DB)
  const admin = c.get('user')
  const menuJson = JSON.stringify(menuPayload)
  const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19)

  const [existing] = await db.select().from(weeklyMenus).where(eq(weeklyMenus.week_start, normalizedWeekStart)).limit(1)

  let record: typeof weeklyMenus.$inferSelect
  if (existing) {
    await db.update(weeklyMenus).set({
      menu_json: menuJson,
      uploaded_by: admin.id,
      updated_at: nowStr,
    }).where(eq(weeklyMenus.id, existing.id))
    ;[record] = await db.select().from(weeklyMenus).where(eq(weeklyMenus.id, existing.id)).limit(1)
  } else {
    ;[record] = await db.insert(weeklyMenus).values({
      week_start: normalizedWeekStart,
      menu_json: menuJson,
      uploaded_by: admin.id,
    }).returning()
  }

  return c.json({
    success: true,
    data: {
      ...menuToDict(record),
      today: getTodayMenuEntry(menuPayload),
    },
  })
})
