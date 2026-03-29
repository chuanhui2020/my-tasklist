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
  camera.position.set(0, 15, 25)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)

  const COUNT = 1500
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(COUNT * 3)
  const col = new Float32Array(COUNT * 3)
  const sizes = new Float32Array(COUNT)
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))

  const pData = []
  const color = new THREE.Color()
  for (let i = 0; i < COUNT; i++) {
    const angle = Math.random() * Math.PI * 2
    const r = 3 + Math.random() * 20
    const y = (Math.random() - 0.5) * 10
    pData.push({
      angle, r, y, speed: 0.5 + Math.random() * 1.5,
      rSpeed: 0.01 + Math.random() * 0.03,
      phase: Math.random() * Math.PI * 2
    })
    pos[i*3] = Math.cos(angle) * r
    pos[i*3+1] = y
    pos[i*3+2] = Math.sin(angle) * r
    color.setHSL(0.55 + (r / 25) * 0.2, 0.9, 0.5 + Math.random() * 0.3)
    col[i*3] = color.r; col[i*3+1] = color.g; col[i*3+2] = color.b
  }

  const mat = new THREE.PointsMaterial({
    size: 0.12, vertexColors: true, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false
  })
  const particles = new THREE.Points(geo, mat)
  scene.add(particles)

  // Center glow
  const coreGeo = new THREE.SphereGeometry(1.5, 32, 32)
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0x00ffcc, transparent: true, opacity: 0.2,
    blending: THREE.AdditiveBlending, depthWrite: false
  })
  scene.add(new THREE.Mesh(coreGeo, coreMat))

  renderer.render(scene, camera)
  ready.value = true

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const t = time * 0.001

    const pp = particles.geometry.attributes.position.array
    const pc = particles.geometry.attributes.color.array
    for (let i = 0; i < COUNT; i++) {
      const d = pData[i]
      d.angle += d.speed * 0.01 * (1 + 5 / (d.r + 1))
      d.r -= d.rSpeed

      if (d.r < 0.5) {
        // Burst outward
        d.r = 3 + Math.random() * 20
        d.angle = Math.random() * Math.PI * 2
        d.y = (Math.random() - 0.5) * 10
      }

      pp[i*3] = Math.cos(d.angle) * d.r
      pp[i*3+1] = d.y * (d.r / 20) + Math.sin(t + d.phase) * 0.5
      pp[i*3+2] = Math.sin(d.angle) * d.r

      const hue = 0.5 + (1 - d.r / 25) * 0.3
      color.setHSL(hue, 0.9, 0.4 + (1 - d.r / 25) * 0.4)
      pc[i*3] = color.r; pc[i*3+1] = color.g; pc[i*3+2] = color.b
    }
    particles.geometry.attributes.position.needsUpdate = true
    particles.geometry.attributes.color.needsUpdate = true

    coreMat.opacity = 0.15 + Math.sin(t * 2) * 0.1

    camera.position.x = Math.sin(t * 0.1) * 8
    camera.position.z = 20 + Math.cos(t * 0.08) * 5
    camera.lookAt(0, 0, 0)
    renderer.render(scene, camera)
  }
  animationId = requestAnimationFrame(animate)

  onResize = () => {
    if (!container.value) return
    const w = container.value.clientWidth, h = container.value.clientHeight
    camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h)
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
