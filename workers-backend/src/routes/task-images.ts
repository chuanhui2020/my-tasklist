import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and, asc } from 'drizzle-orm'
import { tasks, taskImages } from '../db/schema'
import { authMiddleware } from '../middleware/auth'
import { verifyToken } from '../lib/token'
import type { Env } from '../types'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_IMAGES_PER_TASK = 10

const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export const taskImageRoutes = new Hono<Env>()

// Image file serving - custom auth (supports ?token= for <img src>)
taskImageRoutes.get('/:id/images/:imageId/file', async (c) => {
  // Auth: check Authorization header first, then ?token= query param
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

  const db = drizzle(c.env.DB)
  const taskId = parseInt(c.req.param('id'), 10)
  const imageId = parseInt(c.req.param('imageId'), 10)

  // Verify task ownership
  const [task] = await db.select({ id: tasks.id }).from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.user_id, userId)))
    .limit(1)

  if (!task) {
    return c.json({ error: '任务不存在' }, 404)
  }

  const [image] = await db.select().from(taskImages)
    .where(and(eq(taskImages.id, imageId), eq(taskImages.task_id, taskId)))
    .limit(1)

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

// All remaining routes require standard auth middleware
taskImageRoutes.use('/:id/images', authMiddleware)
taskImageRoutes.use('/:id/images/*', authMiddleware)

// POST /:id/images - upload images
taskImageRoutes.post('/:id/images', async (c) => {
  const user = c.get('user')
  const db = drizzle(c.env.DB)
  const taskId = parseInt(c.req.param('id'), 10)

  // Verify task ownership
  const [task] = await db.select({ id: tasks.id }).from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.user_id, user.id)))
    .limit(1)

  if (!task) {
    return c.json({ error: '任务不存在' }, 404)
  }

  // Check existing image count
  const existing = await db.select({ id: taskImages.id }).from(taskImages)
    .where(eq(taskImages.task_id, taskId))

  const existingCount = existing.length

  // Parse multipart form
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

  // Validate all files first
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) {
      return c.json({ error: `不支持的图片格式: ${file.name}，仅支持 JPG/PNG/WebP` }, 400)
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return c.json({ error: `图片 ${file.name} 超过 5MB 限制` }, 400)
    }
  }

  // Upload each file
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

    const [record] = await db.insert(taskImages).values({
      task_id: taskId,
      user_id: user.id,
      r2_key: r2Key,
      filename: file.name,
      mime_type: file.type,
      size: file.size,
      sort_order: existingCount + i,
    }).returning()

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
taskImageRoutes.delete('/:id/images/:imageId', async (c) => {
  const user = c.get('user')
  const db = drizzle(c.env.DB)
  const taskId = parseInt(c.req.param('id'), 10)
  const imageId = parseInt(c.req.param('imageId'), 10)

  // Verify task ownership
  const [task] = await db.select({ id: tasks.id }).from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.user_id, user.id)))
    .limit(1)

  if (!task) {
    return c.json({ error: '任务不存在' }, 404)
  }

  const [image] = await db.select().from(taskImages)
    .where(and(eq(taskImages.id, imageId), eq(taskImages.task_id, taskId)))
    .limit(1)

  if (!image) {
    return c.json({ error: '图片不存在' }, 404)
  }

  await c.env.IMAGES_BUCKET.delete(image.r2_key)
  await db.delete(taskImages).where(eq(taskImages.id, imageId))

  return c.json({ message: '图片已删除' })
})
