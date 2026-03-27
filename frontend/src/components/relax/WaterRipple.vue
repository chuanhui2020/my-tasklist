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

  const ripples = []
  let lastSpawn = 0

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const cw = w(), ch = h()
    ctx.clearRect(0, 0, cw, ch)

    // Spawn new ripple
    if (time - lastSpawn > 1200) {
      ripples.push({
        x: cw * 0.15 + Math.random() * cw * 0.7,
        y: ch * 0.15 + Math.random() * ch * 0.7,
        radius: 0,
        maxRadius: 80 + Math.random() * 150,
        hue: 180 + Math.random() * 60,
        birth: time
      })
      lastSpawn = time
    }

    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i]
      const age = (time - r.birth) * 0.001
      r.radius = age * 60

      if (r.radius > r.maxRadius) { ripples.splice(i, 1); continue }

      const progress = r.radius / r.maxRadius
      const alpha = (1 - progress) * 0.6

      // Multiple rings
      for (let ring = 0; ring < 3; ring++) {
        const ringR = r.radius - ring * 15
        if (ringR <= 0) continue
        const ringAlpha = alpha * (1 - ring * 0.3)

        ctx.beginPath()
        ctx.arc(r.x, r.y, ringR, 0, Math.PI * 2)
        ctx.strokeStyle = `hsla(${r.hue + ring * 15}, 70%, 65%, ${ringAlpha})`
        ctx.lineWidth = 2 - ring * 0.5
        ctx.stroke()
      }

      // Center dot fading
      if (progress < 0.3) {
        const dotAlpha = (0.3 - progress) / 0.3
        ctx.beginPath()
        ctx.arc(r.x, r.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${r.hue}, 80%, 75%, ${dotAlpha})`
        ctx.fill()
      }
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
