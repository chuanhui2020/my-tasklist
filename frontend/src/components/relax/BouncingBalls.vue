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
  camera.position.set(0, 0, 40)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)

  // Nodes
  const COUNT = 120
  const nodes = []
  const nodeGeo = new THREE.SphereGeometry(0.2, 8, 8)

  for (let i = 0; i < COUNT; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(0.5 + Math.random() * 0.2, 0.8, 0.6),
      transparent: true,
      opacity: 0.8
    })
    const mesh = new THREE.Mesh(nodeGeo, mat)
    mesh.position.set(
      (Math.random() - 0.5) * 50,
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 20
    )
    scene.add(mesh)
    nodes.push({
      mesh,
      vx: (Math.random() - 0.5) * 0.03,
      vy: (Math.random() - 0.5) * 0.03,
      vz: (Math.random() - 0.5) * 0.02
    })
  }

  // Lines
  const lineGeo = new THREE.BufferGeometry()
  const maxLines = COUNT * 6
  const linePositions = new Float32Array(maxLines * 6)
  const lineColors = new Float32Array(maxLines * 6)
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
  lineGeo.setAttribute('color', new THREE.BufferAttribute(lineColors, 3))
  const lineMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
  const lines = new THREE.LineSegments(lineGeo, lineMat)
  scene.add(lines)

  const connectDist = 8
  const color = new THREE.Color()

  renderer.render(scene, camera)
  ready.value = true

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const t = time * 0.001

    // Move nodes
    for (const n of nodes) {
      n.mesh.position.x += n.vx
      n.mesh.position.y += n.vy
      n.mesh.position.z += n.vz
      if (Math.abs(n.mesh.position.x) > 25) n.vx *= -1
      if (Math.abs(n.mesh.position.y) > 15) n.vy *= -1
      if (Math.abs(n.mesh.position.z) > 10) n.vz *= -1

      const pulse = 0.15 + Math.sin(t * 2 + n.mesh.position.x) * 0.05
      n.mesh.scale.setScalar(pulse / 0.2)
    }

    // Update connections
    let lineIdx = 0
    const pos = lines.geometry.attributes.position.array
    const col = lines.geometry.attributes.color.array

    for (let i = 0; i < nodes.length && lineIdx < maxLines; i++) {
      for (let j = i + 1; j < nodes.length && lineIdx < maxLines; j++) {
        const dx = nodes[i].mesh.position.x - nodes[j].mesh.position.x
        const dy = nodes[i].mesh.position.y - nodes[j].mesh.position.y
        const dz = nodes[i].mesh.position.z - nodes[j].mesh.position.z
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

        if (dist < connectDist) {
          const alpha = 1 - dist / connectDist
          const hue = (t * 0.05 + dist * 0.02) % 1
          color.setHSL(hue, 0.8, 0.5)

          const idx = lineIdx * 6
          pos[idx] = nodes[i].mesh.position.x
          pos[idx + 1] = nodes[i].mesh.position.y
          pos[idx + 2] = nodes[i].mesh.position.z
          pos[idx + 3] = nodes[j].mesh.position.x
          pos[idx + 4] = nodes[j].mesh.position.y
          pos[idx + 5] = nodes[j].mesh.position.z

          col[idx] = color.r * alpha
          col[idx + 1] = color.g * alpha
          col[idx + 2] = color.b * alpha
          col[idx + 3] = color.r * alpha
          col[idx + 4] = color.g * alpha
          col[idx + 5] = color.b * alpha

          lineIdx++
        }
      }
    }

    // Clear remaining
    for (let i = lineIdx * 6; i < maxLines * 6; i++) {
      pos[i] = 0
      col[i] = 0
    }

    lines.geometry.attributes.position.needsUpdate = true
    lines.geometry.attributes.color.needsUpdate = true
    lines.geometry.setDrawRange(0, lineIdx * 2)

    camera.position.x = Math.sin(t * 0.2) * 5
    camera.position.y = Math.cos(t * 0.15) * 3
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
