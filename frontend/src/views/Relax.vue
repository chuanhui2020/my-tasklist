<template>
  <div class="relax-page">
    <div class="relax-header">
      <h2 class="relax-title">{{ animations[currentIndex].name }}</h2>
      <div class="relax-hint">{{ paused ? '已暂停' : `${INTERVAL - seconds}s 后切换` }}</div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
    </div>

    <div class="animation-stage">
      <div class="animation-wrapper" :style="{ opacity: visible ? 1 : 0 }">
        <component :is="currentComponent" />
      </div>
    </div>

    <div class="controls">
      <button class="ctrl-btn" @click="goPrev">上一个</button>
      <button class="ctrl-btn" @click="paused = !paused">{{ paused ? '继续' : '暂停' }}</button>
      <button class="ctrl-btn" @click="goNext">下一个</button>
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
import { ref, computed, shallowRef, onMounted, onBeforeUnmount, markRaw } from 'vue'

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
  { name: '奶龙', comp: markRaw(MilkDragon) },
  { name: '呼吸圆', comp: markRaw(BreathingCircle) },
  { name: '钟摆波', comp: markRaw(PendulumWave) },
  { name: '下雨', comp: markRaw(RainDrops) },
  { name: '熔岩灯', comp: markRaw(LavaLamp) },
  { name: '弹力球', comp: markRaw(BouncingBalls) },
  { name: '万花筒', comp: markRaw(Kaleidoscope) },
  { name: '粒子烟花', comp: markRaw(ParticleFireworks) },
  { name: '水波纹', comp: markRaw(WaterRipple) },
  { name: '星空', comp: markRaw(StarrySky) }
]

const INTERVAL = 10
const currentIndex = ref(0)
const paused = ref(false)
const seconds = ref(0)
const visible = ref(true)

const progressPercent = computed(() => (seconds.value / INTERVAL) * 100)
const currentComponent = computed(() => animations[currentIndex.value].comp)

let timerId = null

const switchTo = (idx) => {
  visible.value = false
  setTimeout(() => {
    currentIndex.value = idx
    seconds.value = 0
    visible.value = true
  }, 300)
}

const goNext = () => {
  switchTo((currentIndex.value + 1) % animations.length)
}

const goPrev = () => {
  switchTo((currentIndex.value - 1 + animations.length) % animations.length)
}

const goTo = (idx) => {
  if (idx !== currentIndex.value) switchTo(idx)
}

onMounted(() => {
  timerId = setInterval(() => {
    if (paused.value) return
    seconds.value++
    if (seconds.value >= INTERVAL) {
      goNext()
    }
  }, 1000)
})

onBeforeUnmount(() => {
  if (timerId) clearInterval(timerId)
})
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
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.relax-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
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
  transition: width 0.3s linear;
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

.animation-wrapper {
  width: 100%;
  height: 100%;
  transition: opacity 0.3s ease;
}

.controls {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.ctrl-btn {
  padding: 6px 20px;
  border-radius: 8px;
  border: 1px solid var(--glass-border);
  background: var(--bg-glass);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);
}

.ctrl-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--primary-color);
  color: #fff;
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
</style>
