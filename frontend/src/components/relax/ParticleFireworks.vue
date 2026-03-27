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

  const fireworks = []
  const particles = []

  const launch = () => {
    const cw = w(), ch = h()
    fireworks.push({
      x: cw * 0.2 + Math.random() * cw * 0.6,
      y: ch,
      targetY: ch * 0.15 + Math.random() * ch * 0.35,
      speed: 4 + Math.random() * 2,
      hue: Math.random() * 360,
      trail: []
    })
  }

  const explode = (x, y, hue) => {
    const count = 60 + Math.floor(Math.random() * 40)
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3
      const speed = 1.5 + Math.random() * 3
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.01 + Math.random() * 0.015,
        hue: hue + (Math.random() - 0.5) * 30,
        size: 2 + Math.random() * 2
      })
    }
  }

  let lastLaunch = 0

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const cw = w(), ch = h()

    // Fade trail
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'
    ctx.fillRect(0, 0, cw, ch)

    // Auto launch
    if (time - lastLaunch > 800 + Math.random() * 600) {
      launch()
      lastLaunch = time
    }

    // Fireworks rising
    for (let i = fireworks.length - 1; i >= 0; i--) {
      const f = fireworks[i]
      f.trail.push({ x: f.x, y: f.y })
      if (f.trail.length > 6) f.trail.shift()

      f.y -= f.speed
      f.x += Math.sin(f.y * 0.02) * 0.5

      // Trail
      for (let j = 0; j < f.trail.length; j++) {
        const alpha = j / f.trail.length * 0.5
        ctx.beginPath()
        ctx.arc(f.trail[j].x, f.trail[j].y, 2, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${f.hue}, 80%, 70%, ${alpha})`
        ctx.fill()
      }

      // Head
      ctx.beginPath()
      ctx.arc(f.x, f.y, 3, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${f.hue}, 90%, 80%, 1)`
      ctx.fill()

      if (f.y <= f.targetY) {
        explode(f.x, f.y, f.hue)
        fireworks.splice(i, 1)
      }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.03
      p.vx *= 0.99
      p.life -= p.decay

      if (p.life <= 0) { particles.splice(i, 1); continue }

      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${p.life})`
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
