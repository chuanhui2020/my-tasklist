import { Hono } from 'hono'
import { eq, and, sql, asc, desc, inArray } from 'drizzle-orm'
import { tasks, taskImages } from '../db/schema'
import { authMiddleware } from '../middleware/auth'
import { verifyToken } from '../lib/token'
import { createDB } from '../lib/db'
import type { Env } from '../types'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_IMAGES_PER_TASK = 10
const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export const taskRoutes = new Hono<Env>()

// Image file serving - BEFORE auth middleware (uses custom auth with ?token= for <img src>)
taskRoutes.get('/:id/images/:imageId/file', async (c) => {
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

  const { query } = createDB(c.env.DB, 'tasks')
  const taskId = parseInt(c.req.param('id'), 10)
  const imageId = parseInt(c.req.param('imageId'), 10)

  const [task] = await query('get task for image', (db) =>
    db.select({ id: tasks.id }).from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.user_id, userId!)))
      .limit(1)
  )

  if (!task) {
    return c.json({ error: '任务不存在' }, 404)
  }

  const [image] = await query('get image record', (db) =>
    db.select().from(taskImages)
      .where(and(eq(taskImages.id, imageId), eq(taskImages.task_id, taskId)))
      .limit(1)
  )

  if (!image) {
    return c.json({ error: '图片不存在' }, 404)
  }

  const object = await c.env.IMAGES_BUCKET.get(image.r2_key)
  if (!object) {
    return c.json({ error: '图片文件不存在' }, 404)
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': image.mime_type,
      'Cache-Control': 'public, max-age=86400',
    },
  })
})

// All other routes require auth
taskRoutes.use('*', authMiddleware)

// GET /
taskRoutes.get('/', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'tasks')

  const status = c.req.query('status')
  const sort = c.req.query('sort') || 'due_date'
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('page_size') || '20', 10)))

  const conditions = [eq(tasks.user_id, user.id)]
  if (status) {
    conditions.push(eq(tasks.status, status as 'pending' | 'done'))
  }
  const where = and(...conditions)

  const [{ count }] = await query('count tasks', (db) =>
    db.select({ count: sql<number>`count(*)` }).from(tasks).where(where)
  )

  const offset = (page - 1) * pageSize
  let items: (typeof tasks.$inferSelect)[]
  if (sort === 'created_at') {
    items = await query('list tasks by created_at', (db) =>
      db.select().from(tasks).where(where)
        .orderBy(desc(tasks.created_at))
        .limit(pageSize).offset(offset)
    )
  } else {
    items = await query('list tasks by due_date', (db) =>
      db.select().from(tasks).where(where)
        .orderBy(
          sql`CASE WHEN ${tasks.due_date} IS NULL THEN 1 ELSE 0 END`,
          asc(tasks.due_date),
          desc(tasks.created_at),
        )
        .limit(pageSize).offset(offset)
    )
  }

  const taskIds = items.map(t => t.id)
  const imagesMap: Record<number, { id: number; filename: string; sort_order: number }[]> = {}
  if (taskIds.length > 0) {
    const allImages = await query('get task images', (db) =>
      db.select({
        id: taskImages.id,
        task_id: taskImages.task_id,
        filename: taskImages.filename,
        sort_order: taskImages.sort_order,
      }).from(taskImages)
        .where(inArray(taskImages.task_id, taskIds))
        .orderBy(asc(taskImages.sort_order))
    )

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
  const { query } = createDB(c.env.DB, 'tasks')
  const taskId = parseInt(c.req.param('id'), 10)

  const [task] = await query('get task', (db) =>
    db.select().from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.user_id, user.id)))
      .limit(1)
  )

  if (!task) {
    return c.json({ error: '任务不存在' }, 404)
  }

  const images = await query('get task images', (db) =>
    db.select({
      id: taskImages.id,
      filename: taskImages.filename,
      mime_type: taskImages.mime_type,
      size: taskImages.size,
      sort_order: taskImages.sort_order,
    }).from(taskImages)
      .where(eq(taskImages.task_id, taskId))
      .orderBy(asc(taskImages.sort_order))
  )

  return c.json({ ...taskToDict(task), images })
})

// POST /
taskRoutes.post('/', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'tasks')
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

  const [task] = await query('create task', (db) =>
    db.insert(tasks).values({
      title,
      description: body.description || '',
      due_date,
      user_id: user.id,
    }).returning()
  )

  return c.json(taskToDict(task), 201)
})

// PUT /:id
taskRoutes.put('/:id', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'tasks')
  const taskId = parseInt(c.req.param('id'), 10)
  const body = await c.req.json<{ title?: string; description?: string; due_date?: string | null }>()

  const [existing] = await query('get task for update', (db) =>
    db.select().from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.user_id, user.id)))
      .limit(1)
  )

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

  const [updated] = await query('update task', (db) =>
    db.update(tasks).set({
      title,
      description: body.description || '',
      due_date,
    }).where(eq(tasks.id, taskId)).returning()
  )

  return c.json(taskToDict(updated))
})

// PATCH /:id/status
taskRoutes.patch('/:id/status', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'tasks')
  const taskId = parseInt(c.req.param('id'), 10)
  const body = await c.req.json<{ status?: string }>()

  if (!body.status || !['pending', 'done'].includes(body.status)) {
    return c.json({ error: '无效的状态值' }, 400)
  }

  const [existing] = await query('get task for status update', (db) =>
    db.select().from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.user_id, user.id)))
      .limit(1)
  )

  if (!existing) {
    return c.json({ error: '任务不存在' }, 404)
  }

  const [updated] = await query('update task status', (db) =>
    db.update(tasks).set({
      status: body.status as 'pending' | 'done',
    }).where(eq(tasks.id, taskId)).returning()
  )

  return c.json(taskToDict(updated))
})

// DELETE /:id
taskRoutes.delete('/:id', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'tasks')
  const taskId = parseInt(c.req.param('id'), 10)

  const [existing] = await query('get task for delete', (db) =>
    db.select().from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.user_id, user.id)))
      .limit(1)
  )

  if (!existing) {
    return c.json({ error: '任务不存在' }, 404)
  }

  const images = await query('get images for delete', (db) =>
    db.select().from(taskImages)
      .where(eq(taskImages.task_id, taskId))
  )

  if (images.length > 0) {
    await Promise.all(images.map(img => c.env.IMAGES_BUCKET.delete(img.r2_key)))
    await query('delete task images', (db) =>
      db.delete(taskImages).where(eq(taskImages.task_id, taskId))
    )
  }

  await query('delete task', (db) =>
    db.delete(tasks).where(eq(tasks.id, taskId))
  )
  return c.json({ message: '任务已删除' })
})

// POST /:id/images - upload images
taskRoutes.post('/:id/images', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'tasks')
  const taskId = parseInt(c.req.param('id'), 10)

  const [task] = await query('get task for image upload', (db) =>
    db.select({ id: tasks.id }).from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.user_id, user.id)))
      .limit(1)
  )

  if (!task) {
    return c.json({ error: '任务不存在' }, 404)
  }

  const existing = await query('count existing images', (db) =>
    db.select({ id: taskImages.id }).from(taskImages)
      .where(eq(taskImages.task_id, taskId))
  )

  const existingCount = existing.length

  const formData = await c.req.formData()
  const entries = formData.getAll('images')
  const files: File[] = []
  for (const entry of entries) {
    if (typeof entry !== 'string' && 'arrayBuffer' in entry) {
      files.push(entry as unknown as File)
    }
  }

  if (!files.length) {
    return c.json({ error: '请选择要上传的图片' }, 400)
  }

  if (existingCount + files.length > MAX_IMAGES_PER_TASK) {
    return c.json({ error: `每个任务最多 ${MAX_IMAGES_PER_TASK} 张图片，当前已有 ${existingCount} 张` }, 400)
  }

  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) {
      return c.json({ error: `不支持的图片格式: ${file.name}，仅支持 JPG/PNG/WebP` }, 400)
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return c.json({ error: `图片 ${file.name} 超过 5MB 限制` }, 400)
    }
  }

  const results = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const ext = EXT_MAP[file.type] || 'jpg'
    const uuid = crypto.randomUUID()
    const r2Key = `tasks/${user.id}/${taskId}/${uuid}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    await c.env.IMAGES_BUCKET.put(r2Key, arrayBuffer, {
      httpMetadata: { contentType: file.type },
    })

    const [record] = await query(`upload image ${i}`, (db) =>
      db.insert(taskImages).values({
        task_id: taskId,
        user_id: user.id,
        r2_key: r2Key,
        filename: file.name,
        mime_type: file.type,
        size: file.size,
        sort_order: existingCount + i,
      }).returning()
    )

    results.push({
      id: record.id,
      filename: record.filename,
      mime_type: record.mime_type,
      size: record.size,
      sort_order: record.sort_order,
    })
  }

  return c.json(results, 201)
})

// DELETE /:id/images/:imageId
taskRoutes.delete('/:id/images/:imageId', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'tasks')
  const taskId = parseInt(c.req.param('id'), 10)
  const imageId = parseInt(c.req.param('imageId'), 10)

  const [task] = await query('get task for image delete', (db) =>
    db.select({ id: tasks.id }).from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.user_id, user.id)))
      .limit(1)
  )

  if (!task) {
    return c.json({ error: '任务不存在' }, 404)
  }

  const [image] = await query('get image for delete', (db) =>
    db.select().from(taskImages)
      .where(and(eq(taskImages.id, imageId), eq(taskImages.task_id, taskId)))
      .limit(1)
  )

  if (!image) {
    return c.json({ error: '图片不存在' }, 404)
  }

  await c.env.IMAGES_BUCKET.delete(image.r2_key)
  await query('delete image record', (db) =>
    db.delete(taskImages).where(eq(taskImages.id, imageId))
  )

  return c.json({ message: '图片已删除' })
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
