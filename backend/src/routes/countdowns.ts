import { Hono } from 'hono'
import { eq, and, asc } from 'drizzle-orm'
import { countdowns } from '../db/schema'
import { authMiddleware } from '../middleware/auth'
import { createDB } from '../lib/db'
import type { Env } from '../types'

export const countdownRoutes = new Hono<Env>()
countdownRoutes.use('*', authMiddleware)

function countdownToDict(c: typeof countdowns.$inferSelect) {
  return {
    id: c.id,
    title: c.title,
    target_time: c.target_time,
    remind_before: c.remind_before,
    remind_level: c.remind_level,
    status: c.status,
    user_id: c.user_id,
    created_at: c.created_at,
  }
}

// GET /
countdownRoutes.get('/', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'countdowns')
  const items = await query('list countdowns', (db) =>
    db.select().from(countdowns)
      .where(eq(countdowns.user_id, user.id))
      .orderBy(asc(countdowns.target_time))
  )
  return c.json(items.map(countdownToDict))
})

// POST /
countdownRoutes.post('/', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'countdowns')
  const body = await c.req.json<{ title?: string; target_time?: string; remind_before?: number; remind_level?: string }>()

  if (!body.title?.trim()) {
    return c.json({ error: '倒计时标题不能为空' }, 400)
  }
  if (!body.target_time?.trim()) {
    return c.json({ error: '目标时间不能为空' }, 400)
  }
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(body.target_time)) {
    return c.json({ error: '时间格式错误，请使用 YYYY-MM-DD HH:MM:SS 格式' }, 400)
  }
  const remindLevel = body.remind_level || 'urgent'
  if (!['normal', 'urgent', 'crazy'].includes(remindLevel)) {
    return c.json({ error: '无效的提醒级别' }, 400)
  }

  const [item] = await query('create countdown', (db) =>
    db.insert(countdowns).values({
      title: body.title!.trim(),
      target_time: body.target_time!,
      remind_before: body.remind_before ?? 5,
      remind_level: remindLevel as 'normal' | 'urgent' | 'crazy',
      user_id: user.id,
    }).returning()
  )

  return c.json(countdownToDict(item), 201)
})

// PUT /:id
countdownRoutes.put('/:id', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'countdowns')
  const id = parseInt(c.req.param('id'), 10)
  const body = await c.req.json<{ title?: string; target_time?: string; remind_before?: number; remind_level?: string }>()

  const [existing] = await query('get countdown for update', (db) =>
    db.select().from(countdowns)
      .where(and(eq(countdowns.id, id), eq(countdowns.user_id, user.id)))
      .limit(1)
  )
  if (!existing) {
    return c.json({ error: '倒计时不存在' }, 404)
  }

  if (!body.title?.trim()) {
    return c.json({ error: '倒计时标题不能为空' }, 400)
  }
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(body.target_time || '')) {
    return c.json({ error: '时间格式错误，请使用 YYYY-MM-DD HH:MM:SS 格式' }, 400)
  }
  const remindLevel = body.remind_level || 'urgent'
  if (!['normal', 'urgent', 'crazy'].includes(remindLevel)) {
    return c.json({ error: '无效的提醒级别' }, 400)
  }

  const [updated] = await query('update countdown', (db) =>
    db.update(countdowns).set({
      title: body.title!.trim(),
      target_time: body.target_time!,
      remind_before: body.remind_before ?? 5,
      remind_level: remindLevel as 'normal' | 'urgent' | 'crazy',
    }).where(eq(countdowns.id, id)).returning()
  )

  return c.json(countdownToDict(updated))
})

// DELETE /:id
countdownRoutes.delete('/:id', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'countdowns')
  const id = parseInt(c.req.param('id'), 10)

  const [existing] = await query('get countdown for delete', (db) =>
    db.select().from(countdowns)
      .where(and(eq(countdowns.id, id), eq(countdowns.user_id, user.id)))
      .limit(1)
  )
  if (!existing) {
    return c.json({ error: '倒计时不存在' }, 404)
  }

  await query('delete countdown', (db) =>
    db.delete(countdowns).where(eq(countdowns.id, id))
  )
  return c.json({ message: '倒计时已删除' })
})

// GET /upcoming
countdownRoutes.get('/upcoming', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'countdowns')

  const items = await query('get upcoming countdowns', (db) =>
    db.select().from(countdowns)
      .where(and(eq(countdowns.user_id, user.id), eq(countdowns.status, 'active')))
  )

  return c.json(items.map(countdownToDict))
})

// PATCH /:id/dismiss
countdownRoutes.patch('/:id/dismiss', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'countdowns')
  const id = parseInt(c.req.param('id'), 10)

  const [existing] = await query('get countdown for dismiss', (db) =>
    db.select().from(countdowns)
      .where(and(eq(countdowns.id, id), eq(countdowns.user_id, user.id)))
      .limit(1)
  )
  if (!existing) {
    return c.json({ error: '倒计时不存在' }, 404)
  }

  await query('dismiss countdown', (db) =>
    db.update(countdowns).set({ status: 'dismissed' }).where(eq(countdowns.id, id))
  )
  return c.json({ message: '已关闭提醒' })
})
