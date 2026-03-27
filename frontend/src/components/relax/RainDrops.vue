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
  camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 500)
  camera.position.set(0, 20, 60)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)

  // Spiral galaxy particles
  const COUNT = 8000
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(COUNT * 3)
  const colors = new Float32Array(COUNT * 3)
  const sizes = new Float32Array(COUNT)
  const arms = 3
  const color = new THREE.Color()

  for (let i = 0; i < COUNT; i++) {
    const arm = i % arms
    const armAngle = (arm / arms) * Math.PI * 2
    const dist = Math.random() * 40
    const spread = (Math.random() - 0.5) * (dist * 0.15)
    const spreadY = (Math.random() - 0.5) * 1.5
    const spiralAngle = dist * 0.3 + armAngle

    positions[i * 3] = Math.cos(spiralAngle) * dist + spread
    positions[i * 3 + 1] = spreadY
    positions[i * 3 + 2] = Math.sin(spiralAngle) * dist + spread

    const hue = 0.55 + dist * 0.005 + (Math.random() - 0.5) * 0.1
    color.setHSL(hue, 0.8, 0.5 + Math.random() * 0.3)
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
    sizes[i] = 0.3 + Math.random() * 0.5
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

  const material = new THREE.PointsMaterial({
    size: 0.4,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })

  const galaxy = new THREE.Points(geometry, material)
  scene.add(galaxy)

  // Core glow
  const coreGeo = new THREE.SphereGeometry(2, 32, 32)
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.3 })
  scene.add(new THREE.Mesh(coreGeo, coreMat))

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const t = time * 0.0003
    galaxy.rotation.y = t
    camera.position.x = Math.sin(t * 0.5) * 15
    camera.position.z = 50 + Math.cos(t * 0.3) * 10
    camera.lookAt(0, 0, 0)
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
