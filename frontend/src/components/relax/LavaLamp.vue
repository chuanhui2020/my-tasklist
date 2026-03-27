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
  camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 200)
  camera.position.z = 5

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)

  // Tunnel rings
  const ringCount = 60
  const rings = []

  for (let i = 0; i < ringCount; i++) {
    const sides = 6 + Math.floor(Math.random() * 3) * 2
    const geo = new THREE.RingGeometry(3 + Math.random() * 2, 3.1 + Math.random() * 2, sides)
    const hue = (i / ringCount) * 0.3 + 0.5
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(hue, 0.9, 0.5),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.z = -i * 3
    mesh.rotation.z = i * 0.1
    scene.add(mesh)
    rings.push(mesh)
  }

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const t = time * 0.001

    for (let i = 0; i < rings.length; i++) {
      const ring = rings[i]
      ring.position.z += 0.3
      ring.rotation.z += 0.003

      if (ring.position.z > 5) {
        ring.position.z = -ringCount * 3 + 5
      }

      const dist = Math.abs(ring.position.z)
      ring.material.opacity = Math.max(0, 0.6 - dist * 0.004)

      const pulse = 1 + Math.sin(t * 2 + i * 0.2) * 0.1
      ring.scale.set(pulse, pulse, 1)

      const hue = ((t * 0.05 + i * 0.02) % 1)
      ring.material.color.setHSL(hue, 0.9, 0.5)
    }

    camera.rotation.z = Math.sin(t * 0.3) * 0.1
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
