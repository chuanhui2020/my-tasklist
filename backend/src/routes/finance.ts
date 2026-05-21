import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { financePasswords, loans } from '../db/schema'
import { hashPassword, verifyPassword } from '../lib/crypto'
import { authMiddleware, adminMiddleware } from '../middleware/auth'
import { createDB, beijingDatetime } from '../lib/db'
import type { Env } from '../types'

export const financeRoutes = new Hono<Env>()
financeRoutes.use('*', authMiddleware)
financeRoutes.use('*', adminMiddleware)

// --- Finance password endpoints ---

financeRoutes.get('/password/status', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'finance')
  const [record] = await query('check finance password', (db) =>
    db.select().from(financePasswords).where(eq(financePasswords.user_id, user.id)).limit(1)
  )
  return c.json({ hasPassword: !!record })
})

financeRoutes.post('/password/set', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'finance')
  const body = await c.req.json<{ password?: string }>()

  if (!body.password || body.password.length < 4) {
    return c.json({ error: '密码至少4位' }, 400)
  }

  const [existing] = await query('check existing', (db) =>
    db.select().from(financePasswords).where(eq(financePasswords.user_id, user.id)).limit(1)
  )
  if (existing) {
    return c.json({ error: '密码已设置，请使用修改密码功能' }, 400)
  }

  const pwd_hash = await hashPassword(body.password)
  await query('set finance password', (db) =>
    db.insert(financePasswords).values({ user_id: user.id, password_hash: pwd_hash })
  )
  return c.json({ success: true }, 201)
})

financeRoutes.post('/password/verify', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'finance')
  const body = await c.req.json<{ password?: string }>()

  if (!body.password) return c.json({ error: '请输入密码' }, 400)

  const [record] = await query('get finance password', (db) =>
    db.select().from(financePasswords).where(eq(financePasswords.user_id, user.id)).limit(1)
  )
  if (!record) return c.json({ error: '未设置财务密码' }, 404)

  if (!(await verifyPassword(body.password, record.password_hash))) {
    return c.json({ error: '密码错误' }, 403)
  }
  return c.json({ verified: true })
})

financeRoutes.put('/password/change', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'finance')
  const body = await c.req.json<{ old_password?: string; new_password?: string }>()

  if (!body.old_password || !body.new_password) {
    return c.json({ error: '请输入旧密码和新密码' }, 400)
  }
  if (body.new_password.length < 4) {
    return c.json({ error: '新密码至少4位' }, 400)
  }

  const [record] = await query('get finance password', (db) =>
    db.select().from(financePasswords).where(eq(financePasswords.user_id, user.id)).limit(1)
  )
  if (!record) return c.json({ error: '未设置财务密码' }, 404)

  if (!(await verifyPassword(body.old_password, record.password_hash))) {
    return c.json({ error: '旧密码错误' }, 403)
  }

  const new_hash = await hashPassword(body.new_password)
  await query('update finance password', (db) =>
    db.update(financePasswords)
      .set({ password_hash: new_hash, updated_at: beijingDatetime() })
      .where(eq(financePasswords.user_id, user.id))
  )
  return c.json({ success: true })
})

// --- Loan CRUD ---

financeRoutes.get('/loans', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'finance')
  const loanType = c.req.query('loan_type')
  const status = c.req.query('status')

  if (loanType && !['mortgage', 'bank_loan'].includes(loanType)) {
    return c.json({ error: '贷款类型无效，可选值：mortgage, bank_loan' }, 400)
  }
  if (status && !['active', 'settled'].includes(status)) {
    return c.json({ error: '状态无效，可选值：active, settled' }, 400)
  }

  const conditions = [eq(loans.user_id, user.id)]
  if (loanType) conditions.push(eq(loans.loan_type, loanType as 'mortgage' | 'bank_loan'))
  if (status) conditions.push(eq(loans.status, status as 'active' | 'settled'))

  const results = await query('list loans', (db) =>
    db.select().from(loans).where(and(...conditions))
  )
  return c.json(results)
})

financeRoutes.get('/loans/:id', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'finance')
  const id = parseInt(c.req.param('id'), 10)

  const [loan] = await query('get loan', (db) =>
    db.select().from(loans).where(and(eq(loans.id, id), eq(loans.user_id, user.id))).limit(1)
  )
  if (!loan) return c.json({ error: '贷款不存在' }, 404)

  return c.json(loan)
})

financeRoutes.post('/loans', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'finance')
  const body = await c.req.json<{
    name?: string
    bank?: string
    loan_type?: string
    remaining_balance?: number
    monthly_payment?: number
    remaining_months?: number
    annual_rate?: number
    notes?: string
  }>()

  if (!body.name?.trim()) return c.json({ error: '贷款名称不能为空' }, 400)
  if (!body.bank?.trim()) return c.json({ error: '银行不能为空' }, 400)
  if (!body.loan_type || !['mortgage', 'bank_loan'].includes(body.loan_type)) {
    return c.json({ error: '贷款类型无效' }, 400)
  }
  if (!body.remaining_balance || body.remaining_balance <= 0) return c.json({ error: '剩余金额必须大于0' }, 400)
  if (!body.monthly_payment || body.monthly_payment <= 0) return c.json({ error: '每月应还必须大于0' }, 400)
  if (!body.remaining_months || body.remaining_months <= 0) return c.json({ error: '剩余月份必须大于0' }, 400)

  const [loan] = await query('create loan', (db) =>
    db.insert(loans).values({
      user_id: user.id,
      name: body.name!.trim(),
      bank: body.bank!.trim(),
      loan_type: body.loan_type as 'mortgage' | 'bank_loan',
      remaining_balance: body.remaining_balance!,
      monthly_payment: body.monthly_payment!,
      remaining_months: body.remaining_months!,
      annual_rate: body.annual_rate || 0,
      notes: body.notes || '',
    }).returning()
  )
  return c.json(loan, 201)
})

financeRoutes.put('/loans/:id', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'finance')
  const id = parseInt(c.req.param('id'), 10)
  const body = await c.req.json<{
    name?: string
    bank?: string
    loan_type?: string
    remaining_balance?: number
    monthly_payment?: number
    remaining_months?: number
    annual_rate?: number
    notes?: string
  }>()

  const [existing] = await query('check loan', (db) =>
    db.select().from(loans).where(and(eq(loans.id, id), eq(loans.user_id, user.id))).limit(1)
  )
  if (!existing) return c.json({ error: '贷款不存在' }, 404)

  const updates: Record<string, unknown> = { updated_at: beijingDatetime() }
  if (body.name?.trim()) updates.name = body.name.trim()
  if (body.bank?.trim()) updates.bank = body.bank.trim()
  if (body.loan_type && ['mortgage', 'bank_loan'].includes(body.loan_type)) updates.loan_type = body.loan_type
  if (body.remaining_balance != null && body.remaining_balance > 0) updates.remaining_balance = body.remaining_balance
  if (body.monthly_payment != null && body.monthly_payment > 0) updates.monthly_payment = body.monthly_payment
  if (body.remaining_months != null && body.remaining_months > 0) updates.remaining_months = body.remaining_months
  if (body.annual_rate != null && body.annual_rate >= 0) updates.annual_rate = body.annual_rate
  if (body.notes != null) updates.notes = body.notes

  await query('update loan', (db) =>
    db.update(loans).set(updates).where(eq(loans.id, id))
  )

  const [updated] = await query('get updated loan', (db) =>
    db.select().from(loans).where(eq(loans.id, id)).limit(1)
  )
  return c.json(updated)
})

financeRoutes.delete('/loans/:id', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'finance')
  const id = parseInt(c.req.param('id'), 10)

  const [existing] = await query('check loan', (db) =>
    db.select().from(loans).where(and(eq(loans.id, id), eq(loans.user_id, user.id))).limit(1)
  )
  if (!existing) return c.json({ error: '贷款不存在' }, 404)

  await query('delete loan', (db) => db.delete(loans).where(eq(loans.id, id)))
  return c.json({ success: true })
})

financeRoutes.patch('/loans/:id/settle', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'finance')
  const id = parseInt(c.req.param('id'), 10)

  const [existing] = await query('check loan', (db) =>
    db.select().from(loans).where(and(eq(loans.id, id), eq(loans.user_id, user.id))).limit(1)
  )
  if (!existing) return c.json({ error: '贷款不存在' }, 404)

  await query('settle loan', (db) =>
    db.update(loans).set({
      status: 'settled',
      remaining_balance: 0,
      remaining_months: 0,
      updated_at: beijingDatetime(),
    }).where(eq(loans.id, id))
  )
  return c.json({ success: true })
})

financeRoutes.patch('/loans/:id/pay', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'finance')
  const id = parseInt(c.req.param('id'), 10)

  const [existing] = await query('check loan', (db) =>
    db.select().from(loans).where(and(eq(loans.id, id), eq(loans.user_id, user.id))).limit(1)
  )
  if (!existing) return c.json({ error: '贷款不存在' }, 404)
  if (existing.remaining_months <= 0) {
    return c.json({ error: '已还清所有期数' }, 400)
  }

  const newBalance = Math.max(0, existing.remaining_balance - existing.monthly_payment)
  const newMonths = existing.remaining_months - 1
  const updates: Record<string, unknown> = {
    remaining_balance: newBalance,
    remaining_months: newMonths,
    updated_at: beijingDatetime(),
  }
  if (newMonths <= 0) updates.status = 'settled'

  await query('pay loan', (db) => db.update(loans).set(updates).where(eq(loans.id, id)))

  const [updated] = await query('get updated loan', (db) =>
    db.select().from(loans).where(eq(loans.id, id)).limit(1)
  )
  return c.json(updated)
})

// --- Elimination plan simulation ---

interface LoanState {
  id: number
  name: string
  balance: number
  monthly: number
  rate: number
}

interface TimelineEntry {
  month: number
  total_remaining: number
  extra_target: string
  cleared: string[]
}

financeRoutes.post('/elimination-plan', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'finance')
  const body = await c.req.json<{ extra_monthly?: number; strategy?: string }>()

  if (!body.extra_monthly || body.extra_monthly <= 0) {
    return c.json({ error: '每月额外还款金额必须大于0' }, 400)
  }
  if (!body.strategy || !['avalanche', 'snowball'].includes(body.strategy)) {
    return c.json({ error: '策略无效，可选值：avalanche, snowball' }, 400)
  }

  const activeLoans = await query('get active loans', (db) =>
    db.select().from(loans).where(and(eq(loans.user_id, user.id), eq(loans.status, 'active')))
  )

  if (activeLoans.length === 0) {
    return c.json({ error: '没有进行中的贷款' }, 400)
  }

  const strategy = body.strategy as 'avalanche' | 'snowball'
  const extraMonthly = body.extra_monthly

  // Simulate with extra payments
  const withExtra = simulate(activeLoans, extraMonthly, strategy)
  // Simulate without extra (baseline)
  const baseline = simulate(activeLoans, 0, strategy)

  const totalInterestSaved = baseline.totalInterest - withExtra.totalInterest

  return c.json({
    strategy,
    extra_monthly: extraMonthly,
    total_months_to_free: withExtra.totalMonths,
    baseline_months_to_free: baseline.totalMonths,
    total_interest_saved: Math.round(totalInterestSaved * 100) / 100,
    loans: withExtra.loanResults.map((l) => {
      const base = baseline.loanResults.find((b) => b.id === l.id)
      return {
        ...l,
        baseline_cleared_at_month: base?.cleared_at_month || 0,
      }
    }),
    timeline: withExtra.timeline,
  })
})

function selectTarget(active: LoanState[], strategy: 'avalanche' | 'snowball'): LoanState {
  if (strategy === 'avalanche') {
    return active.reduce((a, b) => (b.rate > a.rate || (b.rate === a.rate && b.balance < a.balance)) ? b : a)
  }
  return active.reduce((a, b) => (b.balance < a.balance || (b.balance === a.balance && b.rate > a.rate)) ? b : a)
}

function simulate(
  activeLoans: (typeof loans.$inferSelect)[],
  extraMonthly: number,
  strategy: 'avalanche' | 'snowball'
) {
  const interestMap = new Map<number, number>()
  const states: LoanState[] = activeLoans.map((l) => {
    interestMap.set(l.id, 0)
    return { id: l.id, name: l.name, balance: l.remaining_balance, monthly: l.monthly_payment, rate: l.annual_rate }
  })

  const loanResults: { id: number; name: string; cleared_at_month: number; interest_paid: number }[] = []
  const timeline: TimelineEntry[] = []
  let totalInterest = 0
  let month = 0
  let freedPayments = 0
  const maxMonths = 600

  while (states.some((s) => s.balance > 0) && month < maxMonths) {
    month++
    const cleared: string[] = []

    for (const s of states) {
      if (s.balance <= 0) continue
      const monthlyInterest = s.balance * (s.rate / 100 / 12)
      totalInterest += monthlyInterest
      interestMap.set(s.id, (interestMap.get(s.id) || 0) + monthlyInterest)
      s.balance = s.balance + monthlyInterest - s.monthly
      if (s.balance <= 0) {
        freedPayments += s.monthly
        s.balance = 0
        cleared.push(s.name)
        loanResults.push({ id: s.id, name: s.name, cleared_at_month: month, interest_paid: 0 })
      }
    }

    let remaining_extra = extraMonthly + freedPayments
    while (remaining_extra > 0) {
      const active = states.filter((s) => s.balance > 0)
      if (active.length === 0) break

      const target = selectTarget(active, strategy)
      const applied = Math.min(remaining_extra, target.balance)
      target.balance -= applied
      remaining_extra -= applied

      if (target.balance <= 0) {
        target.balance = 0
        if (!cleared.includes(target.name)) {
          freedPayments += target.monthly
          cleared.push(target.name)
          loanResults.push({ id: target.id, name: target.name, cleared_at_month: month, interest_paid: 0 })
        }
      }
    }

    const totalRemaining = states.reduce((sum, s) => sum + s.balance, 0)
    const active = states.filter((s) => s.balance > 0)
    const targetName = active.length > 0 ? selectTarget(active, strategy).name : ''

    if (cleared.length > 0 || month % 3 === 0 || totalRemaining <= 0) {
      timeline.push({
        month,
        total_remaining: Math.round(totalRemaining * 100) / 100,
        extra_target: targetName,
        cleared,
      })
    }
  }

  for (const r of loanResults) {
    r.interest_paid = Math.round((interestMap.get(r.id) || 0) * 100) / 100
  }

  return {
    totalMonths: month,
    totalInterest: Math.round(totalInterest * 100) / 100,
    loanResults,
    timeline,
  }
}

// --- Summary ---

financeRoutes.get('/summary', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'finance')

  const activeLoans = await query('get active loans', (db) =>
    db.select().from(loans).where(and(eq(loans.user_id, user.id), eq(loans.status, 'active')))
  )
  const settledCount = await query('count settled', (db) =>
    db.select().from(loans).where(and(eq(loans.user_id, user.id), eq(loans.status, 'settled')))
  )

  const totalRemaining = activeLoans.reduce((sum, l) => sum + l.remaining_balance, 0)
  const monthlyPayment = activeLoans.reduce((sum, l) => sum + l.monthly_payment, 0)

  return c.json({
    total_remaining: Math.round(totalRemaining * 100) / 100,
    monthly_payment: Math.round(monthlyPayment * 100) / 100,
    active_count: activeLoans.length,
    settled_count: settledCount.length,
  })
})

// --- Export ---

financeRoutes.get('/export', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'finance')
  const format = c.req.query('format') || 'csv'

  const allLoans = await query('get all loans', (db) =>
    db.select().from(loans).where(eq(loans.user_id, user.id))
  )

  if (format === 'json') {
    return c.json(allLoans)
  }

  const headers = ['名称', '银行', '类型', '剩余金额', '每月应还', '剩余月份', '年利率(%)', '状态', '备注']
  const rows = allLoans.map((loan) => {
    return [
      loan.name,
      loan.bank,
      loan.loan_type === 'mortgage' ? '房贷' : '银行贷款',
      loan.remaining_balance.toString(),
      loan.monthly_payment.toString(),
      loan.remaining_months.toString(),
      loan.annual_rate.toString(),
      loan.status === 'active' ? '进行中' : '已结清',
      loan.notes || '',
    ].map((v) => `"${v.replace(/"/g, '""')}"`).join(',')
  })

  const csv = '﻿' + headers.join(',') + '\n' + rows.join('\n')
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="finance_export.csv"',
    },
  })
})
