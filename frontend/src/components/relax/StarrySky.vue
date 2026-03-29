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
  camera.position.set(0, 8, 18)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)

  const ambientLight = new THREE.AmbientLight(0x334466, 0.5)
  scene.add(ambientLight)
  const dirLight = new THREE.DirectionalLight(0x88aaff, 1)
  dirLight.position.set(5, 10, 5)
  scene.add(dirLight)

  // DNA helix
  const helixGroup = new THREE.Group()
  scene.add(helixGroup)

  const sphereGeo = new THREE.SphereGeometry(0.25, 12, 12)
  const strandCount = 60
  const radius = 3
  const height = 20
  const strand1 = []
  const strand2 = []

  for (let i = 0; i < strandCount; i++) {
    const t = i / strandCount
    const angle = t * Math.PI * 4
    const y = (t - 0.5) * height

    // Strand 1
    const mat1 = new THREE.MeshPhongMaterial({
      color: new THREE.Color().setHSL(0.55, 0.9, 0.6),
      emissive: new THREE.Color().setHSL(0.55, 0.5, 0.2),
      transparent: true,
      opacity: 0.9
    })
    const s1 = new THREE.Mesh(sphereGeo, mat1)
    s1.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
    helixGroup.add(s1)
    strand1.push(s1)

    // Strand 2 (opposite)
    const mat2 = new THREE.MeshPhongMaterial({
      color: new THREE.Color().setHSL(0.8, 0.9, 0.6),
      emissive: new THREE.Color().setHSL(0.8, 0.5, 0.2),
      transparent: true,
      opacity: 0.9
    })
    const s2 = new THREE.Mesh(sphereGeo, mat2)
    s2.position.set(Math.cos(angle + Math.PI) * radius, y, Math.sin(angle + Math.PI) * radius)
    helixGroup.add(s2)
    strand2.push(s2)

    // Connecting rungs (every 3rd)
    if (i % 3 === 0) {
      const rungGeo = new THREE.CylinderGeometry(0.06, 0.06, radius * 2, 6)
      const rungMat = new THREE.MeshPhongMaterial({
        color: 0x44ffaa,
        emissive: 0x114422,
        transparent: true,
        opacity: 0.5
      })
      const rung = new THREE.Mesh(rungGeo, rungMat)
      rung.position.set(0, y, 0)
      rung.rotation.z = Math.PI / 2
      rung.rotation.y = angle
      helixGroup.add(rung)
    }
  }

  // Backbone lines
  for (const strand of [strand1, strand2]) {
    const points = strand.map(s => s.position.clone())
    const curve = new THREE.CatmullRomCurve3(points)
    const tubeGeo = new THREE.TubeGeometry(curve, strandCount * 2, 0.08, 6, false)
    const tubeMat = new THREE.MeshPhongMaterial({
      color: 0x66aaff,
      emissive: 0x112244,
      transparent: true,
      opacity: 0.6
    })
    helixGroup.add(new THREE.Mesh(tubeGeo, tubeMat))
  }

  // Floating particles
  const pCount = 400
  const pGeo = new THREE.BufferGeometry()
  const pPos = new Float32Array(pCount * 3)
  for (let i = 0; i < pCount; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 15
    pPos[i * 3 + 1] = (Math.random() - 0.5) * 20
    pPos[i * 3 + 2] = (Math.random() - 0.5) * 15
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
  const pMat = new THREE.PointsMaterial({
    color: 0x88ccff,
    size: 0.1,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
  const particles = new THREE.Points(pGeo, pMat)
  scene.add(particles)

  renderer.render(scene, camera)
  ready.value = true

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const t = time * 0.001

    helixGroup.rotation.y = t * 0.3

    // Pulse colors
    for (let i = 0; i < strand1.length; i++) {
      const pulse = 0.5 + Math.sin(t * 2 + i * 0.2) * 0.3
      strand1[i].material.emissive.setHSL(0.55, 0.5, pulse * 0.3)
      strand2[i].material.emissive.setHSL(0.8, 0.5, pulse * 0.3)
      strand1[i].scale.setScalar(0.8 + pulse * 0.4)
      strand2[i].scale.setScalar(0.8 + pulse * 0.4)
    }

    // Float particles
    const pp = particles.geometry.attributes.position.array
    for (let i = 0; i < pCount; i++) {
      pp[i * 3 + 1] += Math.sin(t + i) * 0.005
      pp[i * 3] += Math.cos(t * 0.5 + i) * 0.003
    }
    particles.geometry.attributes.position.needsUpdate = true

    camera.position.x = Math.sin(t * 0.2) * 6
    camera.position.z = 16 + Math.cos(t * 0.15) * 4
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
