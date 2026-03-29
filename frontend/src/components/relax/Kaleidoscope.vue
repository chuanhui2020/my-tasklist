<template>
  <div ref="container" class="relax-canvas">
    <div v-if="!ready" class="anim-placeholder">
      <div class="anim-placeholder-pulse"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'

const container = ref(null)
const ready = ref(false)
let renderer, scene, camera, animationId, onResize

const init = () => {
  if (!container.value) return
  const w = container.value.clientWidth
  const h = container.value.clientHeight

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 200)
  camera.position.set(0, 0, 20)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)

  // Flow lines
  const lineCount = 12
  const flowLines = []

  for (let l = 0; l < lineCount; l++) {
    const points = 100
    const positions = new Float32Array(points * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const hue = l / lineCount
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color().setHSL(hue, 0.9, 0.6),
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
    const line = new THREE.Line(geo, mat)
    scene.add(line)

    flowLines.push({
      line, geo, points,
      phase: l * 0.5,
      radius: 3 + l * 0.8,
      speed: 0.5 + l * 0.05,
      waveFreq: 2 + l * 0.3
    })
  }

  // Glow particles along lines
  const particleGeo = new THREE.BufferGeometry()
  const pCount = 200
  const pPositions = new Float32Array(pCount * 3)
  particleGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3))
  const pMat = new THREE.PointsMaterial({
    color: 0x88ffff,
    size: 0.15,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
  const particles = new THREE.Points(particleGeo, pMat)
  scene.add(particles)

  renderer.render(scene, camera)
  ready.value = true

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const t = time * 0.001

    for (const fl of flowLines) {
      const pos = fl.geo.attributes.position.array
      for (let i = 0; i < fl.points; i++) {
        const u = i / fl.points
        const angle = u * Math.PI * 4 + t * fl.speed + fl.phase
        const r = fl.radius + Math.sin(u * fl.waveFreq + t) * 2
        pos[i * 3] = Math.cos(angle) * r
        pos[i * 3 + 1] = Math.sin(angle) * r
        pos[i * 3 + 2] = (u - 0.5) * 20 + Math.sin(u * 3 + t * 0.5) * 3
      }
      fl.geo.attributes.position.needsUpdate = true

      const hue = (fl.phase * 0.1 + t * 0.03) % 1
      fl.line.material.color.setHSL(hue, 0.9, 0.6)
    }

    // Update particles
    const pp = particles.geometry.attributes.position.array
    for (let i = 0; i < pCount; i++) {
      const fl = flowLines[i % flowLines.length]
      const u = ((t * fl.speed * 0.3 + i * 0.05) % 1)
      const angle = u * Math.PI * 4 + t * fl.speed + fl.phase
      const r = fl.radius + Math.sin(u * fl.waveFreq + t) * 2
      pp[i * 3] = Math.cos(angle) * r + (Math.random() - 0.5) * 0.3
      pp[i * 3 + 1] = Math.sin(angle) * r + (Math.random() - 0.5) * 0.3
      pp[i * 3 + 2] = (u - 0.5) * 20 + Math.sin(u * 3 + t * 0.5) * 3
    }
    particles.geometry.attributes.position.needsUpdate = true

    camera.position.x = Math.sin(t * 0.2) * 8
    camera.position.y = Math.cos(t * 0.15) * 5
    camera.position.z = 18 + Math.sin(t * 0.1) * 3
    camera.lookAt(0, 0, 0)
    renderer.render(scene, camera)
  }
  animationId = requestAnimationFrame(animate)

  onResize = () => {
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
  if (onResize) window.removeEventListener('resize', onResize)
  if (renderer) {
    renderer.dispose()
    if (container.value?.contains(renderer.domElement)) {
      container.value.removeChild(renderer.domElement)
    }
    renderer = null
  }
})
</script>

<style scoped>
.relax-canvas { width: 100%; height: 100%; position: relative; }
.anim-placeholder {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, rgba(6,182,212,0.08), rgba(139,92,246,0.08)); border-radius: 12px;
}
.anim-placeholder-pulse {
  width: 40px; height: 40px; border: 3px solid rgba(6,182,212,0.2); border-top-color: rgba(6,182,212,0.8);
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
