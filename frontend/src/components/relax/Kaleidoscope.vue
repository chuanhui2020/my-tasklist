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
  const SEGMENTS = 8

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const cw = w(), ch = h()
    ctx.clearRect(0, 0, cw, ch)

    const t = time * 0.0005
    const cx = cw / 2, cy = ch / 2
    const maxR = Math.min(cw, ch) * 0.42

    ctx.save()
    ctx.translate(cx, cy)

    for (let s = 0; s < SEGMENTS; s++) {
      ctx.save()
      ctx.rotate((s * Math.PI * 2) / SEGMENTS)

      // Clip to segment
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(maxR, 0)
      ctx.arc(0, 0, maxR, 0, Math.PI * 2 / SEGMENTS)
      ctx.closePath()
      ctx.clip()

      // Draw shapes
      for (let i = 0; i < 6; i++) {
        const angle = t + i * 0.5
        const dist = 30 + i * (maxR / 7)
        const x = Math.cos(angle) * dist
        const y = Math.sin(angle * 0.7) * dist * 0.4
        const size = 10 + Math.sin(t * 2 + i) * 8 + i * 3
        const hue = (t * 50 + i * 45 + s * 20) % 360

        ctx.beginPath()
        if (i % 3 === 0) {
          ctx.arc(x, y, size, 0, Math.PI * 2)
        } else if (i % 3 === 1) {
          // Diamond
          ctx.moveTo(x, y - size)
          ctx.lineTo(x + size, y)
          ctx.lineTo(x, y + size)
          ctx.lineTo(x - size, y)
          ctx.closePath()
        } else {
          // Triangle
          for (let v = 0; v < 3; v++) {
            const a = (v * Math.PI * 2) / 3 + t
            ctx.lineTo(x + Math.cos(a) * size, y + Math.sin(a) * size)
          }
          ctx.closePath()
        }

        ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.5)`
        ctx.fill()
        ctx.strokeStyle = `hsla(${hue}, 90%, 70%, 0.7)`
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      ctx.restore()
    }

    ctx.restore()

    // Center circle
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20)
    grad.addColorStop(0, `hsla(${(t * 60) % 360}, 80%, 70%, 0.8)`)
    grad.addColorStop(1, `hsla(${(t * 60 + 60) % 360}, 80%, 50%, 0)`)
    ctx.beginPath()
    ctx.arc(cx, cy, 20, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
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
