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
  camera.position.set(0, 5, 12)
  camera.lookAt(0, 4, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)

  // Fractal tree using lines
  const maxDepth = 10
  const branchData = []

  const generateTree = (x, y, z, angle, angleZ, length, depth) => {
    if (depth > maxDepth || length < 0.1) return
    const endX = x + Math.sin(angle) * Math.cos(angleZ) * length
    const endY = y + Math.cos(angle) * length
    const endZ = z + Math.sin(angle) * Math.sin(angleZ) * length
    branchData.push({ sx: x, sy: y, sz: z, ex: endX, ey: endY, ez: endZ, depth })

    const spread = 0.4 + depth * 0.05
    const shrink = 0.68 + Math.random() * 0.08
    generateTree(endX, endY, endZ, angle - spread, angleZ + 0.3, length * shrink, depth + 1)
    generateTree(endX, endY, endZ, angle + spread, angleZ - 0.3, length * shrink, depth + 1)
    if (depth < 4) {
      generateTree(endX, endY, endZ, angle, angleZ + spread, length * shrink * 0.9, depth + 1)
    }
  }

  generateTree(0, 0, 0, 0, 0, 3, 0)

  // Create line segments
  const positions = new Float32Array(branchData.length * 6)
  const colors = new Float32Array(branchData.length * 6)
  const targetPositions = new Float32Array(branchData.length * 6)
  const color = new THREE.Color()

  for (let i = 0; i < branchData.length; i++) {
    const b = branchData[i]
    const idx = i * 6
    // Start collapsed at base
    positions[idx] = 0; positions[idx + 1] = 0; positions[idx + 2] = 0
    positions[idx + 3] = 0; positions[idx + 4] = 0; positions[idx + 5] = 0
    // Target
    targetPositions[idx] = b.sx; targetPositions[idx + 1] = b.sy; targetPositions[idx + 2] = b.sz
    targetPositions[idx + 3] = b.ex; targetPositions[idx + 4] = b.ey; targetPositions[idx + 5] = b.ez

    const hue = 0.3 - b.depth * 0.03
    const lightness = 0.5 + b.depth * 0.03
    color.setHSL(hue, 0.8, lightness)
    colors[idx] = color.r; colors[idx + 1] = color.g; colors[idx + 2] = color.b
    colors[idx + 3] = color.r; colors[idx + 4] = color.g; colors[idx + 5] = color.b
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
  const tree = new THREE.LineSegments(geo, mat)
  scene.add(tree)

  // Leaf particles
  const leafCount = 300
  const leafGeo = new THREE.BufferGeometry()
  const leafPos = new Float32Array(leafCount * 3)
  const leafCol = new Float32Array(leafCount * 3)
  for (let i = 0; i < leafCount; i++) {
    leafPos[i * 3] = 0; leafPos[i * 3 + 1] = 0; leafPos[i * 3 + 2] = 0
    const lc = new THREE.Color().setHSL(0.3 + Math.random() * 0.15, 0.9, 0.6)
    leafCol[i * 3] = lc.r; leafCol[i * 3 + 1] = lc.g; leafCol[i * 3 + 2] = lc.b
  }
  leafGeo.setAttribute('position', new THREE.BufferAttribute(leafPos, 3))
  leafGeo.setAttribute('color', new THREE.BufferAttribute(leafCol, 3))
  const leafMat = new THREE.PointsMaterial({
    size: 0.15,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
  const leaves = new THREE.Points(leafGeo, leafMat)
  scene.add(leaves)

  renderer.render(scene, camera)
  ready.value = true

  const CYCLE = 12 // seconds per grow cycle

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const t = time * 0.001
    const cycleT = (t % CYCLE) / CYCLE // 0 to 1

    // Grow animation
    const pos = tree.geometry.attributes.position.array
    const col = tree.geometry.attributes.color.array
    for (let i = 0; i < branchData.length; i++) {
      const b = branchData[i]
      const branchStart = b.depth / (maxDepth + 1)
      const branchEnd = (b.depth + 1) / (maxDepth + 1)
      const growProgress = Math.max(0, Math.min(1, (cycleT * 1.3 - branchStart) / (branchEnd - branchStart)))

      const idx = i * 6
      pos[idx] = targetPositions[idx]
      pos[idx + 1] = targetPositions[idx + 1]
      pos[idx + 2] = targetPositions[idx + 2]
      pos[idx + 3] = targetPositions[idx] + (targetPositions[idx + 3] - targetPositions[idx]) * growProgress
      pos[idx + 4] = targetPositions[idx + 1] + (targetPositions[idx + 4] - targetPositions[idx + 1]) * growProgress
      pos[idx + 5] = targetPositions[idx + 2] + (targetPositions[idx + 5] - targetPositions[idx + 2]) * growProgress

      // Color shift over time
      const hue = (0.3 + t * 0.02 - b.depth * 0.03) % 1
      color.setHSL(hue, 0.8, 0.5 + b.depth * 0.03)
      col[idx] = color.r; col[idx + 1] = color.g; col[idx + 2] = color.b
      col[idx + 3] = color.r; col[idx + 4] = color.g; col[idx + 5] = color.b
    }
    tree.geometry.attributes.position.needsUpdate = true
    tree.geometry.attributes.color.needsUpdate = true

    // Leaves appear at tips when grown
    const lp = leaves.geometry.attributes.position.array
    const tipBranches = branchData.filter(b => b.depth >= maxDepth - 2)
    for (let i = 0; i < leafCount; i++) {
      if (cycleT > 0.5) {
        const tb = tipBranches[i % tipBranches.length]
        const drift = Math.sin(t * 2 + i) * 0.3
        lp[i * 3] = tb.ex + drift
        lp[i * 3 + 1] = tb.ey + Math.sin(t + i * 0.5) * 0.2
        lp[i * 3 + 2] = tb.ez + Math.cos(t * 1.5 + i) * 0.2
      } else {
        lp[i * 3] = 0; lp[i * 3 + 1] = -100; lp[i * 3 + 2] = 0
      }
    }
    leaves.geometry.attributes.position.needsUpdate = true
    leafMat.opacity = cycleT > 0.5 ? Math.min(0.8, (cycleT - 0.5) * 4) : 0

    tree.rotation.y = Math.sin(t * 0.1) * 0.3
    camera.position.x = Math.sin(t * 0.15) * 4
    camera.lookAt(0, 4, 0)
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
