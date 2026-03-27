<template>
  <canvas ref="canvas" class="relax-canvas"></canvas>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const canvas = ref(null)
let animationId = null

const init = () => {
  const cvs = canvas.value
  if (!cvs) return
  const ctx = cvs.getContext('2d')
  const resize = () => {
    cvs.width = cvs.clientWidth * devicePixelRatio
    cvs.height = cvs.clientHeight * devicePixelRatio
    ctx.scale(devicePixelRatio, devicePixelRatio)
  }
  resize()
  window.addEventListener('resize', resize)

  const w = () => cvs.clientWidth
  const h = () => cvs.clientHeight

  const stars = []
  const shootingStars = []

  for (let i = 0; i < 200; i++) {
    stars.push({
      x: Math.random(),
      y: Math.random(),
      size: 0.5 + Math.random() * 2,
      twinkleSpeed: 0.5 + Math.random() * 2,
      phase: Math.random() * Math.PI * 2,
      hue: Math.random() > 0.7 ? 30 + Math.random() * 30 : 200 + Math.random() * 60
    })
  }

  let lastShoot = 0

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const cw = w(), ch = h()
    ctx.clearRect(0, 0, cw, ch)

    const t = time * 0.001

    // Stars
    for (const s of stars) {
      const brightness = 0.3 + Math.sin(t * s.twinkleSpeed + s.phase) * 0.35 + 0.35
      const x = s.x * cw, y = s.y * ch

      // Glow
      ctx.beginPath()
      ctx.arc(x, y, s.size * 3, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${s.hue}, 60%, 80%, ${brightness * 0.15})`
      ctx.fill()

      // Core
      ctx.beginPath()
      ctx.arc(x, y, s.size, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${s.hue}, 60%, 90%, ${brightness})`
      ctx.fill()
    }

    // Shooting stars
    if (time - lastShoot > 3000 + Math.random() * 4000) {
      const startX = Math.random() * cw * 0.8
      shootingStars.push({
        x: startX, y: Math.random() * ch * 0.3,
        vx: 6 + Math.random() * 4,
        vy: 2 + Math.random() * 3,
        life: 1,
        trail: []
      })
      lastShoot = time
    }

    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const ss = shootingStars[i]
      ss.trail.push({ x: ss.x, y: ss.y })
      if (ss.trail.length > 20) ss.trail.shift()

      ss.x += ss.vx
      ss.y += ss.vy
      ss.life -= 0.015

      if (ss.life <= 0 || ss.x > cw || ss.y > ch) {
        shootingStars.splice(i, 1)
        continue
      }

      // Trail
      for (let j = 0; j < ss.trail.length; j++) {
        const alpha = (j / ss.trail.length) * ss.life * 0.6
        const size = (j / ss.trail.length) * 2
        ctx.beginPath()
        ctx.arc(ss.trail[j].x, ss.trail[j].y, size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
        ctx.fill()
      }

      // Head
      ctx.beginPath()
      ctx.arc(ss.x, ss.y, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${ss.life})`
      ctx.fill()
    }
  }

  animationId = requestAnimationFrame(animate)
}

onMounted(init)
onBeforeUnmount(() => {
  if (animationId) cancelAnimationFrame(animationId)
})
</script>

<style scoped>
.relax-canvas { width: 100%; height: 100%; display: block; }
</style>
