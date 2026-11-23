import type { Context, Next } from 'hono'
import { createMiddleware } from 'hono/factory'
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

// 用 createMiddleware 声明：普通函数签名 (c: Context<Env>) 会让 Hono 把同一路由后续 handler 的
// c.req.param() 推断成 string | undefined
export const authMiddleware = createMiddleware<Env>((c, next) => authenticate(c, next, false))

// 仅用于文件直链（<img src> / 新标签页带不了 Authorization 头）：额外接受 ?token=
export const fileAuthMiddleware = createMiddleware<Env>((c, next) => authenticate(c, next, true))

async function authenticate(c: Context<Env>, next: Next, allowQueryToken: boolean) {
  const header = c.req.header('Authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : allowQueryToken && c.req.query('token')
  if (!token) return c.json({ error: '未登录或凭证无效' }, 401)

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

  const version = user.token_invalid_before ?? ''
  // Legacy tokens have no version. Historical cutoffs are SQLite UTC timestamps.
  const matchesVersion = payload.session_version === undefined
    ? !version || (payload.iat ?? 0) > Date.parse(version + 'Z') / 1000
    : payload.session_version === version
  if (!matchesVersion) return c.json({ error: '登录状态无效，请重新登录' }, 401)

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
