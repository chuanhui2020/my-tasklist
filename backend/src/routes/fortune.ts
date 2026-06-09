import { Hono } from 'hono'
import { eq, and, sql, desc } from 'drizzle-orm'
import { fortuneRecords } from '../db/schema'
import { authMiddleware } from '../middleware/auth'
import { callAI, generateImage } from '../lib/ai'
import { verifyToken } from '../lib/token'
import { createDB, beijingNow, beijingDayUtcRange } from '../lib/db'
import type { Env, FortuneImageJob } from '../types'

export const fortuneRoutes = new Hono<Env>()

// Image serving - BEFORE auth middleware (uses custom auth with ?token= for <img src>)
fortuneRoutes.get('/:id/image', async (c) => {
  let userId: number | null = null

  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const payload = await verifyToken(authHeader.substring(7), c.env.SECRET_KEY)
    if (payload) userId = payload.user_id
  }

  if (!userId) {
    const tokenParam = c.req.query('token')
    if (tokenParam) {
      const payload = await verifyToken(tokenParam, c.env.SECRET_KEY)
      if (payload) userId = payload.user_id
    }
  }

  if (!userId) {
    return c.json({ error: '未登录或凭证无效' }, 401)
  }

  const id = parseInt(c.req.param('id'), 10)
  const { query } = createDB(c.env.DB, 'fortune')

  const [record] = await query('get fortune for image', (db) =>
    db.select({ user_id: fortuneRecords.user_id, image_r2_key: fortuneRecords.image_r2_key })
      .from(fortuneRecords)
      .where(and(eq(fortuneRecords.id, id), eq(fortuneRecords.user_id, userId!)))
      .limit(1)
  )

  if (!record || !record.image_r2_key) {
    return c.json({ error: '图片未生成' }, 404)
  }

  const object = await c.env.IMAGES_BUCKET.get(record.image_r2_key)
  if (!object) {
    return c.json({ error: '图片文件不存在' }, 404)
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=604800',
    },
  })
})

fortuneRoutes.use('*', authMiddleware)

const FORTUNE_TYPES = [
  { type: 'great', text: '上上签', weight: 5 },
  { type: 'good', text: '上签', weight: 20 },
  { type: 'medium', text: '中签', weight: 45 },
  { type: 'fair', text: '中下签', weight: 20 },
  { type: 'poor', text: '下签', weight: 10 },
]

function pickFortuneType(): string {
  const totalWeight = FORTUNE_TYPES.reduce((s, t) => s + t.weight, 0)
  let r = Math.random() * totalWeight
  for (const t of FORTUNE_TYPES) {
    r -= t.weight
    if (r <= 0) return t.type
  }
  return 'medium'
}

function getFortuneTypeText(type: string): string {
  return FORTUNE_TYPES.find(t => t.type === type)?.text || '中签'
}

function getCurrentSeason(): string {
  const month = beijingNow().getMonth() + 1
  if (month >= 3 && month <= 5) return '春'
  if (month >= 6 && month <= 8) return '夏'
  if (month >= 9 && month <= 11) return '秋'
  return '冬'
}

function buildImagePrompt(poem: string, fortuneType: string): string {
  const mood = fortuneType === 'great' || fortuneType === 'good'
    ? 'auspicious and warm, with subtle golden light'
    : fortuneType === 'poor'
      ? 'contemplative and misty, with a melancholic atmosphere'
      : 'balanced and serene, with a peaceful mood'

  return `Create a traditional Chinese ink wash painting (水墨画) illustration inspired by this poem:

"${poem}"

Style: Traditional Chinese brush painting with elegant minimalist composition and generous white space.
Color: Muted ink tones with subtle color accents (light gold, vermillion, or jade green).
Mood: ${mood}.
Composition: Square format, centered subject, natural imagery reflecting the poem's meaning.
Important: Do NOT include any text, characters, or calligraphy in the image.`
}

function buildFortunePrompt(fortuneNumber: number, fortuneType: string): string {
  const themes = ['事业前程', '姻缘桃花', '财运亨通', '学业进步', '健康平安', '家庭和睦', '旅行出行', '贵人相助']
  const elements = ['金', '木', '水', '火', '土']
  const imageryStyles = ['山水意境', '花鸟虫鱼', '日月星辰', '风雨雷电', '江河湖海', '松竹梅兰', '龙凤麒麟', '琴棋书画', '云雾霞光', '剑胆琴心']

  const theme = themes[Math.floor(Math.random() * themes.length)]
  const season = getCurrentSeason()
  const element = elements[Math.floor(Math.random() * elements.length)]
  const imagery = imageryStyles[Math.floor(Math.random() * imageryStyles.length)]
  const now = beijingNow()
  const today = `${now.getUTCFullYear()}年${String(now.getUTCMonth() + 1).padStart(2, '0')}月${String(now.getUTCDate()).padStart(2, '0')}日`
  const typeText = getFortuneTypeText(fortuneType)

  return `现在是${today}，${season}季，五行属${element}。
求签者抽到了第 ${fortuneNumber} 签，心中所念偏向「${theme}」。
此签已定为「${typeText}」（${fortuneType}），请严格按照此签型生成对应的签诗与解读。

请根据签号、签型、时节与五行，生成一支独特的灵签。每次生成的签诗和解读都应不同，体现当下时运。
签诗的意境和解读的语气必须与「${typeText}」的吉凶程度相符。

**签诗创作要求（非常重要）：**
- 本次签诗请以「${imagery}」为意象风格
- 签诗四句中禁止直接出现"春""夏""秋""冬"这四个季节字，用其他意象来暗示时令
- 每支签诗的用词、意象、典故都必须独特，不要套用常见模板
- 避免使用"花开""春来""春风"等高频词汇

**所有文字必须使用简体中文。**

严格按照以下 JSON 格式返回，不要包含任何 markdown 格式标记：
{
    "type": "${fortuneType}",
    "typeText": "${typeText}",
    "poem": "四句七言签诗，每句以逗号或句号结尾，最后一句必须以句号（。）结尾",
    "interpretation": "对签诗的详细白话解说，包含运势分析",
    "advice": [
        { "label": "事业", "value": "简短建议" },
        { "label": "财运", "value": "简短建议" },
        { "label": "感情", "value": "简短建议" },
        { "label": "健康", "value": "简短建议" }
    ],
    "work_fortune": "今日工作运势，用搞笑幽默的语气写，像朋友吐槽一样，例如：宜摸鱼、宜假装很忙、宜带薪拉屎、宜疯狂加班冲KPI、宜跟老板画大饼等，30字以内"
}`
}

function generateFallbackFortune(fortuneNumber: number, fortuneType: string) {
  const poems = [
    '福至心自宽，云散天地阔，诚心祈善愿，吉庆自然来。',
    '云开见月明，守得清风至，耐心待时机，好运必相随。',
    '登高望远处，前程似锦绣，勤勉不懈怠，功名可期待。',
    '水到渠成时，莫急莫躁进，静待良机至，万事皆顺遂。',
    '柳暗复明处，转机在眼前，坚持初心志，终见彩虹现。',
  ]
  const interpretations = [
    '此签示意运势渐佳，诸事顺遂。当下虽有小阻，但只要保持诚心与耐心，终能拨云见日，迎来转机。',
    '签示前路光明，贵人相助。凡事宜积极进取，但需谨慎行事，切勿操之过急，方能水到渠成。',
    '此签暗示需要等待时机，不宜急进。当前虽有困顿，但守得云开见月明，耐心等待必有收获。',
    '签文提醒需要坚持与努力，机会就在不远处。只要不放弃，持之以恒，定能达成所愿。',
    '此签预示转机将至，困境即将过去。保持乐观心态，积极面对，好运即将降临。',
  ]
  const adviceOptions = [
    [{ label: '事业', value: '贵人相助，宜把握机会' }, { label: '财运', value: '正财稳定，偏财需谨慎' }, { label: '感情', value: '真诚相待，情缘可期' }, { label: '健康', value: '注意休息，保持平和' }],
    [{ label: '事业', value: '稳中求进，切勿冒进' }, { label: '财运', value: '量入为出，理财有道' }, { label: '感情', value: '耐心等待，缘分自来' }, { label: '健康', value: '规律作息，身心安康' }],
  ]
  const workFortunes = [
    '宜摸鱼，老板不在工位的时候就是你的黄金时间',
    '宜带薪拉屎，每次多蹲五分钟，一年多赚一个月',
    '宜假装很忙，打字声音要大，表情要严肃',
    '宜疯狂加班冲KPI，今天不卷明天被卷',
    '宜躺平，今日诸事不宜，唯有躺平保平安',
  ]

  return {
    type: fortuneType,
    typeText: getFortuneTypeText(fortuneType),
    poem: poems[fortuneNumber % poems.length],
    interpretation: interpretations[fortuneNumber % interpretations.length],
    advice: adviceOptions[fortuneNumber % adviceOptions.length],
    work_fortune: workFortunes[fortuneNumber % workFortunes.length],
  }
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

function fortuneToDict(r: typeof fortuneRecords.$inferSelect) {
  let advice = r.advice
  try { advice = JSON.parse(r.advice) } catch { /* already parsed or string */ }
  return {
    id: r.id,
    fortuneNumber: r.fortune_number,
    type: r.fortune_type,
    typeText: r.type_text,
    poem: r.poem,
    interpretation: r.interpretation,
    advice,
    work_fortune: r.work_fortune,
    hasImage: !!r.image_r2_key,
    imageStatus: r.image_r2_key ? 'done' : (r.image_status || null),
    created_at: r.created_at,
  }
}

// POST /generate
fortuneRoutes.post('/generate', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'fortune')

  const { start: dayStart, end: dayEnd } = beijingDayUtcRange()

  const [existing] = await query('check daily limit', (db) =>
    db.select().from(fortuneRecords)
      .where(and(
        eq(fortuneRecords.user_id, user.id),
        sql`${fortuneRecords.created_at} >= ${dayStart}`,
        sql`${fortuneRecords.created_at} <= ${dayEnd}`,
      ))
      .limit(1)
  )

  if (existing) {
    return c.json({
      success: false,
      error: '今日已求过签，每日仅可求签一次',
      data: fortuneToDict(existing),
    }, 429)
  }

  const body = await c.req.json<{ fortuneNumber?: number }>()
  const fortuneNumber = body.fortuneNumber ?? 1

  if (!Number.isInteger(fortuneNumber) || fortuneNumber < 1 || fortuneNumber > 100) {
    return c.json({ error: '签号必须在 1-100 之间' }, 400)
  }

  const fortuneType = pickFortuneType()
  let fortuneData: Record<string, unknown>

  try {
    const prompt = buildFortunePrompt(fortuneNumber, fortuneType)
    const content = await callAI(c.env, [
      { role: 'system', content: '你是一位精通周易与传统占卜的老法师，输出必须是纯 JSON 格式，所有内容使用简体中文。' },
      { role: 'user', content: prompt },
    ], { temperature: 0.95, max_tokens: 800 })

    const cleaned = stripCodeFences(content)
    fortuneData = JSON.parse(cleaned)
  } catch {
    fortuneData = generateFallbackFortune(fortuneNumber, fortuneType)
  }

  fortuneData.type = fortuneType
  fortuneData.typeText = getFortuneTypeText(fortuneType)

  const adviceStr = typeof fortuneData.advice === 'string'
    ? fortuneData.advice
    : JSON.stringify(fortuneData.advice)

  const [record] = await query('insert fortune record', (db) =>
    db.insert(fortuneRecords).values({
      user_id: user.id,
      fortune_number: fortuneNumber,
      fortune_type: fortuneData.type as string,
      type_text: fortuneData.typeText as string,
      poem: (fortuneData.poem as string) || '',
      interpretation: (fortuneData.interpretation as string) || '',
      advice: adviceStr,
      work_fortune: (fortuneData.work_fortune as string) || '',
    }).returning()
  )

  // Image generation is handled by a separate endpoint
  return c.json({ success: true, data: fortuneToDict(record) })
})

// GET /today
fortuneRoutes.get('/today', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'fortune')

  const { start: dayStart, end: dayEnd } = beijingDayUtcRange()

  const [record] = await query('get today fortune', (db) =>
    db.select().from(fortuneRecords)
      .where(and(
        eq(fortuneRecords.user_id, user.id),
        sql`${fortuneRecords.created_at} >= ${dayStart}`,
        sql`${fortuneRecords.created_at} <= ${dayEnd}`,
      ))
      .limit(1)
  )

  if (record) {
    return c.json({ drawn: true, data: fortuneToDict(record) })
  }
  return c.json({ drawn: false, data: null })
})

// GET /history
fortuneRoutes.get('/history', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'fortune')

  const records = await query('get fortune history', (db) =>
    db.select().from(fortuneRecords)
      .where(eq(fortuneRecords.user_id, user.id))
      .orderBy(desc(fortuneRecords.created_at))
      .limit(10)
  )

  return c.json({ records: records.map(fortuneToDict) })
})

// POST /:id/generate-image - 入队异步生成：原子幂等占位后入队，立即返回 202
// 实际生图在 Queue 消费者里跑（15min wall-time，可安全等待 ~125s 的生图请求）
fortuneRoutes.post('/:id/generate-image', async (c) => {
  const user = c.get('user')
  const id = parseInt(c.req.param('id'), 10)
  const { query } = createDB(c.env.DB, 'fortune')

  const [record] = await query('get fortune for image gen', (db) =>
    db.select({
      id: fortuneRecords.id,
      poem: fortuneRecords.poem,
      image_r2_key: fortuneRecords.image_r2_key,
    })
      .from(fortuneRecords)
      .where(and(eq(fortuneRecords.id, id), eq(fortuneRecords.user_id, user.id)))
      .limit(1)
  )

  if (!record) {
    return c.json({ error: '签文不存在' }, 404)
  }
  if (record.image_r2_key) {
    return c.json({ status: 'done', hasImage: true })
  }
  if (!record.poem) {
    return c.json({ error: '签诗为空' }, 400)
  }

  // 原子占位：仅当当前不是 generating/done 时才翻成 generating。
  // 用 returning() 判断本次请求是否“抢到”了占位，避免并发重复入队/重复扣费。
  const claimed = await query('claim image generating', (db) =>
    db.update(fortuneRecords)
      .set({ image_status: 'generating' })
      .where(and(
        eq(fortuneRecords.id, record.id),
        sql`(${fortuneRecords.image_status} IS NULL OR ${fortuneRecords.image_status} NOT IN ('generating', 'done'))`,
        sql`${fortuneRecords.image_r2_key} IS NULL`,
      ))
      .returning({ id: fortuneRecords.id })
  )

  if (claimed.length === 0) {
    // 已在生成中（别的请求抢到了），直接返回，不重复入队
    return c.json({ status: 'generating' }, 202)
  }

  try {
    await c.env.FORTUNE_IMAGE_QUEUE.send({ recordId: record.id, userId: user.id })
  } catch (e) {
    // 入队失败：回滚占位，否则会永久卡在 generating 且无法重试
    console.error('enqueue image job failed:', String(e).slice(0, 200))
    await query('rollback image generating', (db) =>
      db.update(fortuneRecords)
        .set({ image_status: 'failed' })
        .where(and(eq(fortuneRecords.id, record.id), sql`${fortuneRecords.image_r2_key} IS NULL`))
    )
    return c.json({ error: '生图任务入队失败，请重试' }, 503)
  }
  return c.json({ status: 'generating' }, 202)
})

// GET /:id/image-status - 前端轮询图片生成状态
fortuneRoutes.get('/:id/image-status', async (c) => {
  const user = c.get('user')
  const id = parseInt(c.req.param('id'), 10)
  const { query } = createDB(c.env.DB, 'fortune')

  const [record] = await query('get image status', (db) =>
    db.select({ image_r2_key: fortuneRecords.image_r2_key, image_status: fortuneRecords.image_status })
      .from(fortuneRecords)
      .where(and(eq(fortuneRecords.id, id), eq(fortuneRecords.user_id, user.id)))
      .limit(1)
  )

  if (!record) {
    return c.json({ error: '签文不存在' }, 404)
  }
  return c.json({
    hasImage: !!record.image_r2_key,
    status: record.image_r2_key ? 'done' : (record.image_status || 'none'),
  })
})

// Queue 消费者：实际生图逻辑（15min wall-time，可安全等待 ~125s 的生图请求）
// 抛异常会触发 Queue 自动重试；超过 max_retries 后在 index.ts 的 dead-letter 处理里置 failed
export async function processImageJob(
  env: Env['Bindings'],
  msg: FortuneImageJob
): Promise<void> {
  const { query } = createDB(env.DB, 'fortune-queue')

  const [record] = await query('queue: get fortune', (db) =>
    db.select({
      id: fortuneRecords.id,
      poem: fortuneRecords.poem,
      fortune_type: fortuneRecords.fortune_type,
      image_r2_key: fortuneRecords.image_r2_key,
    })
      .from(fortuneRecords)
      .where(and(eq(fortuneRecords.id, msg.recordId), eq(fortuneRecords.user_id, msg.userId)))
      .limit(1)
  )

  if (!record || record.image_r2_key) {
    return // 记录不存在或图已生成，无需处理
  }
  if (!record.poem) {
    await query('queue: mark failed (no poem)', (db) =>
      db.update(fortuneRecords).set({ image_status: 'failed' }).where(eq(fortuneRecords.id, record.id))
    )
    return
  }

  const imagePrompt = buildImagePrompt(record.poem, record.fortune_type)
  // 走灰云直连，无 100s 限制；retries:0，失败交给 Queue 重试机制
  const imageBytes = await generateImage(env, imagePrompt, { deadlineMs: 280000, retries: 0 })
  if (!imageBytes) {
    // 抛异常 → Queue 重试；最终失败由 dead-letter 置 failed
    throw new Error(`image generation returned null for record ${record.id}`)
  }

  const r2Key = `fortune/${msg.userId}/${record.id}.png`
  await env.IMAGES_BUCKET.put(r2Key, imageBytes, { httpMetadata: { contentType: 'image/png' } })
  await query('queue: update image key', (db) =>
    db.update(fortuneRecords)
      .set({ image_r2_key: r2Key, image_status: 'done' })
      .where(eq(fortuneRecords.id, record.id))
  )
}

// 标记生图最终失败（Queue 重试耗尽时调用）
export async function markImageFailed(env: Env['Bindings'], msg: FortuneImageJob): Promise<void> {
  const { query } = createDB(env.DB, 'fortune-queue')
  await query('queue: mark failed (exhausted)', (db) =>
    db.update(fortuneRecords)
      .set({ image_status: 'failed' })
      .where(and(eq(fortuneRecords.id, msg.recordId), sql`${fortuneRecords.image_r2_key} IS NULL`))
  )
}
