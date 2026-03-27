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

  const COUNT = 18
  const w = () => cvs.clientWidth
  const h = () => cvs.clientHeight

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const cw = w(), ch = h()
    ctx.clearRect(0, 0, cw, ch)

    const t = time * 0.001
    const spacing = cw / (COUNT + 1)
    const ballRadius = Math.min(spacing * 0.35, 18)
    const amplitude = ch * 0.25

    for (let i = 0; i < COUNT; i++) {
      const freq = 0.8 + i * 0.08
      const y = ch / 2 + Math.sin(t * freq) * amplitude
      const x = spacing * (i + 1)

      // String
      ctx.beginPath()
      ctx.moveTo(x, 40)
      ctx.lineTo(x, y)
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Ball
      const hue = 180 + (i / COUNT) * 60
      const grad = ctx.createRadialGradient(x - ballRadius * 0.3, y - ballRadius * 0.3, 0, x, y, ballRadius)
      grad.addColorStop(0, `hsla(${hue}, 80%, 75%, 1)`)
      grad.addColorStop(1, `hsla(${hue}, 70%, 45%, 1)`)
      ctx.beginPath()
      ctx.arc(x, y, ballRadius, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()

      // Glow
      ctx.shadowColor = `hsla(${hue}, 80%, 60%, 0.5)`
      ctx.shadowBlur = 15
      ctx.fill()
      ctx.shadowBlur = 0
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
