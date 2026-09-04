import { Hono } from 'hono'
import { eq, and, or, sql, asc, desc, inArray } from 'drizzle-orm'
import { notes, noteAttachments } from '../db/schema'
import { authMiddleware } from '../middleware/auth'
import { verifyToken } from '../lib/token'
import { createDB, beijingDatetime } from '../lib/db'
import type { Env } from '../types'

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_ATTACHMENTS_PER_NOTE = 10
const MAX_TAGS = 8
const MAX_TAG_LENGTH = 20
const MAX_TITLE_LENGTH = 120
const MAX_CONTENT_LENGTH = 50000

// 允许的附件类型 → 扩展名。SVG / HTML 故意不在列内：附件按原始 MIME 回源，
// 放行可内联执行脚本的类型等于给自己开一个 XSS 入口。
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/csv': 'csv',
  'application/json': 'json',
  'application/zip': 'zip',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
}

// 部分系统对 .md / .csv 等给不出 MIME（file.type 为空串），按扩展名兜底
const EXT_TO_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(ALLOWED_TYPES).map(([mime, ext]) => [ext, mime])
)

// 只有这些类型允许浏览器内联渲染，其余一律 Content-Disposition: attachment
const INLINE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])

type AttachmentRow = typeof noteAttachments.$inferSelect

function attachmentToDict(a: Pick<AttachmentRow, 'id' | 'filename' | 'mime_type' | 'size'>) {
  return { id: a.id, filename: a.filename, mime_type: a.mime_type, size: a.size }
}

function noteToDict(
  n: typeof notes.$inferSelect,
  attachments: ReturnType<typeof attachmentToDict>[] = []
) {
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    tags: n.tags ? n.tags.split(',').filter(Boolean) : [],
    pinned: n.pinned === 1,
    created_at: n.created_at,
    updated_at: n.updated_at,
    attachments,
  }
}

// 标签归一：去空白/逗号、按大小写不敏感去重、限长限量
function normalizeTags(input: unknown): string[] {
  const raw = Array.isArray(input)
    ? input
    : typeof input === 'string' ? input.split(',') : []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of raw) {
    const tag = String(item).replace(/[,\s]+/g, ' ').trim().slice(0, MAX_TAG_LENGTH)
    if (!tag) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(tag)
    if (result.length >= MAX_TAGS) break
  }
  return result
}

// SQLite 的 LIKE 里 % 和 _ 是通配符，用户输入不转义的话搜 "50%" 会命中全部记录
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

function resolveMimeType(file: File): string | null {
  if (ALLOWED_TYPES[file.type]) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  return EXT_TO_TYPE[ext] || null
}

// RFC 5987：中文文件名必须走 filename*，同时留一个 ASCII 版给老浏览器
function contentDisposition(kind: 'inline' | 'attachment', filename: string): string {
  const fallback = filename.replace(/[^ -~]/g, '_').replace(/["\\]/g, '_') || 'file'
  return `${kind}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

export const noteRoutes = new Hono<Env>()

// 附件下载/预览 —— 必须放在 authMiddleware 之前：<img src> / 新标签页打开带不了
// Authorization 头，这里额外支持 ?token=
noteRoutes.get('/:id/attachments/:attachmentId/file', async (c) => {
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

  const { query } = createDB(c.env.DB, 'notes')
  const noteId = parseInt(c.req.param('id'), 10)
  const attachmentId = parseInt(c.req.param('attachmentId'), 10)

  const [attachment] = await query('get attachment for download', (db) =>
    db.select().from(noteAttachments)
      .where(and(
        eq(noteAttachments.id, attachmentId),
        eq(noteAttachments.note_id, noteId),
        eq(noteAttachments.user_id, userId!),
      ))
      .limit(1)
  )

  if (!attachment) {
    return c.json({ error: '附件不存在' }, 404)
  }

  const object = await c.env.IMAGES_BUCKET.get(attachment.r2_key)
  if (!object) {
    return c.json({ error: '附件文件不存在' }, 404)
  }

  const forceDownload = c.req.query('download') === '1'
  const kind = forceDownload || !INLINE_TYPES.has(attachment.mime_type) ? 'attachment' : 'inline'

  return new Response(object.body, {
    headers: {
      'Content-Type': attachment.mime_type,
      'Content-Disposition': contentDisposition(kind, attachment.filename),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=3600',
    },
  })
})

noteRoutes.use('*', authMiddleware)

// 批量取附件，避免 N+1
async function loadAttachments(
  query: ReturnType<typeof createDB>['query'],
  noteIds: number[]
): Promise<Record<number, ReturnType<typeof attachmentToDict>[]>> {
  const map: Record<number, ReturnType<typeof attachmentToDict>[]> = {}
  if (!noteIds.length) return map

  const rows = await query('get note attachments', (db) =>
    db.select({
      id: noteAttachments.id,
      note_id: noteAttachments.note_id,
      filename: noteAttachments.filename,
      mime_type: noteAttachments.mime_type,
      size: noteAttachments.size,
    }).from(noteAttachments)
      .where(inArray(noteAttachments.note_id, noteIds))
      .orderBy(asc(noteAttachments.id))
  )

  for (const row of rows) {
    if (!map[row.note_id]) map[row.note_id] = []
    map[row.note_id].push(attachmentToDict(row))
  }
  return map
}

// GET / —— 支持 ?q= 关键词、?tag= 标签过滤；all_tags 始终返回全量标签，
// 否则筛选后标签栏会自己把自己筛没
noteRoutes.get('/', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'notes')

  const keyword = (c.req.query('q') || '').trim()
  const tag = (c.req.query('tag') || '').trim()

  const conditions = [eq(notes.user_id, user.id)]
  if (keyword) {
    const pattern = `%${escapeLike(keyword)}%`
    conditions.push(
      or(
        sql`${notes.title} LIKE ${pattern} ESCAPE '\\'`,
        sql`${notes.content} LIKE ${pattern} ESCAPE '\\'`,
        sql`${notes.tags} LIKE ${pattern} ESCAPE '\\'`,
      )!
    )
  }
  if (tag) {
    // 前后补逗号后再匹配 ",tag," —— 否则标签 "work" 会被 "homework" 命中
    conditions.push(sql`(',' || ${notes.tags} || ',') LIKE ${`%,${escapeLike(tag)},%`} ESCAPE '\\'`)
  }

  const items = await query('list notes', (db) =>
    db.select().from(notes)
      .where(and(...conditions))
      .orderBy(desc(notes.pinned), desc(notes.updated_at), desc(notes.id))
  )

  const tagRows = await query('list note tags', (db) =>
    db.select({ tags: notes.tags }).from(notes).where(eq(notes.user_id, user.id))
  )

  const tagCounts = new Map<string, { name: string; count: number }>()
  for (const row of tagRows) {
    for (const name of (row.tags || '').split(',').filter(Boolean)) {
      const key = name.toLowerCase()
      const entry = tagCounts.get(key)
      if (entry) entry.count += 1
      else tagCounts.set(key, { name, count: 1 })
    }
  }

  const attachmentsMap = await loadAttachments(query, items.map(n => n.id))

  return c.json({
    items: items.map(n => noteToDict(n, attachmentsMap[n.id] || [])),
    total: items.length,
    all_tags: [...tagCounts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  })
})

// GET /:id
noteRoutes.get('/:id', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'notes')
  const noteId = parseInt(c.req.param('id'), 10)

  const [note] = await query('get note', (db) =>
    db.select().from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.user_id, user.id)))
      .limit(1)
  )

  if (!note) {
    return c.json({ error: '笔记不存在' }, 404)
  }

  const attachmentsMap = await loadAttachments(query, [noteId])
  return c.json(noteToDict(note, attachmentsMap[noteId] || []))
})

// POST /
noteRoutes.post('/', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'notes')
  const body = await c.req.json<{ title?: string; content?: string; tags?: string[] | string; pinned?: boolean }>()

  const title = (body.title || '').trim()
  if (!title) {
    return c.json({ error: '笔记标题不能为空' }, 400)
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return c.json({ error: `标题不能超过 ${MAX_TITLE_LENGTH} 个字符` }, 400)
  }
  const content = body.content || ''
  if (content.length > MAX_CONTENT_LENGTH) {
    return c.json({ error: `正文不能超过 ${MAX_CONTENT_LENGTH} 个字符` }, 400)
  }

  const now = beijingDatetime()
  const [note] = await query('create note', (db) =>
    db.insert(notes).values({
      user_id: user.id,
      title,
      content,
      tags: normalizeTags(body.tags).join(','),
      pinned: body.pinned ? 1 : 0,
      created_at: now,
      updated_at: now,
    }).returning()
  )

  return c.json(noteToDict(note), 201)
})

// PUT /:id
noteRoutes.put('/:id', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'notes')
  const noteId = parseInt(c.req.param('id'), 10)
  const body = await c.req.json<{ title?: string; content?: string; tags?: string[] | string; pinned?: boolean }>()

  const [existing] = await query('get note for update', (db) =>
    db.select({ id: notes.id }).from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.user_id, user.id)))
      .limit(1)
  )

  if (!existing) {
    return c.json({ error: '笔记不存在' }, 404)
  }

  const title = (body.title || '').trim()
  if (!title) {
    return c.json({ error: '笔记标题不能为空' }, 400)
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return c.json({ error: `标题不能超过 ${MAX_TITLE_LENGTH} 个字符` }, 400)
  }
  const content = body.content || ''
  if (content.length > MAX_CONTENT_LENGTH) {
    return c.json({ error: `正文不能超过 ${MAX_CONTENT_LENGTH} 个字符` }, 400)
  }

  const updates: Partial<typeof notes.$inferInsert> = {
    title,
    content,
    tags: normalizeTags(body.tags).join(','),
    updated_at: beijingDatetime(),
  }
  if (typeof body.pinned === 'boolean') {
    updates.pinned = body.pinned ? 1 : 0
  }

  const [updated] = await query('update note', (db) =>
    db.update(notes).set(updates).where(eq(notes.id, noteId)).returning()
  )

  const attachmentsMap = await loadAttachments(query, [noteId])
  return c.json(noteToDict(updated, attachmentsMap[noteId] || []))
})

// PATCH /:id/pin —— 置顶开关。不动 updated_at，避免置顶把「最近修改」排序搅乱
noteRoutes.patch('/:id/pin', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'notes')
  const noteId = parseInt(c.req.param('id'), 10)
  const body = await c.req.json<{ pinned?: boolean }>()

  if (typeof body.pinned !== 'boolean') {
    return c.json({ error: 'pinned 必须是布尔值' }, 400)
  }

  const [existing] = await query('get note for pin', (db) =>
    db.select({ id: notes.id }).from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.user_id, user.id)))
      .limit(1)
  )

  if (!existing) {
    return c.json({ error: '笔记不存在' }, 404)
  }

  const [updated] = await query('update note pin', (db) =>
    db.update(notes).set({ pinned: body.pinned ? 1 : 0 }).where(eq(notes.id, noteId)).returning()
  )

  return c.json(noteToDict(updated))
})

// DELETE /:id —— 级联删除 R2 对象 + 附件记录
noteRoutes.delete('/:id', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'notes')
  const noteId = parseInt(c.req.param('id'), 10)

  const [existing] = await query('get note for delete', (db) =>
    db.select({ id: notes.id }).from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.user_id, user.id)))
      .limit(1)
  )

  if (!existing) {
    return c.json({ error: '笔记不存在' }, 404)
  }

  const attachments = await query('get attachments for delete', (db) =>
    db.select().from(noteAttachments).where(eq(noteAttachments.note_id, noteId))
  )

  if (attachments.length > 0) {
    await Promise.all(attachments.map(a => c.env.IMAGES_BUCKET.delete(a.r2_key)))
    await query('delete note attachments', (db) =>
      db.delete(noteAttachments).where(eq(noteAttachments.note_id, noteId))
    )
  }

  await query('delete note', (db) =>
    db.delete(notes).where(eq(notes.id, noteId))
  )

  return c.json({ message: '笔记已删除' })
})

// POST /:id/attachments
noteRoutes.post('/:id/attachments', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'notes')
  const noteId = parseInt(c.req.param('id'), 10)

  const [note] = await query('get note for attachment upload', (db) =>
    db.select({ id: notes.id }).from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.user_id, user.id)))
      .limit(1)
  )

  if (!note) {
    return c.json({ error: '笔记不存在' }, 404)
  }

  const existing = await query('count existing attachments', (db) =>
    db.select({ id: noteAttachments.id }).from(noteAttachments)
      .where(eq(noteAttachments.note_id, noteId))
  )

  const formData = await c.req.formData()
  const files: File[] = []
  for (const entry of formData.getAll('files')) {
    if (typeof entry !== 'string' && 'arrayBuffer' in entry) {
      files.push(entry as unknown as File)
    }
  }

  if (!files.length) {
    return c.json({ error: '请选择要上传的文件' }, 400)
  }

  if (existing.length + files.length > MAX_ATTACHMENTS_PER_NOTE) {
    return c.json({ error: `每条笔记最多 ${MAX_ATTACHMENTS_PER_NOTE} 个附件，当前已有 ${existing.length} 个` }, 400)
  }

  // 先整体校验再落盘，避免上传到一半留下半截数据
  const prepared: { file: File; mime: string }[] = []
  for (const file of files) {
    const mime = resolveMimeType(file)
    if (!mime) {
      return c.json({ error: `不支持的文件类型：${file.name}` }, 400)
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      return c.json({ error: `文件 ${file.name} 超过 10MB 限制` }, 400)
    }
    prepared.push({ file, mime })
  }

  const results = []
  for (const { file, mime } of prepared) {
    const ext = ALLOWED_TYPES[mime]
    const r2Key = `notes/${user.id}/${noteId}/${crypto.randomUUID()}.${ext}`

    await c.env.IMAGES_BUCKET.put(r2Key, await file.arrayBuffer(), {
      httpMetadata: { contentType: mime },
    })

    const [record] = await query('create attachment record', (db) =>
      db.insert(noteAttachments).values({
        note_id: noteId,
        user_id: user.id,
        r2_key: r2Key,
        filename: file.name.slice(0, 200),
        mime_type: mime,
        size: file.size,
      }).returning()
    )

    results.push(attachmentToDict(record))
  }

  return c.json(results, 201)
})

// DELETE /:id/attachments/:attachmentId
noteRoutes.delete('/:id/attachments/:attachmentId', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'notes')
  const noteId = parseInt(c.req.param('id'), 10)
  const attachmentId = parseInt(c.req.param('attachmentId'), 10)

  const [attachment] = await query('get attachment for delete', (db) =>
    db.select().from(noteAttachments)
      .where(and(
        eq(noteAttachments.id, attachmentId),
        eq(noteAttachments.note_id, noteId),
        eq(noteAttachments.user_id, user.id),
      ))
      .limit(1)
  )

  if (!attachment) {
    return c.json({ error: '附件不存在' }, 404)
  }

  await c.env.IMAGES_BUCKET.delete(attachment.r2_key)
  await query('delete attachment record', (db) =>
    db.delete(noteAttachments).where(eq(noteAttachments.id, attachmentId))
  )

  return c.json({ message: '附件已删除' })
})
