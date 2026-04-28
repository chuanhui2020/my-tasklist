<template>
  <!-- Normal: 右上角通知卡片 -->
  <transition-group name="notify-slide">
    <div
      v-for="item in normalAlerts"
      :key="'normal-' + item.id"
      class="notify-card"
    >
      <div class="notify-header">
        <span class="notify-dot normal-dot"></span>
        <span class="notify-title">{{ item.title }}</span>
        <button class="notify-close" @click="dismiss(item)">&times;</button>
      </div>
      <div class="notify-countdown">{{ formatRemaining(item) }}</div>
    </div>
  </transition-group>

  <!-- Urgent: 顶部橙色警告横幅 -->
  <transition-group name="banner-slide">
    <div
      v-for="item in urgentAlerts"
      :key="'urgent-' + item.id"
      class="urgent-banner"
    >
      <div class="urgent-pulse"></div>
      <div class="urgent-content">
        <span class="urgent-icon"><el-icon><Warning /></el-icon></span>
        <span class="urgent-title">{{ item.title }}</span>
        <span class="urgent-time">{{ formatRemaining(item) }}</span>
      </div>
      <button class="urgent-close" @click="dismiss(item)">&times;</button>
    </div>
  </transition-group>

  <!-- Crazy: 全屏红色闪烁遮罩 -->
  <transition name="crazy-fade">
    <div v-if="crazyAlert" class="crazy-overlay" :class="{ shaking: isShaking }">
      <div class="crazy-bg"></div>
      <div class="crazy-center">
        <div class="crazy-icon-ring">
          <span class="crazy-icon"><el-icon><Bell /></el-icon></span>
        </div>
        <div class="crazy-title">{{ crazyAlert.title }}</div>
        <div class="crazy-time">{{ formatRemaining(crazyAlert) }}</div>
        <button class="crazy-btn" @click="dismissCrazy">我知道了</button>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { Warning, Bell } from '@element-plus/icons-vue'

const props = defineProps({
  alerts: { type: Array, default: () => [] }
})

const emit = defineEmits(['dismiss'])

const now = ref(Date.now())
const isShaking = ref(false)
let timer = null
let audioCtx = null

const normalAlerts = computed(() => props.alerts.filter(a => a.remind_level === 'normal'))
const urgentAlerts = computed(() => props.alerts.filter(a => a.remind_level === 'urgent'))
const crazyAlert = computed(() => props.alerts.find(a => a.remind_level === 'crazy') || null)

function formatRemaining(item) {
  const target = new Date(item.target_time).getTime()
  const diff = target - now.value
  if (diff <= 0) return '已到期！'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  if (h > 0) return `${h}时${m}分${s}秒`
  if (m > 0) return `${m}分${s}秒`
  return `${s}秒`
}

function dismiss(item) {
  emit('dismiss', item.id)
}

function dismissCrazy() {
  if (crazyAlert.value) {
    stopSound()
    emit('dismiss', crazyAlert.value.id)
  }
}

function playAlarmSound() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const playBeep = (freq, startTime, duration) => {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.frequency.value = freq
      osc.type = 'square'
      gain.gain.setValueAtTime(0.15, startTime)
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration)
      osc.start(startTime)
      osc.stop(startTime + duration)
    }
    const t = audioCtx.currentTime
    playBeep(880, t, 0.15)
    playBeep(880, t + 0.2, 0.15)
    playBeep(1100, t + 0.5, 0.3)
  } catch (e) {
    // Audio not supported
  }
}

function stopSound() {
  if (audioCtx) {
    audioCtx.close().catch(() => {})
    audioCtx = null
  }
}

let soundInterval = null

onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now()
    if (crazyAlert.value) {
      isShaking.value = true
      setTimeout(() => { isShaking.value = false }, 500)
    }
  }, 1000)

  // Crazy 级别循环播放提示音
  soundInterval = setInterval(() => {
    if (crazyAlert.value) {
      playAlarmSound()
    }
  }, 3000)
})

onBeforeUnmount(() => {
  clearInterval(timer)
  clearInterval(soundInterval)
  stopSound()
})
</script>

<style scoped>
/* === Normal 通知卡片 === */
.notify-card {
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: 8000;
  width: 280px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(6, 182, 212, 0.3);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
}

.notify-card + .notify-card {
  top: calc(80px + var(--notify-offset, 0px));
}

.notify-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.notify-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.normal-dot {
  background: #06b6d4;
  box-shadow: 0 0 6px rgba(6, 182, 212, 0.6);
}

.notify-title {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #e2e8f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notify-close {
  background: none;
  border: none;
  color: #64748b;
  font-size: 18px;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
}

.notify-close:hover {
  color: #e2e8f0;
}

.notify-countdown {
  font-size: 20px;
  font-weight: 700;
  color: #06b6d4;
  font-variant-numeric: tabular-nums;
}

/* === Urgent 顶部横幅 === */
.urgent-banner {
  position: fixed;
  top: 68px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 8500;
  min-width: 400px;
  max-width: 600px;
  background: rgba(30, 20, 0, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(245, 158, 11, 0.5);
  border-radius: 12px;
  padding: 12px 20px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  overflow: hidden;
  box-shadow: 0 4px 30px rgba(245, 158, 11, 0.3);
}

.urgent-pulse {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.1), transparent);
  animation: urgentPulse 2s ease-in-out infinite;
}

@keyframes urgentPulse {
  0%, 100% { opacity: 0; }
  50% { opacity: 1; }
}

.urgent-content {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  position: relative;
  z-index: 1;
}

.urgent-icon {
  font-size: 20px;
}

.urgent-title {
  font-size: 15px;
  font-weight: 600;
  color: #fbbf24;
}

.urgent-time {
  font-size: 18px;
  font-weight: 700;
  color: #f59e0b;
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.urgent-close {
  background: none;
  border: none;
  color: #92400e;
  font-size: 20px;
  cursor: pointer;
  padding: 0 0 0 12px;
  line-height: 1;
  position: relative;
  z-index: 1;
}

.urgent-close:hover {
  color: #fbbf24;
}

/* === Crazy 全屏遮罩 === */
.crazy-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.crazy-bg {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgba(220, 38, 38, 0.9), rgba(127, 29, 29, 0.95));
  animation: crazyFlash 1s ease-in-out infinite;
}

@keyframes crazyFlash {
  0%, 100% { opacity: 0.88; }
  50% { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .crazy-bg,
  .crazy-icon-ring,
  .crazy-icon,
  .crazy-time,
  .shaking {
    animation: none !important;
  }
}

.crazy-center {
  position: relative;
  z-index: 1;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.crazy-icon-ring {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ringPulse 1s ease-in-out infinite;
}

@keyframes ringPulse {
  0%, 100% { transform: scale(1); border-color: rgba(255,255,255,0.4); }
  50% { transform: scale(1.15); border-color: rgba(255,255,255,0.8); }
}

.crazy-icon {
  font-size: 40px;
  animation: bellShake 0.5s ease-in-out infinite;
}

@keyframes bellShake {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(15deg); }
  75% { transform: rotate(-15deg); }
}

.crazy-title {
  font-size: 28px;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.crazy-time {
  font-size: 56px;
  font-weight: 900;
  color: #fff;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 30px rgba(255, 255, 255, 0.5);
  animation: timePulse 1s ease-in-out infinite;
}

@keyframes timePulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.crazy-btn {
  margin-top: 10px;
  padding: 14px 48px;
  font-size: 18px;
  font-weight: 700;
  color: #dc2626;
  background: #fff;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.2s;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.crazy-btn:hover {
  transform: scale(1.05);
}

/* === Shake 动画 === */
.shaking {
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 50%, 90% { transform: translateX(-4px); }
  30%, 70% { transform: translateX(4px); }
}

/* === Transitions === */
.notify-slide-enter-active { transition: all 0.3s ease-out; }
.notify-slide-leave-active { transition: all 0.2s ease-in; }
.notify-slide-enter-from { transform: translateX(100%); opacity: 0; }
.notify-slide-leave-to { transform: translateX(100%); opacity: 0; }

.banner-slide-enter-active { transition: all 0.3s ease-out; }
.banner-slide-leave-active { transition: all 0.2s ease-in; }
.banner-slide-enter-from { transform: translate(-50%, -100%); opacity: 0; }
.banner-slide-leave-to { transform: translate(-50%, -100%); opacity: 0; }

.crazy-fade-enter-active { transition: opacity 0.3s; }
.crazy-fade-leave-active { transition: opacity 0.2s; }
.crazy-fade-enter-from, .crazy-fade-leave-to { opacity: 0; }
</style>
