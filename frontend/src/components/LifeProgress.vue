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
            <span class="progress-label">
              {{ bar.title }}
              <el-icon
                v-if="bar.id === 'life'"
                class="config-icon"
                @click="showBirthConfig = !showBirthConfig"
              ><Setting /></el-icon>
            </span>
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

    <!-- 出生年份配置 -->
    <div v-if="showBirthConfig" class="birth-config">
      <span class="birth-label">出生年份</span>
      <el-input-number
        v-model="birthYear"
        :min="1940"
        :max="2015"
        size="small"
        @change="saveBirthYear"
      />
    </div>

    <!-- 漂浮文字 -->
    <Teleport to="body">
      <div class="float-banner" aria-hidden="true">
        <div
          v-for="item in floatingItems"
          :key="item.id"
          class="float-item"
          :style="item.style"
        >
          <span class="float-text" :class="item.colorClass">{{ item.text }}</span>
        </div>
      </div>
    </Teleport>

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
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { Odometer, Setting } from '@element-plus/icons-vue'

// --- 常量 ---
const WORK_START = 9
const WORK_END = 18
const PAYDAY = 10
const LIFESPAN = 75
const WATER_MIN = 30 * 60  // 喝水间隔 30-60 分钟
const WATER_MAX = 60 * 60
const POOP_MIN = 90 * 60   // 拉屎间隔 1.5-3 小时
const POOP_MAX = 180 * 60
const FLOAT_COUNT = 5       // 同时漂浮的文字数量
const FLOAT_INTERVAL = 4000 // 每隔4秒换一批

// --- 响应式状态 ---
const now = ref(new Date())
const showBirthConfig = ref(false)
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

function saveBirthYear(val) {
  localStorage.setItem('life_progress_birth_year', val)
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

  // 4. 距离发薪
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

  // 5. 喝水倒计时
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

  // 6. 拉屎倒计时
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

  // 7. 人生进度
  const age = n.getFullYear() - birthYear.value + n.getMonth() / 12
  let lifePct = (age / LIFESPAN) * 100
  let lifeDisplay
  if (lifePct >= 100) {
    lifePct = 100
    lifeDisplay = '超时服役中，向您致敬!'
  } else {
    lifeDisplay = `已度过 ${lifePct.toFixed(1)}%`
  }
  list.push({
    id: 'life',
    title: '人生进度',
    subtitle: '人生苦短，及时摸鱼',
    percent: lifePct.toFixed(1),
    display: lifeDisplay,
    colorClass: 'fill-life',
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

// --- 漂浮文字 ---
const floatingItems = ref([])
let floatId = 0
let floatTimer = null

const floatColors = ['float-cyan', 'float-purple', 'float-green', 'float-amber', 'float-pink']

function generateFloatingItems() {
  const texts = bars.value.map(b => {
    // 随机选择显示标题+数值 或 副标题
    return Math.random() > 0.4
      ? `${b.title} · ${b.display}`
      : b.subtitle
  })
  // 随机选 FLOAT_COUNT 条，打乱顺序
  const shuffled = texts.sort(() => Math.random() - 0.5).slice(0, FLOAT_COUNT)
  floatingItems.value = shuffled.map((text, i) => {
    const id = ++floatId
    const left = 5 + Math.random() * 80  // 5%~85% 水平位置
    const duration = 12 + Math.random() * 10 // 12~22s 漂浮时长
    const delay = i * 0.6 // 错开出现
    const size = 12 + Math.random() * 4 // 12~16px
    const blur = Math.random() > 0.6 ? 1 : 0 // 部分模糊，增加层次
    return {
      id,
      text,
      colorClass: floatColors[i % floatColors.length],
      style: {
        left: `${left}%`,
        animationDuration: `${duration}s`,
        animationDelay: `${delay}s`,
        fontSize: `${size}px`,
        filter: blur ? 'blur(0.5px)' : 'none',
        opacity: 0.6 + Math.random() * 0.3,
      }
    }
  })
}

// --- 定时器 ---
let timer = null
onMounted(() => {
  generateFloatingItems()
  floatTimer = setInterval(generateFloatingItems, FLOAT_INTERVAL)

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
  if (floatTimer) clearInterval(floatTimer)
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

.config-icon {
  cursor: pointer;
  font-size: 14px;
  color: var(--text-muted);
  transition: color 0.2s;
}

.config-icon:hover {
  color: var(--primary-color);
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

.fill-life {
  background: linear-gradient(90deg, #10b981, #f59e0b, #ef4444);
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.3);
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

/* 出生年份配置 */
.birth-config {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border: 1px solid var(--glass-border);
}

.birth-label {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
}

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

/* 弹窗过渡 */
.alert-fade-enter-active { transition: opacity 0.3s ease; }
.alert-fade-leave-active { transition: opacity 0.2s ease; }
.alert-fade-enter-from,
.alert-fade-leave-to { opacity: 0; }

/* 漂浮文字 */
.float-banner {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 64px;
  pointer-events: none;
  z-index: 100;
  overflow: hidden;
}

.float-item {
  position: absolute;
  bottom: -30px;
  animation: float-up linear forwards;
  white-space: nowrap;
}

.float-text {
  font-weight: 600;
  letter-spacing: 1px;
  text-shadow: 0 0 12px currentColor, 0 0 24px currentColor;
  animation: glow-pulse 2s ease-in-out infinite alternate;
}

.float-cyan { color: rgba(6, 182, 212, 0.8); }
.float-purple { color: rgba(139, 92, 246, 0.8); }
.float-green { color: rgba(16, 185, 129, 0.8); }
.float-amber { color: rgba(245, 158, 11, 0.8); }
.float-pink { color: rgba(236, 72, 153, 0.8); }

@keyframes float-up {
  0% {
    transform: translateY(0) translateX(0);
    opacity: 0;
  }
  8% {
    opacity: 1;
  }
  50% {
    transform: translateY(-40px) translateX(20px);
  }
  92% {
    opacity: 1;
  }
  100% {
    transform: translateY(-80px) translateX(-10px);
    opacity: 0;
  }
}

@keyframes glow-pulse {
  from { text-shadow: 0 0 8px currentColor, 0 0 16px currentColor; }
  to { text-shadow: 0 0 16px currentColor, 0 0 32px currentColor, 0 0 48px currentColor; }
}
</style>
