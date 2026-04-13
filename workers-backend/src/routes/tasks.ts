import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and, sql, asc, desc, inArray } from 'drizzle-orm'
import { tasks, taskImages } from '../db/schema'
import { authMiddleware } from '../middleware/auth'
import { taskImageRoutes } from './task-images'
import type { Env } from '../types'

export const taskRoutes = new Hono<Env>()

// All routes require auth
taskRoutes.use('*', authMiddleware)

// GET /
taskRoutes.get('/', async (c) => {
  const user = c.get('user')
  const db = drizzle(c.env.DB)

  const status = c.req.query('status')
  const sort = c.req.query('sort') || 'due_date'
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('page_size') || '20', 10)))

  // Build where conditions
  const conditions = [eq(tasks.user_id, user.id)]
  if (status) {
    conditions.push(eq(tasks.status, status as 'pending' | 'done'))
  }
  const where = and(...conditions)

  // Count total
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(tasks).where(where)

  // Query with sorting
  let query
  if (sort === 'created_at') {
    query = db.select().from(tasks).where(where)
      .orderBy(desc(tasks.created_at))
  } else {
    // NULL due_dates last, then due_date ASC, then created_at DESC
    query = db.select().from(tasks).where(where)
      .orderBy(
        sql`CASE WHEN ${tasks.due_date} IS NULL THEN 1 ELSE 0 END`,
        asc(tasks.due_date),
        desc(tasks.created_at),
      )
  }

  const offset = (page - 1) * pageSize
  const items = await query.limit(pageSize).offset(offset)

  // Batch fetch images for all tasks
  const taskIds = items.map(t => t.id)
  let imagesMap: Record<number, { id: number; filename: string; sort_order: number }[]> = {}
  if (taskIds.length > 0) {
    const allImages = await db.select({
      id: taskImages.id,
      task_id: taskImages.task_id,
      filename: taskImages.filename,
      sort_order: taskImages.sort_order,
    }).from(taskImages)
      .where(inArray(taskImages.task_id, taskIds))
      .orderBy(asc(taskImages.sort_order))

    for (const img of allImages) {
      if (!imagesMap[img.task_id]) imagesMap[img.task_id] = []
      imagesMap[img.task_id].push({ id: img.id, filename: img.filename, sort_order: img.sort_order })
    }
  }

  return c.json({
    items: items.map(t => ({ ...taskToDict(t), images: imagesMap[t.id] || [] })),
    total: count,
    page,
    page_size: pageSize,
  })
})

// GET /:id
taskRoutes.get('/:id', async (c) => {
  const user = c.get('user')
  const db = drizzle(c.env.DB)
  const taskId = parseInt(c.req.param('id'), 10)

  const [task] = await db.select().from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.user_id, user.id)))
    .limit(1)

  if (!task) {
    return c.json({ error: '任务不存在' }, 404)
  }

  const images = await db.select({
    id: taskImages.id,
    filename: taskImages.filename,
    mime_type: taskImages.mime_type,
    size: taskImages.size,
    sort_order: taskImages.sort_order,
  }).from(taskImages)
    .where(eq(taskImages.task_id, taskId))
    .orderBy(asc(taskImages.sort_order))

  return c.json({ ...taskToDict(task), images })
})

// POST /
taskRoutes.post('/', async (c) => {
  const user = c.get('user')
  const db = drizzle(c.env.DB)
  const body = await c.req.json<{ title?: string; description?: string; due_date?: string | null }>()

  const title = (body.title || '').trim()
  if (!title) {
    return c.json({ error: '任务标题不能为空' }, 400)
  }

  let due_date: string | null = null
  if (body.due_date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.due_date)) {
      return c.json({ error: '日期格式错误，请使用 YYYY-MM-DD 格式' }, 400)
    }
    due_date = body.due_date
  }

  const [task] = await db.insert(tasks).values({
    title,
    description: body.description || '',
    due_date,
    user_id: user.id,
  }).returning()

  return c.json(taskToDict(task), 201)
})

// PUT /:id
taskRoutes.put('/:id', async (c) => {
  const user = c.get('user')
  const db = drizzle(c.env.DB)
  const taskId = parseInt(c.req.param('id'), 10)
  const body = await c.req.json<{ title?: string; description?: string; due_date?: string | null }>()

  const [existing] = await db.select().from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.user_id, user.id)))
    .limit(1)

  if (!existing) {
    return c.json({ error: '任务不存在' }, 404)
  }

  const title = (body.title || '').trim()
  if (!title) {
    return c.json({ error: '任务标题不能为空' }, 400)
  }

  let due_date: string | null = null
  if (body.due_date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.due_date)) {
      return c.json({ error: '日期格式错误，请使用 YYYY-MM-DD 格式' }, 400)
    }
    due_date = body.due_date
  }

  const [updated] = await db.update(tasks).set({
    title,
    description: body.description || '',
    due_date,
  }).where(eq(tasks.id, taskId)).returning()

  return c.json(taskToDict(updated))
})

// PATCH /:id/status
taskRoutes.patch('/:id/status', async (c) => {
  const user = c.get('user')
  const db = drizzle(c.env.DB)
  const taskId = parseInt(c.req.param('id'), 10)
  const body = await c.req.json<{ status?: string }>()

  if (!body.status || !['pending', 'done'].includes(body.status)) {
    return c.json({ error: '无效的状态值' }, 400)
  }

  const [existing] = await db.select().from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.user_id, user.id)))
    .limit(1)

  if (!existing) {
    return c.json({ error: '任务不存在' }, 404)
  }

  const [updated] = await db.update(tasks).set({
    status: body.status as 'pending' | 'done',
  }).where(eq(tasks.id, taskId)).returning()

  return c.json(taskToDict(updated))
})

// DELETE /:id
taskRoutes.delete('/:id', async (c) => {
  const user = c.get('user')
  const db = drizzle(c.env.DB)
  const taskId = parseInt(c.req.param('id'), 10)

  const [existing] = await db.select().from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.user_id, user.id)))
    .limit(1)

  if (!existing) {
    return c.json({ error: '任务不存在' }, 404)
  }

  // Delete associated images from R2 and DB
  const images = await db.select().from(taskImages)
    .where(eq(taskImages.task_id, taskId))

  if (images.length > 0) {
    await Promise.all(images.map(img => c.env.IMAGES_BUCKET.delete(img.r2_key)))
    await db.delete(taskImages).where(eq(taskImages.task_id, taskId))
  }

  await db.delete(tasks).where(eq(tasks.id, taskId))
  return c.json({ message: '任务已删除' })
})

function taskToDict(t: typeof tasks.$inferSelect) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    due_date: t.due_date,
    created_at: t.created_at,
    user_id: t.user_id,
  }
}

// Mount image sub-routes
taskRoutes.route('/', taskImageRoutes)
