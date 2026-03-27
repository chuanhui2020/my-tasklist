<template>
  <div class="relax-page">
    <div class="relax-header">
      <h2 class="relax-title">{{ animations[currentIndex].name }}</h2>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
    </div>

    <div
      class="animation-stage"
      @mouseenter="paused = true"
      @mouseleave="paused = false"
    >
      <transition name="anim-fade" mode="out-in">
        <component :is="animations[currentIndex].component" :key="currentIndex" />
      </transition>
    </div>

    <div class="nav-dots">
      <button
        v-for="(anim, idx) in animations"
        :key="idx"
        class="dot"
        :class="{ active: idx === currentIndex }"
        :title="anim.name"
        @click="goTo(idx)"
      ></button>
    </div>
  </div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onBeforeUnmount } from 'vue'

import MilkDragon from '@/components/MilkDragon.vue'
import BreathingCircle from '@/components/relax/BreathingCircle.vue'
import PendulumWave from '@/components/relax/PendulumWave.vue'
import RainDrops from '@/components/relax/RainDrops.vue'
import LavaLamp from '@/components/relax/LavaLamp.vue'
import BouncingBalls from '@/components/relax/BouncingBalls.vue'
import Kaleidoscope from '@/components/relax/Kaleidoscope.vue'
import ParticleFireworks from '@/components/relax/ParticleFireworks.vue'
import WaterRipple from '@/components/relax/WaterRipple.vue'
import StarrySky from '@/components/relax/StarrySky.vue'

const animations = [
  { name: '奶龙', component: MilkDragon },
  { name: '呼吸圆', component: BreathingCircle },
  { name: '钟摆波', component: PendulumWave },
  { name: '下雨', component: RainDrops },
  { name: '熔岩灯', component: LavaLamp },
  { name: '弹力球', component: BouncingBalls },
  { name: '万花筒', component: Kaleidoscope },
  { name: '粒子烟花', component: ParticleFireworks },
  { name: '水波纹', component: WaterRipple },
  { name: '星空', component: StarrySky }
]

const INTERVAL = 10000
const currentIndex = ref(0)
const paused = ref(false)
const progressPercent = ref(0)

let timer = null
let progressTimer = null
let elapsed = 0
const TICK = 50

const resetProgress = () => {
  elapsed = 0
  progressPercent.value = 0
}

const startTimers = () => {
  stopTimers()
  resetProgress()
  progressTimer = setInterval(() => {
    if (paused.value) return
    elapsed += TICK
    progressPercent.value = Math.min((elapsed / INTERVAL) * 100, 100)
    if (elapsed >= INTERVAL) {
      currentIndex.value = (currentIndex.value + 1) % animations.length
      resetProgress()
    }
  }, TICK)
}

const stopTimers = () => {
  if (timer) { clearInterval(timer); timer = null }
  if (progressTimer) { clearInterval(progressTimer); progressTimer = null }
}

const goTo = (idx) => {
  currentIndex.value = idx
  resetProgress()
}

onMounted(startTimers)
onBeforeUnmount(stopTimers)
</script>

<style scoped>
.relax-page {
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.relax-header {
  text-align: center;
}

.relax-title {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.progress-bar {
  width: 200px;
  height: 3px;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary-color);
  transition: width 0.05s linear;
  border-radius: 2px;
}

.animation-stage {
  width: 100%;
  height: 500px;
  border-radius: 16px;
  overflow: hidden;
  background: var(--bg-glass);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(12px);
}

.nav-dots {
  display: flex;
  justify-content: center;
  gap: 10px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
  cursor: pointer;
  padding: 0;
  transition: all 0.3s ease;
}

.dot:hover {
  background: rgba(255, 255, 255, 0.3);
}

.dot.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  box-shadow: 0 0 8px rgba(6, 182, 212, 0.5);
}

/* Transition */
.anim-fade-enter-active,
.anim-fade-leave-active {
  transition: opacity 0.4s ease;
}
.anim-fade-enter-from,
.anim-fade-leave-to {
  opacity: 0;
}
</style>
