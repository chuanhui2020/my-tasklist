import { Hono } from 'hono'
import { eq, and, sql, desc } from 'drizzle-orm'
import { fortuneRecords } from '../db/schema'
import { authMiddleware } from '../middleware/auth'
import { callAI } from '../lib/ai'
import { createDB, beijingDate, beijingNow, beijingDayUtcRange } from '../lib/db'
import type { Env } from '../types'

export const fortuneRoutes = new Hono<Env>()
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
