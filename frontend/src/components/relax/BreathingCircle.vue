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

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const cw = w(), ch = h()
    ctx.clearRect(0, 0, cw, ch)

    const t = time * 0.001
    const breathCycle = (Math.sin(t * 0.8) + 1) / 2
    const baseRadius = Math.min(cw, ch) * 0.15
    const radius = baseRadius + breathCycle * baseRadius * 0.6
    const cx = cw / 2, cy = ch / 2

    // Outer glow
    for (let i = 3; i >= 0; i--) {
      const r = radius + i * 20
      const alpha = 0.05 * (4 - i)
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
      const hue = 180 + breathCycle * 40
      grad.addColorStop(0, `hsla(${hue}, 80%, 60%, ${alpha})`)
      grad.addColorStop(1, `hsla(${hue}, 80%, 60%, 0)`)
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()
    }

    // Main circle
    const hue = 180 + breathCycle * 40
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
    grad.addColorStop(0, `hsla(${hue}, 90%, 70%, 0.9)`)
    grad.addColorStop(0.7, `hsla(${hue + 30}, 80%, 50%, 0.6)`)
    grad.addColorStop(1, `hsla(${hue + 60}, 70%, 40%, 0.3)`)
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()

    // Text
    const label = breathCycle > 0.5 ? '吸气...' : '呼气...'
    ctx.fillStyle = `rgba(255,255,255,${0.5 + breathCycle * 0.3})`
    ctx.font = `${Math.min(cw, ch) * 0.05}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, cx, cy)
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
