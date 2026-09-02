import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { weeklyMenus } from '../db/schema'
import { authMiddleware, adminMiddleware } from '../middleware/auth'
import { callAI, AIError } from '../lib/ai'
import { createDB, beijingNow } from '../lib/db'
import type { Env } from '../types'

export const menuRoutes = new Hono<Env>()
menuRoutes.use('*', authMiddleware)

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const MENU_CATEGORIES = ['主荤', '半荤', '素菜', '杂粮', '主食', '汤粥']
const MEAL_KEYS = ['午餐', '水果', '晚餐']

// 前端（MenuManager.vue / LifeProgress.vue）按上面这套键名硬编码渲染，放行未知键也不会显示，
// 所以模型输出的近义变体必须在这里归一化。归错桶只是分类偏移，静默丢弃则是内容凭空消失。
const MEAL_ALIASES: Record<string, string> = {
  '中餐': '午餐', '午饭': '午餐', '中饭': '午餐',
  '晚饭': '晚餐', '夜餐': '晚餐',
  '水果类': '水果', '果盘': '水果',
}
const CATEGORY_ALIASES: Record<string, string> = {
  '荤菜': '主荤', '大荤': '主荤', '主荤菜': '主荤', '硬菜': '主荤',
  '小荤': '半荤', '半荤菜': '半荤',
  '素': '素菜', '蔬菜': '素菜', '青菜': '素菜', '素菜类': '素菜',
  '粗粮': '杂粮', '五谷': '杂粮', '杂粮类': '杂粮',
  '主食类': '主食', '面点': '主食', '米饭': '主食',
  '汤': '汤粥', '汤类': '汤粥', '粥': '汤粥', '汤羹': '汤粥', '例汤': '汤粥',
}
const WEEKDAY_INDEX: Record<string, number> = {
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7, '天': 7,
  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
}

function canonicalMeal(raw: string): string | null {
  const key = String(raw).trim()
  if (MEAL_KEYS.includes(key)) return key
  return MEAL_ALIASES[key] || null
}

function canonicalCategory(raw: string): string | null {
  const key = String(raw).trim()
  if (MENU_CATEGORIES.includes(key)) return key
  return CATEGORY_ALIASES[key] || null
}

// 兼容「周一 / 星期一 / 礼拜一 / 周1 / 周天」等写法
function canonicalWeekday(raw: string): string | null {
  const key = String(raw).trim()
  if (WEEKDAYS.includes(key)) return key
  const matched = key.match(/^(?:周|星期|礼拜)?\s*([一二三四五六日天1-7])$/)
  if (!matched) return null
  return WEEKDAYS[WEEKDAY_INDEX[matched[1]] - 1]
}

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
11. 所有键名必须逐字使用上面列出的名称，不得改写或用近义词（"荤菜""星期一"都算错）
12. 按图片的行列逐格核对，不要跳行，也不要把相邻两天的菜串位

输出示例：
{
  "午餐": { "周二": { "主荤": [], "半荤": [], "素菜": [], "杂粮": [], "主食": [], "汤粥": [] } },
  "水果": { "周二": [] },
  "晚餐": { "周二": { "主荤": [], "半荤": [], "素菜": [], "杂粮": [], "主食": [], "汤粥": [] } }
}`

function getWeekStart(target?: Date): string {
  const d = target || beijingNow()
  const day = d.getUTCDay()
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d)
  monday.setUTCDate(diff)
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

function toItemArray(raw: unknown): string[] {
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : []
  return arr.map(i => String(i).trim()).filter(Boolean)
}

function normalizeDayMenu(payload: Record<string, unknown>, path: string, dropped: string[]) {
  const normalized: Record<string, string[]> = {}
  for (const category of MENU_CATEGORIES) normalized[category] = []

  for (const [rawKey, rawValue] of Object.entries(payload || {})) {
    const category = canonicalCategory(rawKey)
    if (!category) {
      dropped.push(`${path}.${rawKey}`)
      continue
    }
    // 用 push 而非赋值：'荤菜' 和 '主荤' 同时出现时合并而不是互相覆盖
    normalized[category].push(...toItemArray(rawValue))
  }
  return normalized
}

function normalizeMenuPayload(payload: Record<string, unknown>) {
  if (typeof payload !== 'object' || !payload) throw new Error('菜单 JSON 必须是对象')

  const normalized: Record<string, Record<string, unknown>> = { '午餐': {}, '水果': {}, '晚餐': {} }
  const dropped: string[] = []

  for (const [rawMeal, rawDays] of Object.entries(payload)) {
    const meal = canonicalMeal(rawMeal)
    if (!meal) {
      dropped.push(rawMeal)
      continue
    }
    for (const [rawDay, dayValue] of Object.entries((rawDays || {}) as Record<string, unknown>)) {
      const weekday = canonicalWeekday(rawDay)
      if (!weekday) {
        dropped.push(`${meal}.${rawDay}`)
        continue
      }
      normalized[meal][weekday] = meal === '水果'
        ? toItemArray(dayValue)
        : normalizeDayMenu((dayValue || {}) as Record<string, unknown>, `${meal}.${weekday}`, dropped)
    }
  }

  // 归一化兜不住的键会连带内容一起消失，必须留痕，否则表现为「识别内容不对」且无从查起
  if (dropped.length) {
    console.warn('menu: 无法归类的键，内容已丢弃:', JSON.stringify(dropped.slice(0, 30)))
  }
  return normalized
}

function getTodayMenuEntry(menuData: Record<string, Record<string, unknown>>) {
  const now = beijingNow()
  const dayIndex = (now.getUTCDay() + 6) % 7
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
  const { query } = createDB(c.env.DB, 'menu')
  const menus = await query('list menus', (db) =>
    db.select().from(weeklyMenus).orderBy(desc(weeklyMenus.week_start)).limit(20)
  )
  return c.json({ items: menus.map(menuToDict) })
})

// GET /today
menuRoutes.get('/today', async (c) => {
  const { query } = createDB(c.env.DB, 'menu')
  const weekStart = getWeekStart()
  const now = beijingNow()
  const dayIndex = (now.getUTCDay() + 6) % 7
  const weekdayKey = WEEKDAYS[dayIndex]

  const [menu] = await query('get this week menu', (db) =>
    db.select().from(weeklyMenus).where(eq(weeklyMenus.week_start, weekStart)).limit(1)
  )

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

  const bytes = new Uint8Array(imageBytes)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  }
  const base64 = btoa(binary)
  const dataUrl = `data:${image.type};base64,${base64}`

  let content: string
  try {
    content = await callAI(c.env, [
      { role: 'system', content: MENU_SYSTEM_PROMPT },
      {
        role: 'user',
        // 指令在前、图片在后（对齐官方 vision 示例的顺序）
        content: [
          { type: 'text', text: MENU_USER_PROMPT },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
      // direct=true：视觉识别走灰云直连，绕过橙云 ~100s 边缘超时（同占卜生图修复）
      // 16000：整周菜单 JSON 本身就近 2000 token，再叠加密集表格 OCR 的推理开销，给足余量避免截断
      // reasoning_effort=high：密集表格 OCR 的精度旋钮，默认档位下容易看串行列
    ], { max_completion_tokens: 16000, direct: true, reasoning_effort: 'high' })
  } catch (e) {
    const detail = e instanceof AIError ? (e.detail || e.message) : String(e)
    console.error('menu recognize failed:', detail)
    return c.json({ error: '菜单识别失败，请检查模型配置或稍后重试', detail: String(detail).slice(0, 200) }, 503)
  }

  // 原始输出落日志：下游 normalize 是白名单归一化，键名兜不住就会丢内容。
  // 没有这行就无法区分「模型认错了」和「代码吃掉了」，两者的修法完全不同。
  console.log('menu raw AI output:', content.slice(0, 3000))

  if (!content) {
    return c.json({ error: '菜单识别失败：AI 返回为空，请稍后重试' }, 503)
  }

  let menuPayload: Record<string, Record<string, unknown>>
  try {
    const cleaned = stripCodeFences(content)
    const parsed = JSON.parse(cleaned)
    menuPayload = normalizeMenuPayload(parsed)
  } catch {
    return c.json({ error: '菜单识别结果格式无效，请重新上传更清晰的图片' }, 422)
  }

  const { query } = createDB(c.env.DB, 'menu')
  const admin = c.get('user')
  const menuJson = JSON.stringify(menuPayload)
  const nowStr = beijingNow().toISOString().replace('T', ' ').slice(0, 19)

  const [existing] = await query('check existing menu', (db) =>
    db.select().from(weeklyMenus).where(eq(weeklyMenus.week_start, normalizedWeekStart)).limit(1)
  )

  let record: typeof weeklyMenus.$inferSelect
  if (existing) {
    await query('update menu', (db) =>
      db.update(weeklyMenus).set({
        menu_json: menuJson,
        uploaded_by: admin.id,
        updated_at: nowStr,
      }).where(eq(weeklyMenus.id, existing.id))
    )
    ;[record] = await query('get updated menu', (db) =>
      db.select().from(weeklyMenus).where(eq(weeklyMenus.id, existing.id)).limit(1)
    )
  } else {
    ;[record] = await query('create menu', (db) =>
      db.insert(weeklyMenus).values({
        week_start: normalizedWeekStart,
        menu_json: menuJson,
        uploaded_by: admin.id,
      }).returning()
    )
  }

  return c.json({
    success: true,
    data: {
      ...menuToDict(record),
      today: getTodayMenuEntry(menuPayload),
    },
  })
})
