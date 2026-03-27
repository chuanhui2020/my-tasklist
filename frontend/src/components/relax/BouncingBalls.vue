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

  const balls = []
  const colors = ['#06B6D4', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#EC4899', '#6366F1']

  for (let i = 0; i < 12; i++) {
    const radius = 12 + Math.random() * 20
    balls.push({
      x: 100 + Math.random() * 600,
      y: 100 + Math.random() * 300,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      radius,
      color: colors[i % colors.length],
      trail: []
    })
  }

  const animate = () => {
    animationId = requestAnimationFrame(animate)
    const cw = w(), ch = h()
    ctx.clearRect(0, 0, cw, ch)

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 2
    ctx.strokeRect(20, 20, cw - 40, ch - 40)

    for (const b of balls) {
      // Trail
      b.trail.push({ x: b.x, y: b.y })
      if (b.trail.length > 8) b.trail.shift()

      for (let i = 0; i < b.trail.length; i++) {
        const alpha = (i / b.trail.length) * 0.2
        ctx.beginPath()
        ctx.arc(b.trail[i].x, b.trail[i].y, b.radius * 0.6, 0, Math.PI * 2)
        ctx.fillStyle = b.color + Math.floor(alpha * 255).toString(16).padStart(2, '0')
        ctx.fill()
      }

      // Gravity
      b.vy += 0.15

      b.x += b.vx
      b.y += b.vy

      // Bounce
      if (b.x - b.radius < 20) { b.x = 20 + b.radius; b.vx = Math.abs(b.vx) * 0.95 }
      if (b.x + b.radius > cw - 20) { b.x = cw - 20 - b.radius; b.vx = -Math.abs(b.vx) * 0.95 }
      if (b.y - b.radius < 20) { b.y = 20 + b.radius; b.vy = Math.abs(b.vy) * 0.95 }
      if (b.y + b.radius > ch - 20) { b.y = ch - 20 - b.radius; b.vy = -Math.abs(b.vy) * 0.85; b.vx *= 0.99 }

      // Keep energy
      if (Math.abs(b.vy) < 0.5 && b.y + b.radius >= ch - 25) {
        b.vy = -(3 + Math.random() * 4)
      }

      // Ball
      const grad = ctx.createRadialGradient(b.x - b.radius * 0.3, b.y - b.radius * 0.3, 0, b.x, b.y, b.radius)
      grad.addColorStop(0, '#fff')
      grad.addColorStop(0.3, b.color)
      grad.addColorStop(1, b.color)
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2)
      ctx.fillStyle = grad
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
