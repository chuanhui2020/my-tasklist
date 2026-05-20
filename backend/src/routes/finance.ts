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

// --- Loan calculation utilities ---

interface ScheduleItem {
  month: number
  payment: number
  principal: number
  interest: number
  remaining: number
}

function generateSchedule(
  totalPrincipal: number,
  annualRate: number,
  totalMonths: number,
  method: 'equal_installment' | 'equal_principal'
): ScheduleItem[] {
  const r = annualRate / 100 / 12
  const schedule: ScheduleItem[] = []
  let remaining = totalPrincipal

  if (method === 'equal_installment') {
    const payment = r > 0
      ? totalPrincipal * r * Math.pow(1 + r, totalMonths) / (Math.pow(1 + r, totalMonths) - 1)
      : totalPrincipal / totalMonths
    for (let k = 1; k <= totalMonths; k++) {
      const interest = remaining * r
      const principal = payment - interest
      remaining = Math.max(0, remaining - principal)
      schedule.push({
        month: k,
        payment: Math.round(payment * 100) / 100,
        principal: Math.round(principal * 100) / 100,
        interest: Math.round(interest * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
      })
    }
  } else {
    const monthlyPrincipal = totalPrincipal / totalMonths
    for (let k = 1; k <= totalMonths; k++) {
      const interest = remaining * r
      const payment = monthlyPrincipal + interest
      remaining = Math.max(0, remaining - monthlyPrincipal)
      schedule.push({
        month: k,
        payment: Math.round(payment * 100) / 100,
        principal: Math.round(monthlyPrincipal * 100) / 100,
        interest: Math.round(interest * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
      })
    }
  }
  return schedule
}

function getLoanSummary(loan: typeof loans.$inferSelect) {
  const schedule = generateSchedule(loan.principal, loan.annual_rate, loan.total_months, loan.repayment_method)
  const safePaidMonths = Math.min(Math.max(0, loan.paid_months), schedule.length)
  const currentPayment = schedule[safePaidMonths] || schedule[schedule.length - 1]
  const totalPayment = schedule.reduce((sum, s) => sum + s.payment, 0)
  const totalInterest = totalPayment - loan.principal
  const paidItems = schedule.slice(0, safePaidMonths)
  const paidTotal = paidItems.reduce((sum, s) => sum + s.payment, 0)
  const paidInterest = paidItems.reduce((sum, s) => sum + s.interest, 0)
  const remainingPrincipal = safePaidMonths > 0
    ? schedule[safePaidMonths - 1].remaining
    : loan.principal

  return {
    monthly_payment: currentPayment.payment,
    remaining_principal: Math.round(remainingPrincipal * 100) / 100,
    remaining_months: loan.total_months - loan.paid_months,
    total_payment: Math.round(totalPayment * 100) / 100,
    total_interest: Math.round(totalInterest * 100) / 100,
    paid_total: Math.round(paidTotal * 100) / 100,
    paid_interest: Math.round(paidInterest * 100) / 100,
    progress: Math.round((loan.paid_months / loan.total_months) * 1000) / 10,
  }
}

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

  const loansWithSummary = results.map(loan => ({
    ...loan,
    ...getLoanSummary(loan),
  }))
  return c.json(loansWithSummary)
})

financeRoutes.get('/loans/:id', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'finance')
  const id = parseInt(c.req.param('id'), 10)

  const [loan] = await query('get loan', (db) =>
    db.select().from(loans).where(and(eq(loans.id, id), eq(loans.user_id, user.id))).limit(1)
  )
  if (!loan) return c.json({ error: '贷款不存在' }, 404)

  return c.json({ ...loan, ...getLoanSummary(loan) })
})

financeRoutes.post('/loans', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'finance')
  const body = await c.req.json<{
    name?: string
    bank?: string
    loan_type?: string
    principal?: number
    annual_rate?: number
    total_months?: number
    repayment_method?: string
    start_date?: string
    paid_months?: number
    notes?: string
  }>()

  if (!body.name?.trim()) return c.json({ error: '贷款名称不能为空' }, 400)
  if (!body.bank?.trim()) return c.json({ error: '银行不能为空' }, 400)
  if (!body.loan_type || !['mortgage', 'bank_loan'].includes(body.loan_type)) {
    return c.json({ error: '贷款类型无效' }, 400)
  }
  if (!body.principal || body.principal <= 0) return c.json({ error: '贷款金额必须大于0' }, 400)
  if (body.annual_rate == null || body.annual_rate < 0) return c.json({ error: '利率不能为负' }, 400)
  if (!body.total_months || body.total_months <= 0) return c.json({ error: '贷款期限必须大于0' }, 400)
  if (!body.repayment_method || !['equal_installment', 'equal_principal'].includes(body.repayment_method)) {
    return c.json({ error: '还款方式无效' }, 400)
  }
  if (!body.start_date) return c.json({ error: '首次还款日不能为空' }, 400)

  const paidMonths = body.paid_months || 0
  if (paidMonths < 0 || paidMonths > body.total_months!) {
    return c.json({ error: '已还期数不能超过总期数' }, 400)
  }

  const [loan] = await query('create loan', (db) =>
    db.insert(loans).values({
      user_id: user.id,
      name: body.name!.trim(),
      bank: body.bank!.trim(),
      loan_type: body.loan_type as 'mortgage' | 'bank_loan',
      principal: body.principal!,
      annual_rate: body.annual_rate!,
      total_months: body.total_months!,
      repayment_method: body.repayment_method as 'equal_installment' | 'equal_principal',
      start_date: body.start_date!,
      paid_months: paidMonths,
      notes: body.notes || '',
    }).returning()
  )
  return c.json({ ...loan, ...getLoanSummary(loan) }, 201)
})

financeRoutes.put('/loans/:id', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'finance')
  const id = parseInt(c.req.param('id'), 10)
  const body = await c.req.json<{
    name?: string
    bank?: string
    loan_type?: string
    principal?: number
    annual_rate?: number
    total_months?: number
    repayment_method?: string
    start_date?: string
    paid_months?: number
    prepayment_total?: number
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
  if (body.principal && body.principal > 0) updates.principal = body.principal
  if (body.annual_rate != null && body.annual_rate >= 0) updates.annual_rate = body.annual_rate
  if (body.total_months && body.total_months > 0) updates.total_months = body.total_months
  if (body.repayment_method && ['equal_installment', 'equal_principal'].includes(body.repayment_method)) {
    updates.repayment_method = body.repayment_method
  }
  if (body.start_date) updates.start_date = body.start_date
  if (body.paid_months != null && body.paid_months >= 0) {
    const totalMonths = (updates.total_months as number) || existing.total_months
    if (body.paid_months > totalMonths) {
      return c.json({ error: '已还期数不能超过总期数' }, 400)
    }
    updates.paid_months = body.paid_months
  }
  if (body.prepayment_total != null && body.prepayment_total >= 0) updates.prepayment_total = body.prepayment_total
  if (body.notes != null) updates.notes = body.notes

  await query('update loan', (db) =>
    db.update(loans).set(updates).where(eq(loans.id, id))
  )

  const [updated] = await query('get updated loan', (db) =>
    db.select().from(loans).where(eq(loans.id, id)).limit(1)
  )
  return c.json({ ...updated, ...getLoanSummary(updated) })
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
    db.update(loans).set({ status: 'settled', paid_months: existing.total_months, updated_at: beijingDatetime() }).where(eq(loans.id, id))
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
  if (existing.paid_months >= existing.total_months) {
    return c.json({ error: '已还清所有期数' }, 400)
  }

  const newPaid = existing.paid_months + 1
  const updates: Record<string, unknown> = { paid_months: newPaid, updated_at: beijingDatetime() }
  if (newPaid >= existing.total_months) updates.status = 'settled'

  await query('pay loan', (db) => db.update(loans).set(updates).where(eq(loans.id, id)))

  const [updated] = await query('get updated loan', (db) =>
    db.select().from(loans).where(eq(loans.id, id)).limit(1)
  )
  return c.json({ ...updated, ...getLoanSummary(updated) })
})

// --- Schedule & simulation ---

financeRoutes.get('/loans/:id/schedule', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'finance')
  const id = parseInt(c.req.param('id'), 10)

  const [loan] = await query('get loan', (db) =>
    db.select().from(loans).where(and(eq(loans.id, id), eq(loans.user_id, user.id))).limit(1)
  )
  if (!loan) return c.json({ error: '贷款不存在' }, 404)

  const schedule = generateSchedule(loan.principal, loan.annual_rate, loan.total_months, loan.repayment_method)
  const totalPayment = schedule.reduce((sum, s) => sum + s.payment, 0)
  const totalInterest = totalPayment - loan.principal

  return c.json({
    loan_id: loan.id,
    loan_name: loan.name,
    principal: loan.principal,
    annual_rate: loan.annual_rate,
    total_months: loan.total_months,
    repayment_method: loan.repayment_method,
    paid_months: loan.paid_months,
    schedule,
    total_payment: Math.round(totalPayment * 100) / 100,
    total_interest: Math.round(totalInterest * 100) / 100,
    interest_ratio: Math.round((totalInterest / totalPayment) * 1000) / 10,
  })
})

financeRoutes.post('/loans/:id/prepay-simulate', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'finance')
  const id = parseInt(c.req.param('id'), 10)
  const body = await c.req.json<{ amount?: number; mode?: 'shorten' | 'reduce' }>()

  if (!body.amount || body.amount <= 0) return c.json({ error: '提前还款金额必须大于0' }, 400)
  if (!body.mode || !['shorten', 'reduce'].includes(body.mode)) {
    return c.json({ error: '模式无效，请选择 shorten 或 reduce' }, 400)
  }

  const [loan] = await query('get loan', (db) =>
    db.select().from(loans).where(and(eq(loans.id, id), eq(loans.user_id, user.id))).limit(1)
  )
  if (!loan) return c.json({ error: '贷款不存在' }, 404)

  const originalSchedule = generateSchedule(loan.principal, loan.annual_rate, loan.total_months, loan.repayment_method)
  const remainingPrincipal = loan.paid_months > 0
    ? originalSchedule[loan.paid_months - 1].remaining
    : loan.principal

  if (body.amount >= remainingPrincipal) {
    return c.json({ error: '提前还款金额不能超过剩余本金' }, 400)
  }

  const newPrincipal = remainingPrincipal - body.amount
  const r = loan.annual_rate / 100 / 12
  const remainingMonths = loan.total_months - loan.paid_months

  const originalRemaining = originalSchedule.slice(loan.paid_months)
  const originalTotalPayment = originalRemaining.reduce((sum, s) => sum + s.payment, 0)
  const originalTotalInterest = originalRemaining.reduce((sum, s) => sum + s.interest, 0)

  let newSchedule: ScheduleItem[]
  let newMonthlyPayment: number
  let newRemainingMonths: number

  if (body.mode === 'reduce') {
    newRemainingMonths = remainingMonths
    newSchedule = generateSchedule(newPrincipal, loan.annual_rate, newRemainingMonths, loan.repayment_method)
    newMonthlyPayment = newSchedule[0].payment
  } else {
    if (loan.repayment_method === 'equal_installment') {
      const currentPayment = originalSchedule[loan.paid_months].payment
      newMonthlyPayment = currentPayment
      if (r > 0) {
        newRemainingMonths = Math.ceil(
          -Math.log(1 - (newPrincipal * r) / currentPayment) / Math.log(1 + r)
        )
      } else {
        newRemainingMonths = Math.ceil(newPrincipal / currentPayment)
      }
    } else {
      const currentMonthlyPrincipal = loan.principal / loan.total_months
      newMonthlyPayment = currentMonthlyPrincipal + newPrincipal * r
      newRemainingMonths = Math.ceil(newPrincipal / currentMonthlyPrincipal)
    }
    newSchedule = generateSchedule(newPrincipal, loan.annual_rate, newRemainingMonths, loan.repayment_method)
  }

  const newTotalPayment = newSchedule.reduce((sum, s) => sum + s.payment, 0)
  const newTotalInterest = newSchedule.reduce((sum, s) => sum + s.interest, 0)
  const savedInterest = originalTotalInterest - newTotalInterest

  return c.json({
    prepay_amount: body.amount,
    mode: body.mode,
    original: {
      monthly_payment: originalSchedule[loan.paid_months]?.payment || 0,
      remaining_months: remainingMonths,
      total_interest: Math.round(originalTotalInterest * 100) / 100,
      total_payment: Math.round(originalTotalPayment * 100) / 100,
    },
    after_prepay: {
      monthly_payment: Math.round(newMonthlyPayment * 100) / 100,
      remaining_months: newRemainingMonths,
      total_interest: Math.round(newTotalInterest * 100) / 100,
      total_payment: Math.round((newTotalPayment + body.amount) * 100) / 100,
    },
    saved_interest: Math.round(savedInterest * 100) / 100,
  })
})

// --- Summary & export ---

financeRoutes.get('/summary', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'finance')

  const allLoans = await query('get all loans', (db) =>
    db.select().from(loans).where(eq(loans.user_id, user.id))
  )

  const activeLoans = allLoans.filter(l => l.status === 'active')
  let totalRemaining = 0
  let totalMonthlyPayment = 0
  let totalPaidAmount = 0
  let totalPaidInterest = 0

  for (const loan of activeLoans) {
    const summary = getLoanSummary(loan)
    totalRemaining += summary.remaining_principal
    totalMonthlyPayment += summary.monthly_payment
    totalPaidAmount += summary.paid_total
    totalPaidInterest += summary.paid_interest
  }

  return c.json({
    total_remaining: Math.round(totalRemaining * 100) / 100,
    monthly_payment: Math.round(totalMonthlyPayment * 100) / 100,
    total_paid: Math.round(totalPaidAmount * 100) / 100,
    total_paid_interest: Math.round(totalPaidInterest * 100) / 100,
    active_count: activeLoans.length,
    settled_count: allLoans.length - activeLoans.length,
  })
})

financeRoutes.get('/export', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'finance')
  const format = c.req.query('format') || 'csv'

  const allLoans = await query('get all loans', (db) =>
    db.select().from(loans).where(eq(loans.user_id, user.id))
  )

  if (format === 'json') {
    const data = allLoans.map(loan => ({ ...loan, ...getLoanSummary(loan) }))
    return c.json(data)
  }

  const headers = ['名称', '银行', '类型', '本金', '年利率(%)', '期限(月)', '还款方式', '首次还款日', '已还期数', '月供', '剩余本金', '剩余期数', '状态', '备注']
  const rows = allLoans.map(loan => {
    const summary = getLoanSummary(loan)
    return [
      loan.name,
      loan.bank,
      loan.loan_type === 'mortgage' ? '房贷' : '银行贷款',
      loan.principal.toString(),
      loan.annual_rate.toString(),
      loan.total_months.toString(),
      loan.repayment_method === 'equal_installment' ? '等额本息' : '等额本金',
      loan.start_date,
      loan.paid_months.toString(),
      summary.monthly_payment.toString(),
      summary.remaining_principal.toString(),
      summary.remaining_months.toString(),
      loan.status === 'active' ? '进行中' : '已结清',
      loan.notes || '',
    ].map(v => `"${v.replace(/"/g, '""')}"`).join(',')
  })

  const csv = '﻿' + headers.join(',') + '\n' + rows.join('\n')
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="finance_export.csv"',
    },
  })
})
