import { Hono } from 'hono'
import { eq, and, sql, asc } from 'drizzle-orm'
import { bmiProfiles, weightRecords } from '../db/schema'
import { authMiddleware } from '../middleware/auth'
import { callAI } from '../lib/ai'
import { createDB, beijingDate, beijingDatetime } from '../lib/db'
import type { Env } from '../types'

export const bmiRoutes = new Hono<Env>()

const MAX_ITEM_CHARS = 20

function buildBmiPrompt(age: number, height: number, weight: number, bmi: number): string {
  return (
    '你是一位健康管理助手。根据以下数据给出3条最重要的健康建议，聚焦饮食、运动、作息。\n' +
    `年龄: ${age} 岁，身高: ${height} cm，体重: ${weight} kg，BMI: ${bmi}。\n` +
    '要求：\n' +
    '1) 只返回严格 JSON：{"advice":["...","...","..."]}\n' +
    '2) 每条建议不超过20个中文字符，总字符数不超过80\n' +
    '3) 不要输出任何多余文本或 Markdown'
  )
}

function fallbackAdvice(bmi: number): string[] {
  if (bmi < 18.5) return ['提高优质蛋白摄入', '每周 2-3 次力量训练', '规律作息保持恢复']
  if (bmi <= 23.9) return ['保持均衡饮食', '每周 150 分钟运动', '定期记录体重变化']
  if (bmi <= 27.9) return ['减少高糖高油食物', '增加日常步行', '每周 2-3 次有氧']
  return ['控制总热量摄入', '循序渐进提高活动量', '必要时咨询专业意见']
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

function extractAdvice(content: string | null, fallback: string[]): string[] {
  if (!content) return fallback
  const cleaned = stripCodeFences(content)
  try {
    const payload = JSON.parse(cleaned)
    const advice = payload.advice ?? payload
    if (Array.isArray(advice)) {
      const items = advice.map((a: unknown) => String(a).trim()).filter(Boolean).map(s => s.slice(0, MAX_ITEM_CHARS))
      if (items.length >= 3) return items.slice(0, 3)
      for (const f of fallback) {
        if (items.length >= 3) break
        if (!items.includes(f)) items.push(f.slice(0, MAX_ITEM_CHARS))
      }
      return items.slice(0, 3)
    }
  } catch { /* ignore */ }
  return fallback
}

// POST /advice (no auth required)
bmiRoutes.post('/advice', async (c) => {
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, error: '参数格式错误' }, 400)
  }

  const age = Number(body.age || 0)
  const height = Number(body.height || 0)
  const weight = Number(body.weight || 0)
  let bmi = Number(body.bmi || 0)

  if (isNaN(age) || isNaN(height) || isNaN(weight)) {
    return c.json({ success: false, error: '参数格式错误' }, 400)
  }
  if (age <= 0 || height <= 0 || weight <= 0) {
    return c.json({ success: false, error: '参数缺失' }, 400)
  }

  const heightM = height / 100
  const calculatedBmi = Math.round(weight / (heightM * heightM) * 10) / 10
  bmi = bmi > 0 ? Math.round(bmi * 10) / 10 : calculatedBmi

  const fallback = fallbackAdvice(bmi)
  const prompt = buildBmiPrompt(age, height, weight, bmi)

  let advice: string[]
  try {
    const content = await callAI(c.env, [
      { role: 'system', content: '你是一位简洁的健康管理助手，输出必须是纯 JSON。' },
      { role: 'user', content: prompt },
    ], { temperature: 0.5, max_tokens: 120 })
    advice = extractAdvice(content, fallback)
  } catch {
    advice = fallback
  }

  return c.json({ success: true, data: { advice } })
})

// GET /profile
bmiRoutes.get('/profile', authMiddleware, async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'bmi')
  const [profile] = await query('get profile', (db) =>
    db.select().from(bmiProfiles).where(eq(bmiProfiles.user_id, user.id)).limit(1)
  )
  if (!profile) {
    return c.json({ success: true, data: null })
  }
  return c.json({ success: true, data: { gender: profile.gender, age: profile.age, height: profile.height, weight: profile.weight } })
})

// PUT /profile
bmiRoutes.put('/profile', authMiddleware, async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'bmi')
  const body = await c.req.json<{ gender?: string; age?: number; height?: number; weight?: number }>()

  const gender = body.gender || 'male'
  const age = Number(body.age ?? 28)
  const height = Number(body.height ?? 170)
  const weight = Number(body.weight ?? 65)

  const [existing] = await query('check profile exists', (db) =>
    db.select().from(bmiProfiles).where(eq(bmiProfiles.user_id, user.id)).limit(1)
  )
  if (existing) {
    await query('update profile', (db) =>
      db.update(bmiProfiles).set({
        gender, age, height, weight,
        updated_at: beijingDatetime(),
      }).where(eq(bmiProfiles.user_id, user.id))
    )
  } else {
    await query('create profile', (db) =>
      db.insert(bmiProfiles).values({ user_id: user.id, gender, age, height, weight })
    )
  }

  return c.json({ success: true, data: { gender, age, height, weight } })
})

// POST /weight
bmiRoutes.post('/weight', authMiddleware, async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'bmi')
  const body = await c.req.json<{ weight?: number; date?: string }>()

  const weight = Number(body.weight || 0)
  if (isNaN(weight) || weight < 30 || weight > 300) {
    return c.json({ error: '体重数据无效，请输入30-300kg之间的值' }, 400)
  }

  const today = beijingDate()
  let recordDate = today
  if (body.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return c.json({ error: '日期格式无效' }, 400)
    }
    recordDate = body.date
    if (recordDate > today) {
      return c.json({ error: '不能记录未来日期的体重' }, 400)
    }
    const earliest = new Date(beijingNow().getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    if (recordDate < earliest) {
      return c.json({ error: '只能补录最近三个月的体重数据' }, 400)
    }
  }

  const [existing] = await query('check duplicate weight', (db) =>
    db.select().from(weightRecords)
      .where(and(eq(weightRecords.user_id, user.id), eq(weightRecords.date, recordDate)))
      .limit(1)
  )
  if (existing) {
    return c.json({ error: `${recordDate} 的体重已记录，无法修改` }, 409)
  }

  const [record] = await query('insert weight', (db) =>
    db.insert(weightRecords).values({
      user_id: user.id, weight, date: recordDate,
    }).returning()
  )

  if (recordDate === today) {
    try {
      const [profile] = await query('get profile for sync', (db) =>
        db.select().from(bmiProfiles).where(eq(bmiProfiles.user_id, user.id)).limit(1)
      )
      if (profile) {
        await query('sync profile weight', (db) =>
          db.update(bmiProfiles).set({ weight }).where(eq(bmiProfiles.user_id, user.id))
        )
      }
    } catch (e) {
      console.error(`[bmi] profile sync failed: user=${user.id} weight=${weight}`, e)
    }
  }

  return c.json({ success: true, data: { id: record.id, weight: record.weight, date: record.date, created_at: record.created_at } })
})

// GET /weight/today
bmiRoutes.get('/weight/today', authMiddleware, async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'bmi')
  const today = beijingDate()

  const [record] = await query('get today weight', (db) =>
    db.select().from(weightRecords)
      .where(and(eq(weightRecords.user_id, user.id), eq(weightRecords.date, today)))
      .limit(1)
  )

  if (record) {
    return c.json({ recorded: true, data: { id: record.id, weight: record.weight, date: record.date, created_at: record.created_at } })
  }
  return c.json({ recorded: false, data: null })
})

// GET /weight/history
bmiRoutes.get('/weight/history', authMiddleware, async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'bmi')
  let days = Math.min(Math.max(parseInt(c.req.query('days') || '90', 10), 7), 365)
  const startDate = new Date(beijingNow().getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const records = await query('get weight history', (db) =>
    db.select().from(weightRecords)
      .where(and(eq(weightRecords.user_id, user.id), sql`${weightRecords.date} >= ${startDate}`))
      .orderBy(asc(weightRecords.date))
  )

  return c.json({
    success: true,
    data: records.map(r => ({ id: r.id, weight: r.weight, date: r.date, created_at: r.created_at })),
  })
})

// POST /weight/analysis
bmiRoutes.post('/weight/analysis', authMiddleware, async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'bmi')
  const startDate = new Date(beijingNow().getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const records = await query('get records for analysis', (db) =>
    db.select().from(weightRecords)
      .where(and(eq(weightRecords.user_id, user.id), sql`${weightRecords.date} >= ${startDate}`))
      .orderBy(asc(weightRecords.date))
  )

  if (records.length < 3) {
    return c.json({ error: '体重记录不足，至少需要3条记录才能进行分析' }, 400)
  }

  const [profile] = await query('get profile for analysis', (db) =>
    db.select().from(bmiProfiles).where(eq(bmiProfiles.user_id, user.id)).limit(1)
  )
  const heightM = profile ? profile.height / 100 : 1.70
  const latest = records[records.length - 1]
  const earliest = records[0]
  const weightChange = latest.weight - earliest.weight
  const currentBmi = Math.round(latest.weight / (heightM * heightM) * 10) / 10

  const dataLines = records.map(r => `  ${r.date}: ${r.weight} kg`).join('\n')
  const daySpan = Math.round((new Date(latest.date).getTime() - new Date(earliest.date).getTime()) / (24 * 60 * 60 * 1000))

  const prompt = `你是一位专业的健康管理顾问。请根据以下用户的体重记录数据进行分析。

用户信息：性别 ${!profile || profile.gender === 'male' ? '男' : '女'}，年龄 ${profile?.age ?? 28} 岁，身高 ${profile?.height ?? 170} cm

体重记录（共 ${records.length} 条，时间跨度 ${daySpan} 天）：
${dataLines}

当前BMI: ${currentBmi}
期间体重变化: ${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} kg

请从以下几个方面进行分析：
1. 体重变化趋势总结（上升/下降/波动/平稳）
2. 变化速率是否健康合理
3. 基于BMI的健康评估
4. 针对性的饮食和运动建议
5. 需要注意的健康风险（如有）

要求：
- 使用中文回答
- 语气专业但亲切
- 总字数控制在300字以内
- 使用简洁的段落格式
- 输出 4 到 5 个自然段，每段单独换行
- 不要输出 JSON、Markdown 标题、项目符号或代码块`

  const weeklyChange = Math.round(weightChange / Math.max(daySpan, 1) * 7 * 10) / 10
  let fallback = ''
  if (Math.abs(weightChange) < 1) fallback = '近阶段体重整体较平稳，波动幅度不大。'
  else if (weightChange > 0) fallback = `近阶段体重累计上升 ${weightChange.toFixed(1)} kg，整体呈缓慢上升趋势。`
  else fallback = `近阶段体重累计下降 ${Math.abs(weightChange).toFixed(1)} kg，整体呈下降趋势。`
  fallback += `\n按周估算变化约 ${weeklyChange > 0 ? '+' : ''}${weeklyChange} kg。`
  fallback += `\n当前 BMI 为 ${currentBmi}。`
  fallback += '\n饮食上尽量稳定三餐、减少高糖高油；运动上保持每周有氧加基础力量训练，并继续规律记录体重。'

  let analysis: string
  try {
    const content = await callAI(c.env, [
      { role: 'system', content: '你是一位专业的健康管理顾问。输出必须是自然中文段落，不要 JSON，不要 Markdown，不要代码块。' },
      { role: 'user', content: prompt },
    ], { temperature: 0.5, max_tokens: 800 })

    analysis = stripCodeFences(content) || fallback
  } catch {
    analysis = fallback
  }

  return c.json({ success: true, data: { analysis } })
})
