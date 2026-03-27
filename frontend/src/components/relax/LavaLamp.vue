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

  const blobs = []
  const colors = [
    [255, 100, 150], [100, 200, 255], [255, 180, 80],
    [150, 100, 255], [100, 255, 180], [255, 120, 200]
  ]

  for (let i = 0; i < 8; i++) {
    blobs.push({
      x: Math.random() * 800,
      y: Math.random() * 600,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -0.3 - Math.random() * 0.5,
      radius: 40 + Math.random() * 60,
      color: colors[i % colors.length],
      phase: Math.random() * Math.PI * 2
    })
  }

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const cw = w(), ch = h()
    ctx.clearRect(0, 0, cw, ch)

    const t = time * 0.001

    for (const b of blobs) {
      b.x += b.vx + Math.sin(t * 0.5 + b.phase) * 0.3
      b.y += b.vy + Math.sin(t * 0.3 + b.phase) * 0.5

      // Bounce off walls
      if (b.x < b.radius) { b.x = b.radius; b.vx *= -1 }
      if (b.x > cw - b.radius) { b.x = cw - b.radius; b.vx *= -1 }
      // Wrap vertically
      if (b.y < -b.radius) b.y = ch + b.radius
      if (b.y > ch + b.radius) b.y = -b.radius

      const pulseR = b.radius + Math.sin(t + b.phase) * 10
      const [r, g, bl] = b.color
      const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, pulseR)
      grad.addColorStop(0, `rgba(${r},${g},${bl},0.8)`)
      grad.addColorStop(0.5, `rgba(${r},${g},${bl},0.3)`)
      grad.addColorStop(1, `rgba(${r},${g},${bl},0)`)

      ctx.beginPath()
      ctx.arc(b.x, b.y, pulseR, 0, Math.PI * 2)
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
