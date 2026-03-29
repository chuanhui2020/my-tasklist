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
  camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 100)
  camera.position.z = 30

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)

  // Character set
  const charSet = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF'
  const colCount = 50
  const charsPerCol = 22
  const totalInstances = colCount * charsPerCol

  // Build a single texture atlas (one canvas, all characters in a grid)
  const atlasSize = 8 // 8x8 grid = 64 slots
  const cellSize = 64
  const atlas = document.createElement('canvas')
  atlas.width = atlas.height = atlasSize * cellSize
  const actx = atlas.getContext('2d')
  actx.fillStyle = '#000000'
  actx.fillRect(0, 0, atlas.width, atlas.height)
  actx.font = `bold ${cellSize * 0.75}px monospace`
  actx.textAlign = 'center'
  actx.textBaseline = 'middle'
  actx.fillStyle = '#00ff64'

  for (let i = 0; i < charSet.length; i++) {
    const col = i % atlasSize
    const row = Math.floor(i / atlasSize)
    actx.fillText(charSet[i], col * cellSize + cellSize / 2, row * cellSize + cellSize / 2)
  }
  const atlasTexture = new THREE.CanvasTexture(atlas)
  atlasTexture.minFilter = THREE.LinearFilter
  atlasTexture.magFilter = THREE.LinearFilter

  // InstancedMesh — single draw call for all characters
  const planeGeo = new THREE.PlaneGeometry(0.8, 0.8)
  const material = new THREE.MeshBasicMaterial({
    map: atlasTexture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
  const mesh = new THREE.InstancedMesh(planeGeo, material, totalInstances)
  scene.add(mesh)

  // Per-instance UV offset via custom attribute + shader override
  // Simpler approach: use color to encode brightness, keep shared texture
  const dummy = new THREE.Object3D()
  const columns = []
  let idx = 0

  for (let i = 0; i < colCount; i++) {
    const x = (i - colCount / 2) * 1.1
    const speed = 2 + Math.random() * 4
    const offset = Math.random() * 30
    const startIdx = idx

    for (let j = 0; j < charsPerCol; j++) {
      dummy.position.set(x, -j * 0.9, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(idx, dummy.matrix)
      // Head character bright white, tail fades to green
      const brightness = j === 0 ? 1.0 : Math.max(0.08, 1 - j / charsPerCol)
      const color = j === 0
        ? new THREE.Color(1, 1, 1)
        : new THREE.Color(0, brightness, brightness * 0.4)
      mesh.setColorAt(idx, color)
      idx++
    }
    columns.push({ x, speed, offset, startIdx })
  }
  mesh.instanceMatrix.needsUpdate = true
  mesh.instanceColor.needsUpdate = true

  // First frame
  renderer.render(scene, camera)
  ready.value = true

  // Animation loop
  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const t = time * 0.001

    for (const col of columns) {
      const baseY = ((t * col.speed + col.offset) % 40) - 10
      for (let j = 0; j < charsPerCol; j++) {
        dummy.position.set(col.x, baseY - j * 0.9, 0)
        dummy.updateMatrix()
        mesh.setMatrixAt(col.startIdx + j, dummy.matrix)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
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
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(6,182,212,0.08), rgba(139,92,246,0.08));
  border-radius: 12px;
}
.anim-placeholder-pulse {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(6,182,212,0.2);
  border-top-color: rgba(6,182,212,0.8);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
