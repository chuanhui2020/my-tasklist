<template>
  <div class="finance-page">
    <!-- Background patterns -->
    <div class="background-patterns">
      <div class="pattern pattern-1"></div>
      <div class="pattern pattern-2"></div>
    </div>

    <!-- Lock Screen -->
    <transition name="lock-fade">
      <div v-if="locked" class="lock-overlay">
        <div class="lock-content">
          <div class="lock-icon" :class="{ unlocking: unlockingAnim }">
            <el-icon :size="60"><Lock v-if="!unlockingAnim" /><Unlock v-else /></el-icon>
          </div>
          <h2 class="lock-title">财务管理</h2>

          <!-- Set password form -->
          <div v-if="!hasPassword" class="lock-form">
            <p class="lock-hint">首次使用，请设置财务密码</p>
            <el-input v-model="setForm.password" type="password" placeholder="设置密码（至少4位）" show-password size="large" class="lock-input" @keyup.enter="$refs.confirmInput?.focus()" />
            <el-input ref="confirmInput" v-model="setForm.confirm" type="password" placeholder="确认密码" show-password size="large" class="lock-input" @keyup.enter="handleSetPassword" />
            <el-button type="primary" size="large" class="lock-btn" :loading="loading" @click="handleSetPassword">设置密码</el-button>
          </div>

          <!-- Verify password form -->
          <div v-else class="lock-form">
            <el-input ref="passwordInput" v-model="verifyPassword" type="password" placeholder="输入财务密码" show-password size="large" class="lock-input" :class="{ shake: shakeInput }" @keyup.enter="handleVerify" />
            <el-button type="primary" size="large" class="lock-btn" :loading="loading" @click="handleVerify">解锁访问</el-button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Lock warning bar -->
    <transition name="warn-slide">
      <div v-if="showLockWarning && !locked" class="lock-warning-bar">
        即将锁定，移动鼠标保持活跃（{{ lockCountdown }}s）
      </div>
    </transition>

    <!-- Main Content -->
    <div v-show="!locked" class="finance-main">
      <!-- Header -->
      <div class="finance-header">
        <h1 class="finance-title">财务管理</h1>
        <div class="header-actions">
          <el-button plain size="small" @click="handleExport">导出</el-button>
          <el-button plain size="small" @click="changePwdVisible = true">修改密码</el-button>
        </div>
      </div>

      <!-- Summary Cards -->
      <div class="summary-cards">
        <div class="summary-card card-cyan">
          <div class="card-accent"></div>
          <div class="card-body">
            <div class="card-icon"><el-icon :size="24"><Coin /></el-icon></div>
            <div class="card-info">
              <div class="card-value">¥{{ formatMoney(summary.total_remaining) }}</div>
              <div class="card-label">贷款余额 · {{ summary.active_count }}笔</div>
            </div>
          </div>
        </div>
        <div class="summary-card card-amber">
          <div class="card-accent"></div>
          <div class="card-body">
            <div class="card-icon"><el-icon :size="24"><Calendar /></el-icon></div>
            <div class="card-info">
              <div class="card-value">¥{{ formatMoney(summary.monthly_payment) }}</div>
              <div class="card-label">本月应还</div>
            </div>
          </div>
        </div>
        <div class="summary-card card-green">
          <div class="card-accent"></div>
          <div class="card-body">
            <div class="card-icon"><el-icon :size="24"><CircleCheck /></el-icon></div>
            <div class="card-info">
              <div class="card-value">¥{{ formatMoney(summary.total_paid) }}</div>
              <div class="card-label">已还总额</div>
            </div>
          </div>
        </div>
        <div class="summary-card card-purple">
          <div class="card-accent"></div>
          <div class="card-body">
            <div class="card-icon"><el-icon :size="24"><TrendCharts /></el-icon></div>
            <div class="card-info">
              <div class="card-value">¥{{ formatMoney(summary.total_paid_interest) }}</div>
              <div class="card-label">已付利息</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="loan-tabs">
        <button v-for="tab in tabs" :key="tab.key" class="tab-btn" :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">
          {{ tab.label }}({{ tab.count }})
        </button>
      </div>

      <!-- Loan Cards -->
      <div class="loan-grid">
        <transition-group name="card-list">
          <div v-for="loan in filteredLoans" :key="loan.id" class="loan-card" :class="[loan.loan_type, loan.status]">
            <div class="loan-accent"></div>
            <div class="loan-body">
              <div class="loan-header">
                <span class="loan-type-icon">{{ loan.loan_type === 'mortgage' ? '🏠' : '🏦' }}</span>
                <span class="loan-name">{{ loan.name }}</span>
                <span class="loan-bank">{{ loan.bank }}</span>
                <span class="loan-method-badge">{{ loan.repayment_method === 'equal_installment' ? '等额本息' : '等额本金' }}</span>
              </div>
              <div class="loan-amounts">
                <div class="amount-item"><span class="amount-label">贷款</span><span class="amount-value">¥{{ formatMoney(loan.principal) }}</span></div>
                <div class="amount-item"><span class="amount-label">月供</span><span class="amount-value highlight">¥{{ formatMoney(loan.monthly_payment) }}</span></div>
                <div class="amount-item"><span class="amount-label">余额</span><span class="amount-value">¥{{ formatMoney(loan.remaining_principal) }}</span></div>
              </div>
              <div class="loan-progress">
                <div class="progress-bar">
                  <div class="progress-fill" :style="{ width: loan.progress + '%' }"></div>
                </div>
                <span class="progress-text">还款进度 {{ loan.progress }}% ({{ loan.paid_months }}/{{ loan.total_months }}期)</span>
              </div>
              <div class="loan-meta">
                <span>📅 {{ loan.start_date.slice(0, 7) }} 起</span>
                <span>利率 {{ loan.annual_rate }}%/年</span>
                <span>剩余 {{ loan.remaining_months }}期</span>
              </div>
              <div class="loan-actions">
                <el-button size="small" plain @click="openSchedule(loan)">还款计划</el-button>
                <el-button size="small" plain @click="openPrepay(loan)">提前还款模拟</el-button>
                <el-button v-if="loan.status === 'active'" size="small" type="primary" plain @click="handlePay(loan)">本月已还</el-button>
                <el-dropdown trigger="click" @command="(cmd) => handleMore(cmd, loan)">
                  <el-button size="small" plain>更多</el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="edit">编辑</el-dropdown-item>
                      <el-dropdown-item v-if="loan.status === 'active'" command="settle">标记结清</el-dropdown-item>
                      <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
          </div>
        </transition-group>
      </div>

      <!-- Add button -->
      <div class="add-loan-area">
        <el-button type="primary" size="large" @click="openLoanForm()">+ 新建贷款</el-button>
      </div>
    </div>

    <!-- Loan Form Dialog -->
    <el-dialog v-model="formVisible" :title="editingLoan ? '编辑贷款' : '新建贷款'" width="520px" class="glass-dialog" destroy-on-close>
      <el-form :model="loanForm" label-width="100px" label-position="top">
        <el-form-item label="贷款名称">
          <el-input v-model="loanForm.name" placeholder="如：首套房贷" />
        </el-form-item>
        <el-form-item label="贷款银行">
          <el-input v-model="loanForm.bank" placeholder="如：招商银行" />
        </el-form-item>
        <el-form-item label="贷款类型">
          <el-radio-group v-model="loanForm.loan_type">
            <el-radio value="mortgage">🏠 房贷</el-radio>
            <el-radio value="bank_loan">🏦 银行贷款</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="贷款总额（元）">
          <el-input-number v-model="loanForm.principal" :min="1000" :step="10000" :controls="false" style="width: 100%" />
        </el-form-item>
        <el-form-item label="年利率（%）">
          <el-input-number v-model="loanForm.annual_rate" :min="0" :step="0.01" :precision="2" :controls="false" style="width: 100%" />
        </el-form-item>
        <el-form-item label="贷款期限">
          <el-select v-model="loanForm.total_months" style="width: 100%" placeholder="选择期限">
            <el-option :value="60" label="5年 (60期)" />
            <el-option :value="120" label="10年 (120期)" />
            <el-option :value="180" label="15年 (180期)" />
            <el-option :value="240" label="20年 (240期)" />
            <el-option :value="300" label="25年 (300期)" />
            <el-option :value="360" label="30年 (360期)" />
          </el-select>
        </el-form-item>
        <el-form-item label="还款方式">
          <el-radio-group v-model="loanForm.repayment_method">
            <el-radio value="equal_installment">等额本息（月供固定）</el-radio>
            <el-radio value="equal_principal">等额本金（月供递减）</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="首次还款月">
          <el-date-picker v-model="loanForm.start_date" type="month" placeholder="选择月份" format="YYYY-MM" value-format="YYYY-MM" style="width: 100%" />
        </el-form-item>
        <el-form-item label="已还期数">
          <el-input-number v-model="loanForm.paid_months" :min="0" :max="loanForm.total_months" :controls="true" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="loanForm.notes" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
        <div v-if="loanForm.principal > 0 && loanForm.annual_rate >= 0 && loanForm.total_months > 0" class="form-preview">
          预计月供：¥{{ formatMoney(calcPreviewPayment()) }}
        </div>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="formLoading" @click="handleSaveLoan">保存</el-button>
      </template>
    </el-dialog>

    <!-- Schedule Dialog -->
    <el-dialog v-model="scheduleVisible" :title="scheduleLoan?.name + ' - 还款计划表'" width="700px" class="glass-dialog" destroy-on-close>
      <div v-if="scheduleData" class="schedule-content">
        <div class="schedule-summary">
          ¥{{ formatMoney(scheduleData.principal) }} | {{ scheduleData.annual_rate }}%/年 | {{ scheduleData.repayment_method === 'equal_installment' ? '等额本息' : '等额本金' }} | {{ scheduleData.total_months }}期
        </div>
        <el-table :data="scheduleData.schedule" height="400" :row-class-name="scheduleRowClass" size="small">
          <el-table-column prop="month" label="期数" width="70" align="center">
            <template #default="{ row }">
              <span :class="{ 'current-month': row.month === scheduleData.paid_months + 1 }">
                {{ row.month }}{{ row.month === scheduleData.paid_months + 1 ? ' ←' : '' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="payment" label="月供" width="110" align="right">
            <template #default="{ row }">¥{{ row.payment.toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="principal" label="本金" width="110" align="right">
            <template #default="{ row }"><span class="col-cyan">¥{{ row.principal.toFixed(2) }}</span></template>
          </el-table-column>
          <el-table-column prop="interest" label="利息" width="110" align="right">
            <template #default="{ row }"><span class="col-amber">¥{{ row.interest.toFixed(2) }}</span></template>
          </el-table-column>
          <el-table-column prop="remaining" label="剩余本金" align="right">
            <template #default="{ row }">¥{{ formatMoney(row.remaining) }}</template>
          </el-table-column>
        </el-table>
        <div class="schedule-footer">
          总还款 ¥{{ formatMoney(scheduleData.total_payment) }} | 总利息 ¥{{ formatMoney(scheduleData.total_interest) }} | 利息占比 {{ scheduleData.interest_ratio }}%
        </div>
      </div>
    </el-dialog>

    <!-- Prepay Simulation Dialog -->
    <el-dialog v-model="prepayVisible" :title="'提前还款模拟 - ' + (prepayLoan?.name || '')" width="560px" class="glass-dialog" destroy-on-close>
      <div v-if="prepayLoan" class="prepay-content">
        <div class="prepay-current">
          当前状态：余额 ¥{{ formatMoney(prepayLoan.remaining_principal) }} | 剩余 {{ prepayLoan.remaining_months }}期 | 月供 ¥{{ formatMoney(prepayLoan.monthly_payment) }}
        </div>
        <el-form label-position="top">
          <el-form-item label="提前还款金额（元）">
            <el-input-number v-model="prepayForm.amount" :min="1000" :step="10000" :max="prepayLoan.remaining_principal - 1" :controls="false" style="width: 100%" @change="debouncedSimulate" />
          </el-form-item>
          <el-form-item label="还款方式">
            <el-radio-group v-model="prepayForm.mode" @change="debouncedSimulate">
              <el-radio value="shorten">缩短年限（月供不变）</el-radio>
              <el-radio value="reduce">减少月供（期限不变）</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>
        <div v-if="prepayResult" class="prepay-compare">
          <div class="compare-card original">
            <div class="compare-title">原方案</div>
            <div class="compare-item">月供 ¥{{ formatMoney(prepayResult.original.monthly_payment) }}</div>
            <div class="compare-item">剩余 {{ prepayResult.original.remaining_months }}期</div>
            <div class="compare-item">总利息 ¥{{ formatMoney(prepayResult.original.total_interest) }}</div>
          </div>
          <div class="compare-arrow">→</div>
          <div class="compare-card after">
            <div class="compare-title">新方案</div>
            <div class="compare-item">月供 ¥{{ formatMoney(prepayResult.after_prepay.monthly_payment) }}</div>
            <div class="compare-item">剩余 {{ prepayResult.after_prepay.remaining_months }}期</div>
            <div class="compare-item">总利息 ¥{{ formatMoney(prepayResult.after_prepay.total_interest) }}</div>
          </div>
        </div>
        <div v-if="prepayResult" class="prepay-saved">
          节省利息：<span class="saved-amount">¥{{ formatMoney(prepayResult.saved_interest) }}</span>
        </div>
        <p class="prepay-note">仅模拟计算，不实际操作</p>
      </div>
    </el-dialog>

    <!-- Change Finance Password Dialog -->
    <el-dialog v-model="changePwdVisible" title="修改财务密码" width="400px" class="glass-dialog" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="旧密码">
          <el-input v-model="changePwdForm.old_password" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="changePwdForm.new_password" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="changePwdVisible = false">取消</el-button>
        <el-button type="primary" :loading="changePwdLoading" @click="handleChangePassword">确认修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Lock, Unlock, Coin, Calendar, CircleCheck, TrendCharts } from '@element-plus/icons-vue'
import api from '@/api'

const LOCK_TIMEOUT = 10 * 60 * 1000
const WARN_BEFORE = 30 * 1000

const locked = ref(true)
const hasPassword = ref(false)
const loading = ref(false)
const unlockingAnim = ref(false)
const shakeInput = ref(false)
const showLockWarning = ref(false)
const lockCountdown = ref(30)

const verifyPassword = ref('')
const setForm = ref({ password: '', confirm: '' })
const passwordInput = ref(null)

const loans = ref([])
const summary = ref({ total_remaining: 0, monthly_payment: 0, total_paid: 0, total_paid_interest: 0, active_count: 0, settled_count: 0 })
const activeTab = ref('all')

const formVisible = ref(false)
const formLoading = ref(false)
const editingLoan = ref(null)
const loanForm = ref(getEmptyForm())

const scheduleVisible = ref(false)
const scheduleLoan = ref(null)
const scheduleData = ref(null)

const prepayVisible = ref(false)
const prepayLoan = ref(null)
const prepayForm = ref({ amount: 50000, mode: 'reduce' })
const prepayResult = ref(null)

const changePwdVisible = ref(false)
const changePwdForm = ref({ old_password: '', new_password: '' })
const changePwdLoading = ref(false)

let inactivityTimer = null
let warnTimer = null
let countdownInterval = null
let hiddenAt = null
let debounceTimer = null

function getEmptyForm() {
  return { name: '', bank: '', loan_type: 'mortgage', principal: 500000, annual_rate: 3.45, total_months: 360, repayment_method: 'equal_installment', start_date: '', paid_months: 0, notes: '' }
}

function formatMoney(val) {
  if (val == null) return '0'
  if (Math.abs(val) >= 10000) return (val / 10000).toFixed(1).replace(/\.0$/, '') + '万'
  return val.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

function calcPreviewPayment() {
  const P = loanForm.value.principal
  const r = loanForm.value.annual_rate / 100 / 12
  const n = loanForm.value.total_months
  if (!P || !n) return 0
  if (loanForm.value.repayment_method === 'equal_installment') {
    if (r <= 0) return P / n
    return P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)
  }
  return P / n + P * r
}

const tabs = computed(() => {
  const all = loans.value
  return [
    { key: 'all', label: '全部', count: all.length },
    { key: 'mortgage', label: '房贷', count: all.filter(l => l.loan_type === 'mortgage' && l.status === 'active').length },
    { key: 'bank_loan', label: '银行贷款', count: all.filter(l => l.loan_type === 'bank_loan' && l.status === 'active').length },
    { key: 'settled', label: '已结清', count: all.filter(l => l.status === 'settled').length },
  ]
})

const filteredLoans = computed(() => {
  if (activeTab.value === 'all') return loans.value
  if (activeTab.value === 'settled') return loans.value.filter(l => l.status === 'settled')
  return loans.value.filter(l => l.loan_type === activeTab.value && l.status === 'active')
})

// --- Lock mechanism ---
function resetTimer() {
  showLockWarning.value = false
  clearTimeout(inactivityTimer)
  clearTimeout(warnTimer)
  clearInterval(countdownInterval)

  warnTimer = setTimeout(() => {
    showLockWarning.value = true
    lockCountdown.value = 30
    countdownInterval = setInterval(() => {
      lockCountdown.value--
      if (lockCountdown.value <= 0) clearInterval(countdownInterval)
    }, 1000)
  }, LOCK_TIMEOUT - WARN_BEFORE)

  inactivityTimer = setTimeout(() => { lockPage() }, LOCK_TIMEOUT)
}

function lockPage() {
  locked.value = true
  loans.value = []
  summary.value = { total_remaining: 0, monthly_payment: 0, total_paid: 0, total_paid_interest: 0, active_count: 0, settled_count: 0 }
  showLockWarning.value = false
  clearTimeout(inactivityTimer)
  clearTimeout(warnTimer)
  clearInterval(countdownInterval)
  verifyPassword.value = ''
}

function unlockPage() {
  unlockingAnim.value = true
  setTimeout(() => {
    locked.value = false
    unlockingAnim.value = false
    resetTimer()
    fetchData()
  }, 400)
}

function handleVisibility() {
  if (document.hidden) {
    hiddenAt = Date.now()
  } else if (hiddenAt && !locked.value) {
    if (Date.now() - hiddenAt >= LOCK_TIMEOUT) lockPage()
    hiddenAt = null
  }
}

const activityEvents = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click']

onMounted(async () => {
  activityEvents.forEach(e => document.addEventListener(e, resetTimer, { passive: true }))
  document.addEventListener('visibilitychange', handleVisibility)
  try {
    const { data } = await api.getFinancePasswordStatus()
    hasPassword.value = data.hasPassword
  } catch { /* ignore */ }
  await nextTick()
  passwordInput.value?.focus()
})

onUnmounted(() => {
  activityEvents.forEach(e => document.removeEventListener(e, resetTimer))
  document.removeEventListener('visibilitychange', handleVisibility)
  clearTimeout(inactivityTimer)
  clearTimeout(warnTimer)
  clearInterval(countdownInterval)
})

// --- Auth ---
async function handleSetPassword() {
  if (!setForm.value.password || setForm.value.password.length < 4) {
    return ElMessage.warning('密码至少4位')
  }
  if (setForm.value.password !== setForm.value.confirm) {
    return ElMessage.warning('两次密码不一致')
  }
  loading.value = true
  try {
    await api.setFinancePassword({ password: setForm.value.password })
    hasPassword.value = true
    ElMessage.success('密码设置成功')
    verifyPassword.value = setForm.value.password
    await handleVerify()
  } catch { /* handled by interceptor */ }
  finally { loading.value = false }
}

async function handleVerify() {
  if (!verifyPassword.value) return ElMessage.warning('请输入密码')
  loading.value = true
  try {
    await api.verifyFinancePassword({ password: verifyPassword.value })
    unlockPage()
  } catch {
    shakeInput.value = true
    setTimeout(() => { shakeInput.value = false }, 500)
  } finally { loading.value = false }
}

async function handleChangePassword() {
  if (!changePwdForm.value.old_password || !changePwdForm.value.new_password) {
    return ElMessage.warning('请填写完整')
  }
  if (changePwdForm.value.new_password.length < 4) {
    return ElMessage.warning('新密码至少4位')
  }
  changePwdLoading.value = true
  try {
    await api.changeFinancePassword(changePwdForm.value)
    ElMessage.success('密码修改成功')
    changePwdVisible.value = false
    changePwdForm.value = { old_password: '', new_password: '' }
  } catch { /* handled */ }
  finally { changePwdLoading.value = false }
}

// --- Data ---
async function fetchData() {
  try {
    const [loansRes, summaryRes] = await Promise.all([api.getLoans(), api.getFinanceSummary()])
    loans.value = loansRes.data
    summary.value = summaryRes.data
  } catch { /* handled */ }
}

// --- Loan CRUD ---
function openLoanForm(loan = null) {
  editingLoan.value = loan
  loanForm.value = loan ? { ...loan } : getEmptyForm()
  formVisible.value = true
}

async function handleSaveLoan() {
  const f = loanForm.value
  if (!f.name?.trim() || !f.bank?.trim() || !f.start_date) {
    return ElMessage.warning('请填写必要信息')
  }
  formLoading.value = true
  try {
    if (editingLoan.value) {
      await api.updateLoan(editingLoan.value.id, f)
      ElMessage.success('更新成功')
    } else {
      await api.createLoan(f)
      ElMessage.success('创建成功')
    }
    formVisible.value = false
    await fetchData()
  } catch { /* handled */ }
  finally { formLoading.value = false }
}

async function handlePay(loan) {
  try {
    await ElMessageBox.confirm(`确认记录「${loan.name}」本月已还款？`, '确认', { type: 'info' })
  } catch { return }
  try {
    await api.payLoan(loan.id)
    ElMessage.success('已记录')
    await fetchData()
  } catch { /* handled */ }
}

function handleMore(cmd, loan) {
  if (cmd === 'edit') openLoanForm(loan)
  else if (cmd === 'settle') handleSettle(loan)
  else if (cmd === 'delete') handleDelete(loan)
}

async function handleSettle(loan) {
  try {
    await ElMessageBox.confirm(`确认标记「${loan.name}」为已结清？`, '确认', { type: 'warning' })
  } catch { return }
  try {
    await api.settleLoan(loan.id)
    ElMessage.success('已结清')
    await fetchData()
  } catch { /* handled */ }
}

async function handleDelete(loan) {
  try {
    await ElMessageBox.confirm(`确认删除「${loan.name}」？此操作不可恢复。`, '删除', { type: 'error', confirmButtonText: '删除', confirmButtonClass: 'el-button--danger' })
  } catch { return }
  try {
    await api.deleteLoan(loan.id)
    ElMessage.success('已删除')
    await fetchData()
  } catch { /* handled */ }
}

// --- Schedule ---
async function openSchedule(loan) {
  scheduleLoan.value = loan
  scheduleVisible.value = true
  try {
    const { data } = await api.getLoanSchedule(loan.id)
    scheduleData.value = data
  } catch { /* handled */ }
}

function scheduleRowClass({ row }) {
  if (!scheduleData.value) return ''
  if (row.month <= scheduleData.value.paid_months) return 'row-paid'
  if (row.month === scheduleData.value.paid_months + 1) return 'row-current'
  return ''
}

// --- Prepay simulation ---
function openPrepay(loan) {
  prepayLoan.value = loan
  prepayForm.value = { amount: 50000, mode: 'reduce' }
  prepayResult.value = null
  prepayVisible.value = true
  debouncedSimulate()
}

function debouncedSimulate() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(simulatePrepay, 300)
}

async function simulatePrepay() {
  if (!prepayLoan.value || !prepayForm.value.amount) return
  try {
    const { data } = await api.simulatePrepay(prepayLoan.value.id, prepayForm.value)
    prepayResult.value = data
  } catch { prepayResult.value = null }
}

// --- Export ---
async function handleExport() {
  try {
    const res = await api.exportFinance('csv')
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = 'finance_export.csv'
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch { /* handled */ }
}
</script>

<style scoped>
.finance-page {
  position: relative;
  min-height: 80vh;
  padding: 0 8px;
}

.background-patterns {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}

.pattern {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.2;
  animation: float 10s ease-in-out infinite;
}

.pattern-1 {
  top: 15%;
  left: 10%;
  width: 280px;
  height: 280px;
  background: radial-gradient(circle, rgba(6, 182, 212, 0.6), transparent 70%);
}

.pattern-2 {
  bottom: 10%;
  right: 12%;
  width: 320px;
  height: 320px;
  background: radial-gradient(circle, rgba(212, 167, 6, 0.5), transparent 70%);
  animation-delay: 1.2s;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(20px, -20px); }
}

/* Lock overlay */
.lock-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0e1a;
}

.lock-content {
  text-align: center;
  width: 320px;
}

.lock-icon {
  margin-bottom: 16px;
  color: #d4a706;
  animation: pulse 3s infinite;
  transition: transform 0.4s;
}

.lock-icon.unlocking {
  transform: rotate(15deg) scale(1.1);
  color: #10b981;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(0.95); }
}

.lock-title {
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, #06b6d4, #d4a706);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0 0 24px;
}

.lock-hint {
  color: var(--text-muted, #94a3b8);
  font-size: 14px;
  margin-bottom: 16px;
}

.lock-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lock-input :deep(.el-input__wrapper) {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(212, 167, 6, 0.3);
  border-radius: 12px;
  box-shadow: none;
}

.lock-input :deep(.el-input__wrapper:focus-within) {
  border-color: #d4a706;
  box-shadow: 0 0 12px rgba(212, 167, 6, 0.2);
}

.lock-btn {
  margin-top: 8px;
  border-radius: 12px;
  background: linear-gradient(135deg, #06b6d4, #d4a706);
  border: none;
  font-weight: 600;
}

.lock-btn:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 20px rgba(6, 182, 212, 0.3);
}

.shake {
  animation: shake 0.4s ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}

.lock-fade-enter-active { transition: opacity 0.4s, transform 0.4s; }
.lock-fade-leave-active { transition: opacity 0.3s, transform 0.3s; }
.lock-fade-enter-from { opacity: 0; }
.lock-fade-leave-to { opacity: 0; transform: scale(1.05); }

/* Lock warning */
.lock-warning-bar {
  position: fixed;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999;
  padding: 8px 20px;
  border-radius: 20px;
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.4);
  color: #f59e0b;
  font-size: 13px;
  backdrop-filter: blur(8px);
}

.warn-slide-enter-active, .warn-slide-leave-active { transition: all 0.3s; }
.warn-slide-enter-from, .warn-slide-leave-to { opacity: 0; transform: translateX(-50%) translateY(-10px); }

/* Main content */
.finance-main {
  max-width: 1100px;
  margin: 0 auto;
}

.finance-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.finance-title {
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(to right, #fff, var(--text-secondary, #94a3b8));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 8px;
}

/* Summary cards */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.summary-card {
  position: relative;
  background: var(--bg-glass, rgba(15, 23, 42, 0.6));
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
  border-radius: 14px;
  overflow: hidden;
  transition: all 0.2s;
}

.summary-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.card-accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
}

.card-cyan .card-accent { background: #06b6d4; }
.card-amber .card-accent { background: #f59e0b; }
.card-green .card-accent { background: #10b981; }
.card-purple .card-accent { background: #8b5cf6; }

.card-cyan:hover { border-color: rgba(6, 182, 212, 0.4); box-shadow: 0 0 20px rgba(6, 182, 212, 0.1); }
.card-amber:hover { border-color: rgba(245, 158, 11, 0.4); box-shadow: 0 0 20px rgba(245, 158, 11, 0.1); }
.card-green:hover { border-color: rgba(16, 185, 129, 0.4); box-shadow: 0 0 20px rgba(16, 185, 129, 0.1); }
.card-purple:hover { border-color: rgba(139, 92, 246, 0.4); box-shadow: 0 0 20px rgba(139, 92, 246, 0.1); }

.card-body {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 16px 16px 20px;
}

.card-icon {
  flex-shrink: 0;
  opacity: 0.8;
}

.card-cyan .card-icon { color: #06b6d4; }
.card-amber .card-icon { color: #f59e0b; }
.card-green .card-icon { color: #10b981; }
.card-purple .card-icon { color: #8b5cf6; }

.card-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary, #f1f5f9);
  font-variant-numeric: tabular-nums;
}

.card-label {
  font-size: 12px;
  color: var(--text-muted, #64748b);
  margin-top: 2px;
}

/* Tabs */
.loan-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  padding: 4px;
  background: rgba(15, 23, 42, 0.4);
  border-radius: 10px;
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.06));
}

.tab-btn {
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: var(--text-muted, #64748b);
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.tab-btn:hover { color: var(--text-primary, #f1f5f9); }

.tab-btn.active {
  background: var(--bg-glass, rgba(15, 23, 42, 0.8));
  color: var(--text-primary, #f1f5f9);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
}

/* Loan cards */
.loan-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.loan-card {
  position: relative;
  background: var(--bg-glass, rgba(15, 23, 42, 0.6));
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.2s;
}

.loan-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  border-color: rgba(255, 255, 255, 0.15);
}

.loan-card.settled {
  opacity: 0.6;
}

.loan-accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
}

.loan-card.mortgage .loan-accent { background: #06b6d4; }
.loan-card.bank_loan .loan-accent { background: #f59e0b; }
.loan-card.settled .loan-accent { background: #64748b; }

.loan-body {
  padding: 18px 18px 14px 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.loan-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.loan-type-icon { font-size: 18px; }

.loan-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #f1f5f9);
}

.loan-bank {
  font-size: 12px;
  color: var(--text-muted, #64748b);
}

.loan-method-badge {
  margin-left: auto;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 20px;
  background: rgba(6, 182, 212, 0.12);
  color: #06b6d4;
}

.loan-amounts {
  display: flex;
  gap: 20px;
}

.amount-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.amount-label {
  font-size: 11px;
  color: var(--text-muted, #64748b);
}

.amount-value {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary, #f1f5f9);
  font-variant-numeric: tabular-nums;
}

.amount-value.highlight { color: #06b6d4; }

.loan-progress { display: flex; flex-direction: column; gap: 6px; }

.progress-bar {
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.05);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #06b6d4, #10b981);
  transition: width 0.6s ease;
}

.progress-text {
  font-size: 11px;
  color: var(--text-muted, #64748b);
}

.loan-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-muted, #64748b);
}

.loan-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding-top: 10px;
  border-top: 1px solid var(--glass-border, rgba(255, 255, 255, 0.06));
}

.add-loan-area {
  text-align: center;
  padding: 20px 0 40px;
}

/* Card list transitions */
.card-list-enter-active { transition: all 0.4s ease; }
.card-list-leave-active { transition: all 0.3s ease; }
.card-list-enter-from { opacity: 0; transform: translateY(20px); }
.card-list-leave-to { opacity: 0; transform: scale(0.95); }

/* Schedule dialog */
.schedule-content { display: flex; flex-direction: column; gap: 12px; }

.schedule-summary {
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(6, 182, 212, 0.08);
  border: 1px solid rgba(6, 182, 212, 0.2);
  font-size: 13px;
  color: var(--text-secondary, #cbd5e1);
}

.schedule-footer {
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--bg-glass, rgba(15, 23, 42, 0.6));
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
  font-size: 13px;
  color: var(--text-secondary, #cbd5e1);
  text-align: center;
}

:deep(.row-paid) { color: var(--text-muted, #64748b); background: rgba(0, 0, 0, 0.1); }
:deep(.row-current) { background: rgba(6, 182, 212, 0.1); }
.current-month { color: #06b6d4; font-weight: 700; }
.col-cyan { color: #06b6d4; }
.col-amber { color: #f59e0b; }

/* Prepay dialog */
.prepay-content { display: flex; flex-direction: column; gap: 16px; }

.prepay-current {
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
  font-size: 13px;
  color: var(--text-secondary, #cbd5e1);
}

.prepay-compare {
  display: flex;
  align-items: center;
  gap: 16px;
  justify-content: center;
}

.compare-card {
  flex: 1;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
  background: rgba(15, 23, 42, 0.6);
}

.compare-card.after {
  border-color: rgba(16, 185, 129, 0.4);
  box-shadow: 0 0 16px rgba(16, 185, 129, 0.1);
}

.compare-title {
  font-size: 12px;
  color: var(--text-muted, #64748b);
  margin-bottom: 8px;
}

.compare-item {
  font-size: 14px;
  color: var(--text-primary, #f1f5f9);
  margin-bottom: 4px;
  font-variant-numeric: tabular-nums;
}

.compare-arrow {
  font-size: 20px;
  color: var(--text-muted, #64748b);
  flex-shrink: 0;
}

.prepay-saved {
  text-align: center;
  font-size: 14px;
  color: var(--text-secondary, #cbd5e1);
}

.saved-amount {
  font-size: 22px;
  font-weight: 700;
  color: #10b981;
}

.prepay-note {
  text-align: center;
  font-size: 12px;
  color: var(--text-muted, #64748b);
  margin: 0;
}

/* Form preview */
.form-preview {
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(6, 182, 212, 0.08);
  border: 1px solid rgba(6, 182, 212, 0.2);
  font-size: 14px;
  color: #06b6d4;
  font-weight: 600;
  text-align: center;
}

/* Glass dialog override */
:deep(.glass-dialog .el-dialog) {
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
  border-radius: 16px;
}

:deep(.glass-dialog .el-dialog__header) {
  border-bottom: 1px solid var(--glass-border, rgba(255, 255, 255, 0.06));
}

/* Responsive */
@media (max-width: 1200px) {
  .summary-cards { grid-template-columns: repeat(2, 1fr); }
  .loan-grid { grid-template-columns: 1fr; }
}

@media (max-width: 768px) {
  .summary-cards { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .card-value { font-size: 18px; }
  .loan-grid { grid-template-columns: 1fr; }
  .loan-amounts { flex-wrap: wrap; gap: 12px; }
  .loan-meta { flex-wrap: wrap; gap: 8px; }
  .loan-actions { gap: 6px; }
  .prepay-compare { flex-direction: column; }
  .compare-arrow { transform: rotate(90deg); }
}
</style>
