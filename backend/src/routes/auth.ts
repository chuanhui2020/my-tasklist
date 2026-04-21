import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq, sql } from 'drizzle-orm'
import { users } from '../db/schema'
import { hashPassword, verifyPassword } from '../lib/crypto'
import { generateToken } from '../lib/token'
import { authMiddleware, adminMiddleware } from '../middleware/auth'
import type { Env } from '../types'

export const authRoutes = new Hono<Env>()

// POST /login
authRoutes.post('/login', async (c) => {
  const body = await c.req.json<{ username?: string; password?: string }>()
  const username = (body.username || '').trim()
  const password = body.password || ''

  if (!username || !password) {
    return c.json({ error: '请输入用户名和密码' }, 400)
  }

  const db = drizzle(c.env.DB)
  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1)
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ error: '用户名或密码错误' }, 401)
  }

  const token = await generateToken({ user_id: user.id, role: user.role }, c.env.SECRET_KEY)
  await db.update(users).set({ last_login_at: sql`(datetime('now'))` }).where(eq(users.id, user.id))
  return c.json({
    token,
    user: { id: user.id, username: user.username, role: user.role, created_at: user.created_at, last_login_at: user.last_login_at },
  })
})

// GET /me
authRoutes.get('/me', authMiddleware, async (c) => {
  const u = c.get('user')
  const db = drizzle(c.env.DB)
  const [user] = await db.select().from(users).where(eq(users.id, u.id)).limit(1)
  return c.json({
    user: { id: user.id, username: user.username, role: user.role, created_at: user.created_at, last_login_at: user.last_login_at },
  })
})

// GET /users (admin)
authRoutes.get('/users', authMiddleware, adminMiddleware, async (c) => {
  const db = drizzle(c.env.DB)
  const allUsers = await db.select().from(users).orderBy(users.id)
  return c.json({
    users: allUsers.map(u => ({ id: u.id, username: u.username, role: u.role, created_at: u.created_at, last_login_at: u.last_login_at })),
  })
})

// POST /users (admin)
authRoutes.post('/users', authMiddleware, adminMiddleware, async (c) => {
  const body = await c.req.json<{ username?: string; password?: string; role?: string }>()
  const username = (body.username || '').trim()
  const password = body.password || ''
  const role = body.role || 'user'

  if (!username || !password) {
    return c.json({ error: '用户名和密码不能为空' }, 400)
  }
  if (role !== 'admin' && role !== 'user') {
    return c.json({ error: '角色无效' }, 400)
  }

  const db = drizzle(c.env.DB)
  const [existing] = await db.select().from(users).where(eq(users.username, username)).limit(1)
  if (existing) {
    return c.json({ error: '用户名已存在' }, 400)
  }

  const password_hash = await hashPassword(password)
  const [user] = await db.insert(users).values({ username, password_hash, role }).returning()

  return c.json({
    user: { id: user.id, username: user.username, role: user.role, created_at: user.created_at },
  }, 201)
})

// POST /change-password
authRoutes.post('/change-password', authMiddleware, async (c) => {
  const body = await c.req.json<{ old_password?: string; new_password?: string }>()
  const old_password = body.old_password || ''
  const new_password = body.new_password || ''

  if (!old_password || !new_password) {
    return c.json({ error: '原密码和新密码不能为空' }, 400)
  }
  if (old_password === new_password) {
    return c.json({ error: '新密码不能与原密码相同' }, 400)
  }

  const u = c.get('user')
  const db = drizzle(c.env.DB)
  const [user] = await db.select().from(users).where(eq(users.id, u.id)).limit(1)

  if (!(await verifyPassword(old_password, user.password_hash))) {
    return c.json({ error: '原密码错误' }, 400)
  }

  const password_hash = await hashPassword(new_password)
  await db.update(users).set({ password_hash }).where(eq(users.id, u.id))

  return c.json({ message: '密码修改成功' })
})
