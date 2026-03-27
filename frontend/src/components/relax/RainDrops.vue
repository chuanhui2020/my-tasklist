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

  const drops = []
  const ripples = []

  for (let i = 0; i < 120; i++) {
    drops.push({
      x: Math.random() * 2000,
      y: Math.random() * 1000,
      speed: 4 + Math.random() * 6,
      length: 15 + Math.random() * 20,
      opacity: 0.2 + Math.random() * 0.4
    })
  }

  const animate = () => {
    animationId = requestAnimationFrame(animate)
    const cw = w(), ch = h()
    ctx.clearRect(0, 0, cw, ch)

    // Drops
    ctx.strokeStyle = 'rgba(150, 200, 255, 0.4)'
    ctx.lineWidth = 1.5
    for (const d of drops) {
      ctx.globalAlpha = d.opacity
      ctx.beginPath()
      ctx.moveTo(d.x, d.y)
      ctx.lineTo(d.x + 1, d.y + d.length)
      ctx.stroke()

      d.y += d.speed
      if (d.y > ch) {
        ripples.push({ x: d.x, y: ch - 20 + Math.random() * 20, radius: 0, maxRadius: 15 + Math.random() * 20, opacity: 0.6 })
        d.y = -d.length
        d.x = Math.random() * cw
      }
    }
    ctx.globalAlpha = 1

    // Ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i]
      r.radius += 0.8
      r.opacity -= 0.015
      if (r.opacity <= 0) { ripples.splice(i, 1); continue }

      ctx.beginPath()
      ctx.ellipse(r.x, r.y, r.radius, r.radius * 0.3, 0, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(150, 200, 255, ${r.opacity})`
      ctx.lineWidth = 1
      ctx.stroke()
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
