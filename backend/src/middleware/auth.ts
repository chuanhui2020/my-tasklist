import type { Context, Next } from 'hono'
import { eq } from 'drizzle-orm'
import { verifyToken } from '../lib/token'
import { users } from '../db/schema'
import { createDB } from '../lib/db'
import type { Env } from '../types'

type UserPayload = {
  id: number
  username: string
  role: string
}

// Extend Hono context variables
declare module 'hono' {
  interface ContextVariableMap {
    user: UserPayload
  }
}

export async function authMiddleware(c: Context<Env>, next: Next) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: '未登录或凭证无效' }, 401)
  }

  const token = authHeader.substring(7)
  const payload = await verifyToken(token, c.env.SECRET_KEY)
  if (!payload) {
    return c.json({ error: '登录状态无效，请重新登录' }, 401)
  }

  const { query } = createDB(c.env.DB, 'auth-middleware')
  const [user] = await query('get user by id', (db) =>
    db.select().from(users).where(eq(users.id, payload.user_id)).limit(1)
  )
  if (!user) {
    return c.json({ error: '登录状态无效，请重新登录' }, 401)
  }

  if (user.token_invalid_before && payload.iat) {
    const invalidBefore = Math.floor(new Date(user.token_invalid_before + 'Z').getTime() / 1000)
    if (payload.iat < invalidBefore) {
      return c.json({ error: '登录状态无效，请重新登录' }, 401)
    }
  }

  c.set('user', { id: user.id, username: user.username, role: user.role })
  await next()
}

export async function adminMiddleware(c: Context<Env>, next: Next) {
  const user = c.get('user')
  if (user.role !== 'admin') {
    return c.json({ error: '权限不足' }, 403)
  }
  await next()
}
