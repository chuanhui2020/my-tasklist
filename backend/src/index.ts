import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from './types'
import { D1Error } from './lib/db'
import { drizzle } from 'drizzle-orm/d1'
import { sql } from 'drizzle-orm'
import { authMiddleware, adminMiddleware } from './middleware/auth'
import { authRoutes } from './routes/auth'
import { taskRoutes } from './routes/tasks'
import { fortuneRoutes, processImageJob, markImageFailed } from './routes/fortune'
import type { FortuneImageJob } from './types'
import { bmiRoutes } from './routes/bmi'
import { secureNotesRoutes } from './routes/secure-notes'
import { countdownRoutes } from './routes/countdowns'
import { menuRoutes } from './routes/menu'
import { financeRoutes } from './routes/finance'

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
app.route('/api/finance', financeRoutes)

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', version: '1.2.0' })
})

// AI service diagnostic (admin only)
app.get('/api/debug/ai', authMiddleware, adminMiddleware, async (c) => {
  const start = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(`${c.env.AI_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: c.env.AI_MODEL,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 5,
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    const text = await response.text()
    const result: Record<string, unknown> = {
      ok: response.status === 200,
      status: response.status,
      latency_ms: Date.now() - start,
      model: c.env.AI_MODEL,
      base_url: c.env.AI_BASE_URL,
    }
    try {
      const data = JSON.parse(text) as { error?: { message?: string }; choices?: { message?: { content?: string } }[] }
      if (response.ok) {
        result.reply = data.choices?.[0]?.message?.content ?? ''
      } else {
        result.error_message = data.error?.message ?? 'unknown error'
      }
    } catch {
      result.error_message = text.slice(0, 200)
    }
    return c.json(result)
  } catch (e) {
    clearTimeout(timeout)
    const msg = String(e).includes('abort') ? 'timeout (10s)' : String(e)
    return c.json({
      ok: false,
      latency_ms: Date.now() - start,
      error: msg,
      model: c.env.AI_MODEL,
      base_url: c.env.AI_BASE_URL,
    }, 500)
  }
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

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: { DB: D1Database }) {
    const db = drizzle(env.DB)
    await db.run(sql`SELECT 1`)
  },
  // Queue 消费者：生图任务在这里跑（15min wall-time，可安全等待 ~125s 的生图请求）
  async queue(batch: MessageBatch<FortuneImageJob>, env: Env['Bindings']) {
    for (const message of batch.messages) {
      try {
        await processImageJob(env, message.body)
        message.ack()
      } catch (e) {
        console.error('queue image job failed:', String(e).slice(0, 200))
        // 重试耗尽（attempts 从 1 计）则置 failed，避免永久卡在 generating
        if (message.attempts >= 3) {
          await markImageFailed(env, message.body)
          message.ack()
        } else {
          message.retry()
        }
      }
    }
  },
}
