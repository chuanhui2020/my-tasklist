import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import { secureNotes } from '../db/schema'
import { hashPassword, verifyPassword, encryptContent, decryptContent } from '../lib/crypto'
import { authMiddleware } from '../middleware/auth'
import { createDB, beijingDatetime } from '../lib/db'
import type { Env } from '../types'

export const secureNotesRoutes = new Hono<Env>()
secureNotesRoutes.use('*', authMiddleware)

function noteToDict(n: typeof secureNotes.$inferSelect) {
  return { id: n.id, title: n.title, description: n.description || '', created_at: n.created_at, updated_at: n.updated_at }
}

// GET /
secureNotesRoutes.get('/', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'secure-notes')
  const notes = await query('list notes', (db) =>
    db.select().from(secureNotes)
      .where(eq(secureNotes.user_id, user.id))
      .orderBy(desc(secureNotes.created_at))
  )
  return c.json(notes.map(noteToDict))
})

// POST /
secureNotesRoutes.post('/', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'secure-notes')
  const body = await c.req.json<{ title?: string; description?: string; content?: string; password?: string }>()

  if (!body.title?.trim()) return c.json({ error: '标题不能为空' }, 400)
  if (!body.content?.trim()) return c.json({ error: '内容不能为空' }, 400)
  if (!body.password || body.password.length < 4) return c.json({ error: '密码至少4位' }, 400)

  const { encrypted, salt } = await encryptContent(body.content, body.password)
  const pwd_hash = await hashPassword(body.password)

  const [note] = await query('create note', (db) =>
    db.insert(secureNotes).values({
      user_id: user.id,
      title: body.title!.trim(),
      description: (body.description || '').trim(),
      encrypted_content: encrypted,
      salt,
      password_hash: pwd_hash,
    }).returning()
  )

  return c.json(noteToDict(note), 201)
})

// POST /:id/unlock
secureNotesRoutes.post('/:id/unlock', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'secure-notes')
  const noteId = parseInt(c.req.param('id'), 10)
  const body = await c.req.json<{ password?: string }>()

  const [note] = await query('get note for unlock', (db) =>
    db.select().from(secureNotes)
      .where(and(eq(secureNotes.id, noteId), eq(secureNotes.user_id, user.id)))
      .limit(1)
  )
  if (!note) return c.json({ error: '笔记不存在' }, 404)

  if (!(await verifyPassword(body.password || '', note.password_hash))) {
    return c.json({ error: '密码错误' }, 403)
  }

  const content = await decryptContent(note.encrypted_content, body.password!, note.salt)
  return c.json({ ...noteToDict(note), content })
})

// PUT /:id
secureNotesRoutes.put('/:id', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'secure-notes')
  const noteId = parseInt(c.req.param('id'), 10)
  const body = await c.req.json<{ title?: string; description?: string; content?: string; password?: string; new_password?: string }>()

  const [note] = await query('get note for update', (db) =>
    db.select().from(secureNotes)
      .where(and(eq(secureNotes.id, noteId), eq(secureNotes.user_id, user.id)))
      .limit(1)
  )
  if (!note) return c.json({ error: '笔记不存在' }, 404)

  if (!(await verifyPassword(body.password || '', note.password_hash))) {
    return c.json({ error: '密码错误' }, 403)
  }
  if (!body.title?.trim()) return c.json({ error: '标题不能为空' }, 400)
  if (!body.content?.trim()) return c.json({ error: '内容不能为空' }, 400)

  const effectivePassword = (body.new_password && body.new_password.length >= 4) ? body.new_password : body.password!
  const { encrypted, salt } = await encryptContent(body.content, effectivePassword)

  const updates: Record<string, unknown> = {
    title: body.title.trim(),
    description: (body.description || '').trim(),
    encrypted_content: encrypted,
    salt,
    updated_at: beijingDatetime(),
  }
  if (body.new_password && body.new_password.length >= 4) {
    updates.password_hash = await hashPassword(body.new_password)
  }

  await query('update note', (db) =>
    db.update(secureNotes).set(updates).where(eq(secureNotes.id, noteId))
  )
  const [updated] = await query('get updated note', (db) =>
    db.select().from(secureNotes).where(eq(secureNotes.id, noteId)).limit(1)
  )
  return c.json(noteToDict(updated))
})

// DELETE /:id
secureNotesRoutes.delete('/:id', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'secure-notes')
  const noteId = parseInt(c.req.param('id'), 10)

  const [note] = await query('get note for delete', (db) =>
    db.select().from(secureNotes)
      .where(and(eq(secureNotes.id, noteId), eq(secureNotes.user_id, user.id)))
      .limit(1)
  )
  if (!note) return c.json({ error: '笔记不存在' }, 404)

  await query('delete note', (db) =>
    db.delete(secureNotes).where(eq(secureNotes.id, noteId))
  )
  return c.json({ message: '已删除' })
})
