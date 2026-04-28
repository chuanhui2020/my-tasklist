import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from './types'
import { D1Error } from './lib/db'
import { authRoutes } from './routes/auth'
import { taskRoutes } from './routes/tasks'
import { fortuneRoutes } from './routes/fortune'
import { bmiRoutes } from './routes/bmi'
import { secureNotesRoutes } from './routes/secure-notes'
import { countdownRoutes } from './routes/countdowns'
import { menuRoutes } from './routes/menu'

const app = new Hono<Env>()

// CORS
app.use('*', async (c, next) => {
  const origins = c.env.CORS_ORIGINS?.split(',').map(s => s.trim()) || ['https://tasklist.ch-tools.org']
  const corsMiddleware = cors({
    origin: origins,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  })
  return corsMiddleware(c, next)
})

// Routes
app.route('/api/auth', authRoutes)
app.route('/api/tasks', taskRoutes)
app.route('/api/fortune', fortuneRoutes)
app.route('/api/bmi', bmiRoutes)
app.route('/api/secure-notes', secureNotesRoutes)
app.route('/api/countdowns', countdownRoutes)
app.route('/api/menu', menuRoutes)

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', version: '1.2.0' })
})

// Global error handler
app.onError((err, c) => {
  if (err instanceof D1Error) {
    return c.json({ error: '数据库操作失败', detail: err.message }, 500)
  }
  console.error('Unhandled error:', err)
  const detail = String(err.message || err).slice(0, 200)
  return c.json({ error: '服务器内部错误', detail }, 500)
})

// 404
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404)
})

export default app
