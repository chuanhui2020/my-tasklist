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
  camera.position.set(0, 8, 15)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)

  // Crystal lattice using InstancedMesh
  const gridSize = 5
  const spacing = 2.5
  const nodeGeo = new THREE.OctahedronGeometry(0.25, 0)
  const nodeMat = new THREE.MeshBasicMaterial({
    color: 0x44ddff, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false
  })
  const totalNodes = gridSize * gridSize * gridSize
  const nodeMesh = new THREE.InstancedMesh(nodeGeo, nodeMat, totalNodes)
  scene.add(nodeMesh)

  const dummy = new THREE.Object3D()
  const nodePositions = []
  let idx = 0
  const offset = (gridSize - 1) * spacing / 2
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      for (let z = 0; z < gridSize; z++) {
        const px = x * spacing - offset
        const py = y * spacing - offset
        const pz = z * spacing - offset
        dummy.position.set(px, py, pz)
        dummy.updateMatrix()
        nodeMesh.setMatrixAt(idx, dummy.matrix)
        nodeMesh.setColorAt(idx, new THREE.Color().setHSL(0.5 + (y / gridSize) * 0.2, 0.9, 0.6))
        nodePositions.push({ x: px, y: py, z: pz })
        idx++
      }
    }
  }
  nodeMesh.instanceMatrix.needsUpdate = true
  nodeMesh.instanceColor.needsUpdate = true

  // Connection edges
  const edges = []
  for (let i = 0; i < totalNodes; i++) {
    for (let j = i + 1; j < totalNodes; j++) {
      const dx = nodePositions[i].x - nodePositions[j].x
      const dy = nodePositions[i].y - nodePositions[j].y
      const dz = nodePositions[i].z - nodePositions[j].z
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz)
      if (Math.abs(dist - spacing) < 0.1) {
        edges.push([i, j])
      }
    }
  }

  const edgeGeo = new THREE.BufferGeometry()
  const edgePos = new Float32Array(edges.length * 6)
  const edgeCol = new Float32Array(edges.length * 6)
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePos, 3))
  edgeGeo.setAttribute('color', new THREE.BufferAttribute(edgeCol, 3))
  const edgeMat = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false
  })
  const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat)
  scene.add(edgeLines)

  // Energy pulses along edges
  const pulseCount = 100
  const pulseGeo = new THREE.BufferGeometry()
  const pulsePos = new Float32Array(pulseCount * 3)
  pulseGeo.setAttribute('position', new THREE.BufferAttribute(pulsePos, 3))
  const pulseMat = new THREE.PointsMaterial({
    size: 0.15, color: 0x88ffff, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false
  })
  const pulsePts = new THREE.Points(pulseGeo, pulseMat)
  scene.add(pulsePts)

  const pulseData = []
  for (let i = 0; i < pulseCount; i++) {
    const eIdx = Math.floor(Math.random() * edges.length)
    pulseData.push({ edgeIdx: eIdx, t: Math.random(), speed: 0.005 + Math.random() * 0.01 })
  }

  const color = new THREE.Color()

  renderer.render(scene, camera)
  ready.value = true

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const t = time * 0.001

    // Rotate lattice
    nodeMesh.rotation.y = t * 0.15
    nodeMesh.rotation.x = Math.sin(t * 0.1) * 0.2
    edgeLines.rotation.copy(nodeMesh.rotation)
    pulsePts.rotation.copy(nodeMesh.rotation)

    // Pulse node colors
    for (let i = 0; i < totalNodes; i++) {
      const n = nodePositions[i]
      const wave = Math.sin(t * 2 + n.x * 0.5 + n.y * 0.5 + n.z * 0.5) * 0.5 + 0.5
      color.setHSL(0.5 + wave * 0.2, 0.9, 0.4 + wave * 0.4)
      nodeMesh.setColorAt(i, color)
      dummy.position.set(n.x, n.y, n.z)
      dummy.scale.setScalar(0.8 + wave * 0.5)
      dummy.updateMatrix()
      nodeMesh.setMatrixAt(i, dummy.matrix)
    }
    nodeMesh.instanceMatrix.needsUpdate = true
    nodeMesh.instanceColor.needsUpdate = true

    // Update edges
    const ep = edgeLines.geometry.attributes.position.array
    const ec = edgeLines.geometry.attributes.color.array
    for (let i = 0; i < edges.length; i++) {
      const [a, b] = edges[i]
      const na = nodePositions[a], nb = nodePositions[b]
      const i6 = i * 6
      ep[i6] = na.x; ep[i6+1] = na.y; ep[i6+2] = na.z
      ep[i6+3] = nb.x; ep[i6+4] = nb.y; ep[i6+5] = nb.z
      const hue = (t * 0.05 + i * 0.01) % 1
      color.setHSL(hue, 0.7, 0.4)
      ec[i6] = color.r; ec[i6+1] = color.g; ec[i6+2] = color.b
      ec[i6+3] = color.r; ec[i6+4] = color.g; ec[i6+5] = color.b
    }
    edgeLines.geometry.attributes.position.needsUpdate = true
    edgeLines.geometry.attributes.color.needsUpdate = true

    // Move pulses
    const pp = pulsePts.geometry.attributes.position.array
    for (let i = 0; i < pulseCount; i++) {
      const d = pulseData[i]
      d.t += d.speed
      if (d.t > 1) { d.t = 0; d.edgeIdx = Math.floor(Math.random() * edges.length) }
      const [a, b] = edges[d.edgeIdx]
      const na = nodePositions[a], nb = nodePositions[b]
      pp[i*3] = na.x + (nb.x - na.x) * d.t
      pp[i*3+1] = na.y + (nb.y - na.y) * d.t
      pp[i*3+2] = na.z + (nb.z - na.z) * d.t
    }
    pulsePts.geometry.attributes.position.needsUpdate = true

    camera.position.x = Math.sin(t * 0.12) * 12
    camera.position.y = 8 + Math.cos(t * 0.08) * 4
    camera.position.z = Math.cos(t * 0.12) * 12
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
