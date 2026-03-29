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
  scene.fog = new THREE.FogExp2(0x000008, 0.008)
  camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 300)
  camera.position.set(0, 0, 30)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)

  // Dust cloud particles with volumetric feel
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
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = 5 + Math.random() * 30
    const x = r * Math.sin(phi) * Math.cos(theta)
    const y = r * Math.sin(phi) * Math.sin(theta)
    const z = r * Math.cos(phi)
    pos[i*3] = x; pos[i*3+1] = y; pos[i*3+2] = z
    pData.push({
      ox: x, oy: y, oz: z,
      driftX: (Math.random() - 0.5) * 0.01,
      driftY: (Math.random() - 0.5) * 0.01,
      driftZ: (Math.random() - 0.5) * 0.01,
      phase: Math.random() * Math.PI * 2
    })
    const hue = 0.55 + Math.random() * 0.15
    const lightness = 0.3 + Math.random() * 0.4
    color.setHSL(hue, 0.6, lightness)
    col[i*3] = color.r; col[i*3+1] = color.g; col[i*3+2] = color.b
  }

  const mat = new THREE.PointsMaterial({
    size: 0.4, vertexColors: true, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  })
  const dust = new THREE.Points(geo, mat)
  scene.add(dust)

  // Star points (brighter, smaller, further away)
  const starCount = 300
  const starGeo = new THREE.BufferGeometry()
  const starPos = new Float32Array(starCount * 3)
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = 50 + Math.random() * 50
    starPos[i*3] = r * Math.sin(phi) * Math.cos(theta)
    starPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta)
    starPos[i*3+2] = r * Math.cos(phi)
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  const starMat = new THREE.PointsMaterial({
    size: 0.15, color: 0xffffff, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false
  })
  scene.add(new THREE.Points(starGeo, starMat))

  // Volumetric light shafts (simple cone meshes)
  const shaftCount = 4
  const shafts = []
  for (let i = 0; i < shaftCount; i++) {
    const shaftGeo = new THREE.ConeGeometry(8, 40, 6, 1, true)
    const shaftMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(0.55 + i * 0.05, 0.7, 0.5),
      transparent: true, opacity: 0.03, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
    const shaft = new THREE.Mesh(shaftGeo, shaftMat)
    shaft.position.set((Math.random() - 0.5) * 20, 0, (Math.random() - 0.5) * 20)
    shaft.rotation.z = (Math.random() - 0.5) * 0.5
    shaft.rotation.x = (Math.random() - 0.5) * 0.5
    scene.add(shaft)
    shafts.push({ mesh: shaft, rotSpeed: 0.05 + Math.random() * 0.1, phase: Math.random() * Math.PI * 2 })
  }

  renderer.render(scene, camera)
  ready.value = true

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const t = time * 0.001

    // Drift dust particles
    const pp = dust.geometry.attributes.position.array
    const pc = dust.geometry.attributes.color.array
    for (let i = 0; i < COUNT; i++) {
      const d = pData[i]
      pp[i*3] = d.ox + Math.sin(t * 0.3 + d.phase) * 2 + d.driftX * t * 10
      pp[i*3+1] = d.oy + Math.cos(t * 0.2 + d.phase * 1.3) * 1.5 + d.driftY * t * 10
      pp[i*3+2] = d.oz + Math.sin(t * 0.25 + d.phase * 0.7) * 1.5 + d.driftZ * t * 10

      // Subtle color shimmer
      const shimmer = Math.sin(t + d.phase) * 0.1
      const hue = 0.55 + shimmer
      color.setHSL(hue, 0.6, 0.3 + Math.abs(shimmer) * 2)
      pc[i*3] = color.r; pc[i*3+1] = color.g; pc[i*3+2] = color.b
    }
    dust.geometry.attributes.position.needsUpdate = true
    dust.geometry.attributes.color.needsUpdate = true

    // Rotate light shafts
    for (const s of shafts) {
      s.mesh.rotation.y = t * s.rotSpeed + s.phase
      s.mesh.material.opacity = 0.02 + Math.sin(t * 0.5 + s.phase) * 0.015
    }

    camera.position.x = Math.sin(t * 0.05) * 15
    camera.position.y = Math.cos(t * 0.04) * 8
    camera.position.z = 25 + Math.sin(t * 0.03) * 5
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
  if (renderer) { renderer.dispose(); renderer.forceContextLoss() }
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
