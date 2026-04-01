<template>
  <el-card class="tech-card life-progress-card" shadow="hover">
    <div class="lp-header">
      <div class="lp-header-left">
        <div class="lp-title">
          <el-icon class="icon-pulse"><Odometer /></el-icon>
          <span>人生进度</span>
        </div>
        <div class="lp-subtitle">系统监测中...请勿关闭人生</div>
      </div>
    </div>

    <div class="progress-list">
      <div
        v-for="bar in bars"
        :key="bar.id"
        class="progress-item"
        :class="{ 'is-alert': bar.alert }"
      >
        <div class="progress-meta">
          <div class="progress-info">
            <span class="progress-label">{{ bar.title }}</span>
            <span class="progress-desc">{{ bar.subtitle }}</span>
          </div>
          <span class="progress-value" :class="{ 'value-alert': bar.alert }">{{ bar.display }}</span>
        </div>
        <div class="progress-track">
          <div
            class="progress-fill"
            :class="bar.colorClass"
            :style="{ width: bar.percent + '%' }"
          ></div>
        </div>
      </div>
    </div>

    <!-- 喝水/拉屎提醒弹窗 -->
    <Teleport to="body">
      <Transition name="alert-fade">
        <div v-if="alertVisible" class="timer-alert-overlay" @click="dismissAlert">
          <div class="timer-alert-box" @click.stop>
            <div class="alert-icon">{{ alertData.icon }}</div>
            <div class="alert-title">{{ alertData.title }}</div>
            <div class="alert-desc">{{ alertData.desc }}</div>
            <button class="alert-btn" @click="dismissAlert">{{ alertData.btn }}</button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </el-card>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Odometer } from '@element-plus/icons-vue'

// --- 常量 ---
const WORK_START = 9
const WORK_END = 20.5  // 上海时间 20:30
const PAYDAY = 5
const RETIRE_AGE = 65
const WATER_MIN = 120 * 60  // 喝水间隔 2 小时
const WATER_MAX = 120 * 60
const POOP_MIN = 600 * 60   // 拉屎间隔 10 小时
const POOP_MAX = 600 * 60

// 中国法定节假日（数据来源：国务院办公厅）
const HOLIDAYS = [
  { name: '元旦', start: '2025-01-01', end: '2025-01-01' },
  { name: '春节', start: '2025-01-28', end: '2025-02-04' },
  { name: '清明节', start: '2025-04-04', end: '2025-04-06' },
  { name: '劳动节', start: '2025-05-01', end: '2025-05-05' },
  { name: '端午节', start: '2025-06-27', end: '2025-06-29' },
  { name: '中秋节+国庆节', start: '2025-10-01', end: '2025-10-08' },
  { name: '元旦', start: '2026-01-01', end: '2026-01-03' },
  { name: '春节', start: '2026-02-15', end: '2026-02-23' },
  { name: '清明节', start: '2026-04-04', end: '2026-04-06' },
  { name: '劳动节', start: '2026-05-01', end: '2026-05-05' },
  { name: '端午节', start: '2026-06-19', end: '2026-06-21' },
  { name: '中秋节', start: '2026-09-25', end: '2026-09-27' },
  { name: '国庆节', start: '2026-10-01', end: '2026-10-07' },
]

// --- 响应式状态 ---
const now = ref(new Date())
const birthYear = ref(parseInt(localStorage.getItem('life_progress_birth_year')) || 2000)
// 倒计时（秒）
const waterCountdown = ref(randomInt(WATER_MIN, WATER_MAX))
const poopCountdown = ref(randomInt(POOP_MIN, POOP_MAX))

// 提醒弹窗
const alertVisible = ref(false)
const alertData = ref({ icon: '', title: '', desc: '', btn: '' })

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// --- 计算进度 ---
const bars = computed(() => {
  const n = now.value
  const list = []

  // 1. 本月进度
  const daysInMonth = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate()
  const monthPct = ((n.getDate() - 1 + n.getHours() / 24) / daysInMonth) * 100
  list.push({
    id: 'month',
    title: '本月进度',
    subtitle: '本月余额不足，请及时充值',
    percent: Math.min(monthPct, 100).toFixed(1),
    display: `已消耗 ${monthPct.toFixed(1)}%`,
    colorClass: 'fill-cyber',
  })

  // 2. 本年进度
  const startOfYear = new Date(n.getFullYear(), 0, 1)
  const endOfYear = new Date(n.getFullYear() + 1, 0, 1)
  const yearPct = ((n - startOfYear) / (endOfYear - startOfYear)) * 100
  list.push({
    id: 'year',
    title: '本年进度',
    subtitle: '今年的flag还记得吗？',
    percent: Math.min(yearPct, 100).toFixed(1),
    display: `${n.getFullYear()} 已过 ${yearPct.toFixed(1)}%`,
    colorClass: 'fill-cyber',
  })

  // 3. 距离下班
  const curHour = n.getHours() + n.getMinutes() / 60 + n.getSeconds() / 3600
  const offWork = curHour < WORK_START || curHour >= WORK_END
  let workPct, workDisplay
  if (offWork) {
    workPct = 100
    workDisplay = '已下班，恭喜摸鱼成功!'
  } else {
    workPct = ((curHour - WORK_START) / (WORK_END - WORK_START)) * 100
    const remainSec = (WORK_END - curHour) * 3600
    const rh = Math.floor(remainSec / 3600)
    const rm = Math.floor((remainSec % 3600) / 60)
    workDisplay = `还剩 ${rh}h ${rm}min`
  }
  list.push({
    id: 'work',
    title: '距离下班',
    subtitle: '打工人打工魂，摸鱼才是人上人',
    percent: Math.min(workPct, 100).toFixed(1),
    display: workDisplay,
    colorClass: offWork ? 'fill-success' : 'fill-cyber',
  })

  // 4. 距离周末
  const dayOfWeek = n.getDay() // 0=周日, 6=周六
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  let weekendDisplay, weekendPct
  if (isWeekend) {
    weekendPct = 100
    weekendDisplay = '周末快乐！但周一在逼近...'
  } else {
    // 周一=1 到 周五=5，距离周六还有 (6 - dayOfWeek) 天
    const daysLeft = 6 - dayOfWeek
    const hoursLeft = daysLeft * 24 - curHour
    weekendPct = ((5 - daysLeft) / 5) * 100
    if (daysLeft === 1) {
      weekendDisplay = '明天就周末了，再撑撑!'
    } else {
      weekendDisplay = `还有 ${daysLeft} 天，熬住!`
    }
  }
  list.push({
    id: 'weekend',
    title: '距离周末',
    subtitle: '每周最大的盼头，没有之一',
    percent: weekendPct.toFixed(1),
    display: weekendDisplay,
    colorClass: isWeekend ? 'fill-success' : 'fill-cyber',
  })

  // 5. 距离发薪
  let nextPayday
  if (n.getDate() < PAYDAY) {
    nextPayday = new Date(n.getFullYear(), n.getMonth(), PAYDAY)
  } else if (n.getDate() === PAYDAY) {
    nextPayday = null // 今天就是发薪日
  } else {
    nextPayday = new Date(n.getFullYear(), n.getMonth() + 1, PAYDAY)
  }
  let payDisplay, payPct
  if (!nextPayday) {
    payDisplay = '今天发薪！冲鸭!'
    payPct = 100
  } else {
    const daysUntil = Math.ceil((nextPayday - n) / 86400000)
    payPct = Math.max((1 - daysUntil / 30) * 100, 0)
    payDisplay = `还有 ${daysUntil} 天，坚持住!`
  }
  list.push({
    id: 'pay',
    title: '距离发薪',
    subtitle: '钱包空空如也，但梦想还在',
    percent: payPct.toFixed(1),
    display: payDisplay,
    colorClass: !nextPayday ? 'fill-success' : 'fill-cyber',
  })

  // 5. 距离下次放假
  const today = new Date(n.getFullYear(), n.getMonth(), n.getDate())
  let nextHoliday = null
  let inHoliday = false
  for (const h of HOLIDAYS) {
    const start = new Date(h.start + 'T00:00:00')
    const end = new Date(h.end + 'T00:00:00')
    if (today >= start && today <= end) {
      inHoliday = true
      nextHoliday = h
      break
    }
    if (start > today) {
      nextHoliday = h
      break
    }
  }
  let holidayDisplay, holidayPct
  if (inHoliday) {
    holidayDisplay = `${nextHoliday.name} 放假中，快乐!`
    holidayPct = 100
  } else if (nextHoliday) {
    const daysUntil = Math.ceil((new Date(nextHoliday.start + 'T00:00:00') - today) / 86400000)
    holidayPct = Math.max((1 - daysUntil / 90) * 100, 0)
    holidayDisplay = `${nextHoliday.name} 还有 ${daysUntil} 天`
  } else {
    holidayDisplay = '暂无假期数据'
    holidayPct = 0
  }
  list.push({
    id: 'holiday',
    title: '距离下次放假',
    subtitle: '上班是不可能上班的，放假才是真理',
    percent: holidayPct.toFixed(1),
    display: holidayDisplay,
    colorClass: inHoliday ? 'fill-success' : 'fill-cyber',
  })

  // 6. 距离下次喝水
  const wSec = waterCountdown.value
  const waterAlert = wSec <= 0
  list.push({
    id: 'water',
    title: '距离下次喝水',
    subtitle: '多喝热水，包治百病',
    percent: waterAlert ? 100 : Math.max((1 - wSec / WATER_MAX) * 100, 0).toFixed(1),
    display: waterAlert ? '该喝水了！快去!' : formatCountdown(wSec),
    colorClass: waterAlert ? 'fill-alert-pulse' : 'fill-cyber',
    alert: waterAlert,
  })

  // 7. 拉屎倒计时
  const pSec = poopCountdown.value
  const poopAlert = pSec <= 0
  list.push({
    id: 'poop',
    title: '距离下次拉屎',
    subtitle: '人生大事，不可忽视',
    percent: poopAlert ? 100 : Math.max((1 - pSec / POOP_MAX) * 100, 0).toFixed(1),
    display: poopAlert ? '憋不住了！快冲!' : formatCountdown(pSec),
    colorClass: poopAlert ? 'fill-alert-pulse' : 'fill-cyber',
    alert: poopAlert,
  })

  // 9. 距离退休
  const age = n.getFullYear() - birthYear.value + n.getMonth() / 12
  const yearsLeft = RETIRE_AGE - age
  let retireDisplay, retirePct
  if (yearsLeft <= 0) {
    retirePct = 100
    retireDisplay = '已退休！恭喜解放!'
  } else {
    retirePct = (age / RETIRE_AGE) * 100
    const yrs = Math.floor(yearsLeft)
    const mos = Math.floor((yearsLeft - yrs) * 12)
    retireDisplay = `还剩 ${yrs}年${mos}月，再忍忍`
  }
  list.push({
    id: 'retire',
    title: '距离退休',
    subtitle: '退休倒计时，每一天都是煎熬',
    percent: retirePct.toFixed(1),
    display: retireDisplay,
    colorClass: yearsLeft <= 0 ? 'fill-success' : 'fill-cyber',
  })

  return list
})

function formatCountdown(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}分${s < 10 ? '0' : ''}${s}秒`
}

// --- 提醒逻辑 ---
const waterAlerts = [
  { icon: '💧', title: '喝水警报！', desc: '你的身体已经在沙漠边缘了，快去接杯水！', btn: '已喝，重置计时' },
  { icon: '🚰', title: '水分告急！', desc: '再不喝水，你就要变成人干了！', btn: '喝完了，谢谢提醒' },
  { icon: '🫗', title: '补水时间到！', desc: '你上次喝水是什么时候？想不起来就对了！', btn: '这就去喝' },
]
const poopAlerts = [
  { icon: '💩', title: '拉屎预警！', desc: '你的肠道已经发来三条未读消息！', btn: '已处理，重置计时' },
  { icon: '🚽', title: '厕所在召唤你！', desc: '忍住不是本事，拉出来才是能力！', btn: '搞定了' },
  { icon: '🧻', title: '排毒时间到！', desc: '该去和马桶进行一次深入的交流了！', btn: '交流完毕' },
]

let pendingAlertType = null

function triggerAlert(type) {
  const pool = type === 'water' ? waterAlerts : poopAlerts
  const data = pool[Math.floor(Math.random() * pool.length)]
  alertData.value = data
  pendingAlertType = type
  alertVisible.value = true
}

function dismissAlert() {
  alertVisible.value = false
  if (pendingAlertType === 'water') {
    waterCountdown.value = randomInt(WATER_MIN, WATER_MAX)
  } else if (pendingAlertType === 'poop') {
    poopCountdown.value = randomInt(POOP_MIN, POOP_MAX)
  }
  pendingAlertType = null
}

// --- 定时器 ---
let timer = null
onMounted(() => {
  timer = setInterval(() => {
    now.value = new Date()
    if (waterCountdown.value > 0) waterCountdown.value--
    if (poopCountdown.value > 0) poopCountdown.value--

    // 触发提醒
    if (waterCountdown.value === 0 && !alertVisible.value) {
      triggerAlert('water')
    } else if (poopCountdown.value === 0 && !alertVisible.value) {
      triggerAlert('poop')
    }
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.life-progress-card {
  border-radius: 24px !important;
  overflow: hidden;
}

.lp-header {
  margin-bottom: 20px;
}

.lp-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.lp-subtitle {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.icon-pulse {
  color: var(--primary-color);
  animation: pulse 3s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.1); }
}

/* 进度条列表 */
.progress-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.progress-item {
  transition: all 0.3s ease;
}

.progress-item.is-alert {
  animation: item-glow 1s ease-in-out infinite alternate;
}

@keyframes item-glow {
  from { background: transparent; }
  to { background: rgba(239, 68, 68, 0.08); border-radius: 8px; }
}

.progress-meta {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 6px;
}

.progress-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.progress-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.progress-desc {
  font-size: 12px;
  color: var(--text-muted);
}

.progress-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary-color);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.value-alert {
  color: var(--accent-danger);
  animation: blink 0.8s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* 进度条轨道 */
.progress-track {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.fill-cyber {
  background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
  box-shadow: 0 0 8px var(--primary-glow);
}

.fill-success {
  background: linear-gradient(90deg, #10b981, #34d399);
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
}

.fill-alert-pulse {
  background: linear-gradient(90deg, #ef4444, #f97316);
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.5);
  animation: bar-pulse 1s ease-in-out infinite alternate;
}

@keyframes bar-pulse {
  from { box-shadow: 0 0 8px rgba(239, 68, 68, 0.3); }
  to { box-shadow: 0 0 20px rgba(239, 68, 68, 0.7); }
}

/* 弹窗过渡 */
.alert-fade-enter-active { transition: opacity 0.3s ease; }
.alert-fade-leave-active { transition: opacity 0.2s ease; }
.alert-fade-enter-from,
.alert-fade-leave-to { opacity: 0; }
</style>

<style>
/* Teleport 到 body 的样式不能 scoped */

/* 提醒弹窗 */
.timer-alert-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
}

.timer-alert-box {
  text-align: center;
  padding: 40px 48px;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95));
  border: 1px solid var(--glass-border);
  border-radius: 24px;
  box-shadow: 0 0 40px var(--primary-glow), 0 0 80px rgba(139, 92, 246, 0.2);
  animation: alert-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  max-width: 400px;
}

@keyframes alert-pop {
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.alert-icon {
  font-size: 64px;
  margin-bottom: 16px;
  animation: bounce 1s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}

.alert-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
  text-shadow: 0 0 20px var(--primary-glow);
}

.alert-desc {
  font-size: 15px;
  color: var(--text-secondary);
  margin-bottom: 24px;
  line-height: 1.6;
}

.alert-btn {
  padding: 10px 32px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.alert-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 24px var(--primary-glow);
}

.alert-fade-enter-active { transition: opacity 0.3s ease; }
.alert-fade-leave-active { transition: opacity 0.2s ease; }
.alert-fade-enter-from,
.alert-fade-leave-to { opacity: 0; }
</style>
