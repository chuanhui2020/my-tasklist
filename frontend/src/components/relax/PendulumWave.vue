<template>
  <div ref="container" class="relax-canvas"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'

const container = ref(null)
let renderer, scene, camera, animationId

const init = () => {
  if (!container.value) return
  const w = container.value.clientWidth
  const h = container.value.clientHeight

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 100)
  camera.position.z = 30

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)

  // Matrix columns
  const columns = []
  const charSet = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF'
  const colCount = 50

  const canvas2d = document.createElement('canvas')
  canvas2d.width = 512
  canvas2d.height = 512
  const ctx = canvas2d.getContext('2d')

  for (let i = 0; i < colCount; i++) {
    const x = (i - colCount / 2) * 1.1
    const charCount = 15 + Math.floor(Math.random() * 15)
    const speed = 2 + Math.random() * 4
    const col = { x, chars: [], speed, offset: Math.random() * 30 }

    for (let j = 0; j < charCount; j++) {
      const char = charSet[Math.floor(Math.random() * charSet.length)]
      // Create text sprite
      ctx.clearRect(0, 0, 512, 512)
      ctx.fillStyle = j === 0 ? '#ffffff' : `rgba(0, 255, 100, ${1 - j / charCount})`
      ctx.font = 'bold 400px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(char, 256, 256)

      const texture = new THREE.CanvasTexture(ctx.getImageData(0, 0, 512, 512) ? canvas2d : canvas2d)
      texture.needsUpdate = true
      const clonedCanvas = document.createElement('canvas')
      clonedCanvas.width = 512
      clonedCanvas.height = 512
      clonedCanvas.getContext('2d').drawImage(canvas2d, 0, 0)
      const tex = new THREE.CanvasTexture(clonedCanvas)

      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, opacity: j === 0 ? 1 : Math.max(0.1, 1 - j / charCount) })
      const sprite = new THREE.Sprite(mat)
      sprite.scale.set(0.8, 0.8, 1)
      sprite.position.set(x, -j * 0.9, 0)
      scene.add(sprite)
      col.chars.push(sprite)
    }
    columns.push(col)
  }

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const t = time * 0.001

    for (const col of columns) {
      const baseY = ((t * col.speed + col.offset) % 40) - 10
      for (let j = 0; j < col.chars.length; j++) {
        col.chars[j].position.y = baseY - j * 0.9
      }
    }

    renderer.render(scene, camera)
  }
  animationId = requestAnimationFrame(animate)

  const onResize = () => {
    if (!container.value) return
    const w = container.value.clientWidth, h = container.value.clientHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }
  window.addEventListener('resize', onResize)
}

onMounted(init)
onBeforeUnmount(() => {
  if (animationId) cancelAnimationFrame(animationId)
  if (renderer) { renderer.dispose(); renderer.forceContextLoss() }
})
</script>

<style scoped>
.relax-canvas { width: 100%; height: 100%; }
</style>
