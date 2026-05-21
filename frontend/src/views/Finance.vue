<template>
  <div class="finance-page">
    <div class="background-patterns">
      <div class="pattern pattern-1"></div>
      <div class="pattern pattern-2"></div>
    </div>

    <transition name="lock-fade">
      <div v-if="locked" class="lock-overlay">
        <div class="lock-content">
          <div class="lock-icon" :class="{ unlocking: unlockingAnim }">
            <el-icon :size="60"><Lock v-if="!unlockingAnim" /><Unlock v-else /></el-icon>
          </div>
          <h2 class="lock-title">贷款消除计划</h2>
          <div v-if="!hasPassword" class="lock-form">
            <p class="lock-hint">首次使用，请设置财务密码</p>
            <el-input v-model="setForm.password" type="password" placeholder="设置密码（至少4位）" show-password size="large" class="lock-input" @keyup.enter="$refs.confirmInput?.focus()" />
            <el-input ref="confirmInput" v-model="setForm.confirm" type="password" placeholder="确认密码" show-password size="large" class="lock-input" @keyup.enter="handleSetPassword" />
            <el-button type="primary" size="large" class="lock-btn" :loading="loading" @click="handleSetPassword">设置密码</el-button>
          </div>
          <div v-else class="lock-form">
            <el-input ref="passwordInput" v-model="verifyPwd" type="password" placeholder="输入财务密码" show-password size="large" class="lock-input" :class="{ shake: shakeInput }" @keyup.enter="handleVerify" />
            <el-button type="primary" size="large" class="lock-btn" :loading="loading" @click="handleVerify">解锁访问</el-button>
          </div>
        </div>
      </div>
    </transition>

    <transition name="warn-slide">
      <div v-if="showLockWarning && !locked" class="lock-warning-bar">
        即将锁定，移动鼠标保持活跃（{{ lockCountdown }}s）
      </div>
    </transition>

    <div v-show="!locked" class="finance-main">
      <div class="finance-header">
        <h1 class="finance-title">贷款消除计划</h1>
        <div class="header-actions">
          <el-button plain size="small" @click="elimVisible = true">消除模拟</el-button>
          <el-button plain size="small" @click="handleExport">导出</el-button>
          <el-button plain size="small" @click="changePwdVisible = true">修改密码</el-button>
        </div>
      </div>

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
              <div class="card-value">{{ summary.settled_count }}笔</div>
              <div class="card-label">已结清</div>
            </div>
          </div>
        </div>
      </div>

      <div class="loan-tabs">
        <button v-for="tab in tabs" :key="tab.key" class="tab-btn" :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">
          {{ tab.label }}({{ tab.count }})
        </button>
      </div>

      <div class="loan-grid">
        <transition-group name="card-list">
          <div v-for="loan in filteredLoans" :key="loan.id" class="loan-card" :class="[loan.loan_type, loan.status]">
            <div class="loan-accent"></div>
            <div class="loan-body">
              <div class="loan-header">
                <span class="loan-type-icon">{{ loan.loan_type === 'mortgage' ? '\U0001f3e0' : '\U0001f3e6' }}</span>
                <span class="loan-name">{{ loan.name }}</span>
                <span class="loan-bank">{{ loan.bank }}</span>
                <span v-if="loan.annual_rate" class="loan-rate-badge">{{ loan.annual_rate }}%/年</span>
              </div>
              <div class="loan-amounts">
                <div class="amount-item"><span class="amount-label">剩余</span><span class="amount-value">¥{{ formatMoney(loan.remaining_balance) }}</span></div>
                <div class="amount-item"><span class="amount-label">月供</span><span class="amount-value highlight">¥{{ formatMoney(loan.monthly_payment) }}</span></div>
                <div class="amount-item"><span class="amount-label">剩余期数</span><span class="amount-value">{{ loan.remaining_months }}个月</span></div>
              </div>
              <div class="loan-actions">
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

      <div class="add-loan-area">
        <el-button type="primary" size="large" @click="openForm()">+ 新建贷款</el-button>
      </div>
    </div>

    <LoanForm v-model="formVisible" :loan="editingLoan" @saved="fetchData" />
    <EliminationPlan v-model="elimVisible" :loans="loanList" />

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
import { Lock, Unlock, Coin, Calendar, CircleCheck } from '@element-plus/icons-vue'
import api from '@/api'
import { formatMoney } from '@/utils/format'
import LoanForm from '@/components/LoanForm.vue'
import EliminationPlan from '@/components/EliminationPlan.vue'

const LOCK_TIMEOUT = 10 * 60 * 1000
const WARN_BEFORE = 30 * 1000

const locked = ref(true)
const hasPassword = ref(false)
const loading = ref(false)
const unlockingAnim = ref(false)
const shakeInput = ref(false)
const showLockWarning = ref(false)
const lockCountdown = ref(30)

const verifyPwd = ref('')
const setForm = ref({ password: '', confirm: '' })
const passwordInput = ref(null)

const loanList = ref([])
const summary = ref({ total_remaining: 0, monthly_payment: 0, active_count: 0, settled_count: 0 })
const activeTab = ref('all')

const formVisible = ref(false)
const editingLoan = ref(null)
const elimVisible = ref(false)

const changePwdVisible = ref(false)
const changePwdForm = ref({ old_password: '', new_password: '' })
const changePwdLoading = ref(false)

let inactivityTimer = null
let warnTimer = null
let countdownInterval = null
let hiddenAt = null
let lastResetTime = 0

const tabs = computed(() => {
  const all = loanList.value
  return [
    { key: 'all', label: '全部', count: all.length },
    { key: 'mortgage', label: '房贷', count: all.filter(l => l.loan_type === 'mortgage' && l.status === 'active').length },
    { key: 'bank_loan', label: '银行贷款', count: all.filter(l => l.loan_type === 'bank_loan' && l.status === 'active').length },
    { key: 'settled', label: '已结清', count: all.filter(l => l.status === 'settled').length },
  ]
})

const filteredLoans = computed(() => {
  if (activeTab.value === 'all') return loanList.value
  if (activeTab.value === 'settled') return loanList.value.filter(l => l.status === 'settled')
  return loanList.value.filter(l => l.loan_type === activeTab.value && l.status === 'active')
})

function resetTimer() {
  const now = Date.now()
  if (now - lastResetTime < 1000) return
  lastResetTime = now
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
  loanList.value = []
  summary.value = { total_remaining: 0, monthly_payment: 0, active_count: 0, settled_count: 0 }
  showLockWarning.value = false
  clearTimeout(inactivityTimer)
  clearTimeout(warnTimer)
  clearInterval(countdownInterval)
  verifyPwd.value = ''
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
  } catch {}
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

async function handleSetPassword() {
  if (!setForm.value.password || setForm.value.password.length < 4) return ElMessage.warning('密码至少4位')
  if (setForm.value.password !== setForm.value.confirm) return ElMessage.warning('两次密码不一致')
  loading.value = true
  try {
    await api.setFinancePassword({ password: setForm.value.password })
    hasPassword.value = true
    ElMessage.success('密码设置成功')
    verifyPwd.value = setForm.value.password
    await handleVerify()
  } catch {}
  finally { loading.value = false }
}

async function handleVerify() {
  if (!verifyPwd.value) return ElMessage.warning('请输入密码')
  loading.value = true
  try {
    await api.verifyFinancePassword({ password: verifyPwd.value })
    unlockPage()
  } catch {
    shakeInput.value = true
    setTimeout(() => { shakeInput.value = false }, 500)
  } finally { loading.value = false }
}

async function handleChangePassword() {
  if (!changePwdForm.value.old_password || !changePwdForm.value.new_password) return ElMessage.warning('请填写完整')
  if (changePwdForm.value.new_password.length < 4) return ElMessage.warning('新密码至少4位')
  changePwdLoading.value = true
  try {
    await api.changeFinancePassword(changePwdForm.value)
    ElMessage.success('密码修改成功')
    changePwdVisible.value = false
    changePwdForm.value = { old_password: '', new_password: '' }
  } catch {}
  finally { changePwdLoading.value = false }
}

async function fetchData() {
  try {
    const [loansRes, summaryRes] = await Promise.all([api.getLoans(), api.getFinanceSummary()])
    loanList.value = loansRes.data
    summary.value = summaryRes.data
  } catch {}
}

function openForm(loan = null) {
  editingLoan.value = loan
  formVisible.value = true
}

async function handlePay(loan) {
  try { await ElMessageBox.confirm(`确认记录「${loan.name}」本月已还款？`, '确认', { type: 'info' }) } catch { return }
  try {
    await api.payLoan(loan.id)
    ElMessage.success('已记录')
    await fetchData()
  } catch {}
}

function handleMore(cmd, loan) {
  if (cmd === 'edit') openForm(loan)
  else if (cmd === 'settle') handleSettle(loan)
  else if (cmd === 'delete') handleDelete(loan)
}

async function handleSettle(loan) {
  try { await ElMessageBox.confirm(`确认标记「${loan.name}」为已结清？`, '确认', { type: 'warning' }) } catch { return }
  try {
    await api.settleLoan(loan.id)
    ElMessage.success('已结清')
    await fetchData()
  } catch {}
}

async function handleDelete(loan) {
  try { await ElMessageBox.confirm(`确认删除「${loan.name}」？此操作不可恢复。`, '删除', { type: 'error', confirmButtonText: '删除', confirmButtonClass: 'el-button--danger' }) } catch { return }
  try {
    await api.deleteLoan(loan.id)
    ElMessage.success('已删除')
    await fetchData()
  } catch {}
}

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
  } catch {}
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

.shake { animation: shake 0.4s ease; }
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}

.lock-fade-enter-active { transition: opacity 0.4s, transform 0.4s; }
.lock-fade-leave-active { transition: opacity 0.3s, transform 0.3s; }
.lock-fade-enter-from { opacity: 0; }
.lock-fade-leave-to { opacity: 0; transform: scale(1.05); }

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

.summary-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
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

.card-cyan:hover { border-color: rgba(6, 182, 212, 0.4); }
.card-amber:hover { border-color: rgba(245, 158, 11, 0.4); }
.card-green:hover { border-color: rgba(16, 185, 129, 0.4); }

.card-body {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 16px 16px 20px;
}

.card-icon { flex-shrink: 0; opacity: 0.8; }
.card-cyan .card-icon { color: #06b6d4; }
.card-amber .card-icon { color: #f59e0b; }
.card-green .card-icon { color: #10b981; }

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

.loan-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
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

.loan-card.settled { opacity: 0.6; }

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
.loan-name { font-size: 16px; font-weight: 600; color: var(--text-primary, #f1f5f9); }
.loan-bank { font-size: 12px; color: var(--text-muted, #64748b); }

.loan-rate-badge {
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

.card-list-enter-active { transition: all 0.4s ease; }
.card-list-leave-active { transition: all 0.3s ease; }
.card-list-enter-from { opacity: 0; transform: translateY(20px); }
.card-list-leave-to { opacity: 0; transform: scale(0.95); }

:deep(.glass-dialog .el-dialog) {
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
  border-radius: 16px;
}

:deep(.glass-dialog .el-dialog__header) {
  border-bottom: 1px solid var(--glass-border, rgba(255, 255, 255, 0.06));
}

@media (max-width: 768px) {
  .summary-cards { grid-template-columns: 1fr; gap: 10px; }
  .card-value { font-size: 18px; }
  .loan-grid { grid-template-columns: 1fr; }
  .loan-amounts { flex-wrap: wrap; gap: 12px; }
  .loan-actions { gap: 6px; }
  .finance-header { flex-direction: column; align-items: flex-start; gap: 12px; }
}
</style>
