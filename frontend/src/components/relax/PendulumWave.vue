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
  camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100)
  camera.position.set(0, 0, 30)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)

  // Pendulum wave: 20 glowing spheres swinging at different frequencies
  const count = 20
  const sphereGeo = new THREE.SphereGeometry(0.5, 16, 16)
  const pendulums = []

  for (let i = 0; i < count; i++) {
    const hue = 0.45 + (i / count) * 0.25
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(hue, 0.9, 0.6),
      transparent: true,
      opacity: 0.9
    })
    const mesh = new THREE.Mesh(sphereGeo, mat)
    const x = (i - count / 2) * 1.4
    mesh.position.set(x, 0, 0)
    scene.add(mesh)

    // Each pendulum has slightly different frequency
    const freq = 0.8 + i * 0.04
    pendulums.push({ mesh, x, freq, hue })
  }

  // Trail particles
  const trailCount = 600
  const trailGeo = new THREE.BufferGeometry()
  const trailPos = new Float32Array(trailCount * 3)
  const trailCol = new Float32Array(trailCount * 3)
  const trailAlpha = new Float32Array(trailCount)
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3))
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3))

  const trailMat = new THREE.PointsMaterial({
    size: 0.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
  const trails = new THREE.Points(trailGeo, trailMat)
  scene.add(trails)

  // Connection lines between adjacent pendulums
  const lineGeo = new THREE.BufferGeometry()
  const linePos = new Float32Array((count - 1) * 6)
  const lineCol = new Float32Array((count - 1) * 6)
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3))
  lineGeo.setAttribute('color', new THREE.BufferAttribute(lineCol, 3))
  const lineMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
  const lines = new THREE.LineSegments(lineGeo, lineMat)
  scene.add(lines)

  let trailIdx = 0
  const color = new THREE.Color()

  renderer.render(scene, camera)
  ready.value = true

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const t = time * 0.001

    // Swing pendulums
    for (let i = 0; i < pendulums.length; i++) {
      const p = pendulums[i]
      const y = Math.sin(t * p.freq) * 10
      p.mesh.position.y = y

      // Pulse scale
      const scale = 0.8 + Math.abs(Math.sin(t * p.freq)) * 0.4
      p.mesh.scale.setScalar(scale)

      // Color shift
      const hue = (p.hue + t * 0.02) % 1
      p.mesh.material.color.setHSL(hue, 0.9, 0.6)

      // Drop trail particle
      const ti = (trailIdx + i) % trailCount
      trailPos[ti * 3] = p.x + (Math.random() - 0.5) * 0.3
      trailPos[ti * 3 + 1] = y + (Math.random() - 0.5) * 0.3
      trailPos[ti * 3 + 2] = (Math.random() - 0.5) * 0.5
      color.setHSL(hue, 0.8, 0.5)
      trailCol[ti * 3] = color.r
      trailCol[ti * 3 + 1] = color.g
      trailCol[ti * 3 + 2] = color.b
    }
    trailIdx = (trailIdx + pendulums.length) % trailCount

    // Fade old trails
    for (let i = 0; i < trailCount; i++) {
      trailCol[i * 3] *= 0.98
      trailCol[i * 3 + 1] *= 0.98
      trailCol[i * 3 + 2] *= 0.98
    }

    trails.geometry.attributes.position.needsUpdate = true
    trails.geometry.attributes.color.needsUpdate = true

    // Update connection lines
    const lp = lines.geometry.attributes.position.array
    const lc = lines.geometry.attributes.color.array
    for (let i = 0; i < pendulums.length - 1; i++) {
      const a = pendulums[i].mesh.position
      const b = pendulums[i + 1].mesh.position
      const idx = i * 6
      lp[idx] = a.x; lp[idx + 1] = a.y; lp[idx + 2] = a.z
      lp[idx + 3] = b.x; lp[idx + 4] = b.y; lp[idx + 5] = b.z

      const hue = (pendulums[i].hue + t * 0.02) % 1
      color.setHSL(hue, 0.8, 0.5)
      lc[idx] = color.r; lc[idx + 1] = color.g; lc[idx + 2] = color.b
      lc[idx + 3] = color.r; lc[idx + 4] = color.g; lc[idx + 5] = color.b
    }
    lines.geometry.attributes.position.needsUpdate = true
    lines.geometry.attributes.color.needsUpdate = true

    camera.position.x = Math.sin(t * 0.1) * 3
    camera.position.y = Math.cos(t * 0.08) * 2
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
