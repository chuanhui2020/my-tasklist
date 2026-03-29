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
  camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100)
  camera.position.set(0, 15, 20)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)

  // PCB traces as line segments on a flat plane
  const traceCount = 40
  const traces = []
  const traceGeo = new THREE.BufferGeometry()
  const maxSegments = 800
  const tracePos = new Float32Array(maxSegments * 6)
  const traceCol = new Float32Array(maxSegments * 6)
  traceGeo.setAttribute('position', new THREE.BufferAttribute(tracePos, 3))
  traceGeo.setAttribute('color', new THREE.BufferAttribute(traceCol, 3))
  const traceMat = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  })
  const traceLines = new THREE.LineSegments(traceGeo, traceMat)
  scene.add(traceLines)

  // Generate circuit paths (right-angle traces)
  let segIdx = 0
  const color = new THREE.Color()
  for (let i = 0; i < traceCount; i++) {
    let x = (Math.random() - 0.5) * 20
    let z = (Math.random() - 0.5) * 20
    const segments = 5 + Math.floor(Math.random() * 10)
    const hue = 0.45 + Math.random() * 0.25
    const traceSegs = []
    for (let j = 0; j < segments && segIdx < maxSegments; j++) {
      const horizontal = Math.random() > 0.5
      const len = 1 + Math.random() * 3
      const nx = horizontal ? x + (Math.random() > 0.5 ? len : -len) : x
      const nz = horizontal ? z : z + (Math.random() > 0.5 ? len : -len)
      const i6 = segIdx * 6
      tracePos[i6] = x; tracePos[i6+1] = 0; tracePos[i6+2] = z
      tracePos[i6+3] = nx; tracePos[i6+4] = 0; tracePos[i6+5] = nz
      color.setHSL(hue, 0.8, 0.4)
      traceCol[i6] = color.r; traceCol[i6+1] = color.g; traceCol[i6+2] = color.b
      traceCol[i6+3] = color.r; traceCol[i6+4] = color.g; traceCol[i6+5] = color.b
      traceSegs.push({ idx: segIdx, sx: x, sz: z, ex: nx, ez: nz, hue })
      x = nx; z = nz
      segIdx++
    }
    traces.push(traceSegs)
  }
  traceGeo.setDrawRange(0, segIdx * 2)

  // Chip nodes at trace intersections
  const chipCount = 12
  const chipGeo = new THREE.BoxGeometry(1.2, 0.3, 1.2)
  const chips = []
  for (let i = 0; i < chipCount; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(0.55, 0.9, 0.4),
      transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
    const mesh = new THREE.Mesh(chipGeo, mat)
    mesh.position.set((Math.random() - 0.5) * 18, 0.15, (Math.random() - 0.5) * 18)
    scene.add(mesh)
    chips.push({ mesh, phase: Math.random() * Math.PI * 2, hue: 0.5 + Math.random() * 0.2 })
  }

  // Current flow particles
  const pCount = 500
  const pGeo = new THREE.BufferGeometry()
  const pPos = new Float32Array(pCount * 3)
  const pCol = new Float32Array(pCount * 3)
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3))
  const pMat = new THREE.PointsMaterial({
    size: 0.12, vertexColors: true, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false
  })
  const particles = new THREE.Points(pGeo, pMat)
  scene.add(particles)

  const pData = []
  for (let i = 0; i < pCount; i++) {
    const traceIdx = Math.floor(Math.random() * traces.length)
    const segs = traces[traceIdx]
    if (segs.length === 0) {
      pData.push({ traceIdx: 0, segIdx: 0, t: 0, speed: 0.02 })
      continue
    }
    pData.push({
      traceIdx, segIdx: Math.floor(Math.random() * segs.length),
      t: Math.random(), speed: 0.01 + Math.random() * 0.03
    })
  }

  // Subtle grid underlay
  const gridHelper = new THREE.GridHelper(24, 24, 0x112233, 0x112233)
  gridHelper.material.transparent = true
  gridHelper.material.opacity = 0.2
  scene.add(gridHelper)

  renderer.render(scene, camera)
  ready.value = true

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const t = time * 0.001

    // Pulse chips
    for (const c of chips) {
      const pulse = 0.5 + Math.sin(t * 3 + c.phase) * 0.5
      c.mesh.material.color.setHSL(c.hue, 0.9, 0.3 + pulse * 0.5)
      c.mesh.material.opacity = 0.4 + pulse * 0.4
      c.mesh.scale.y = 1 + pulse * 0.5
    }

    // Pulse trace colors
    const tc = traceLines.geometry.attributes.color.array
    for (const traceSegs of traces) {
      for (const seg of traceSegs) {
        const wave = 0.5 + Math.sin(t * 2 + seg.sx * 0.5 + seg.sz * 0.5) * 0.5
        color.setHSL(seg.hue, 0.8, 0.3 + wave * 0.4)
        const i6 = seg.idx * 6
        tc[i6] = color.r; tc[i6+1] = color.g; tc[i6+2] = color.b
        tc[i6+3] = color.r; tc[i6+4] = color.g; tc[i6+5] = color.b
      }
    }
    traceLines.geometry.attributes.color.needsUpdate = true

    // Move current particles along traces
    const pp = particles.geometry.attributes.position.array
    const pc = particles.geometry.attributes.color.array
    for (let i = 0; i < pCount; i++) {
      const d = pData[i]
      const segs = traces[d.traceIdx]
      if (!segs || segs.length === 0) continue
      d.t += d.speed
      if (d.t > 1) {
        d.t = 0
        d.segIdx = (d.segIdx + 1) % segs.length
      }
      const seg = segs[d.segIdx]
      pp[i*3] = seg.sx + (seg.ex - seg.sx) * d.t
      pp[i*3+1] = 0.1
      pp[i*3+2] = seg.sz + (seg.ez - seg.sz) * d.t
      color.setHSL(seg.hue, 1, 0.7)
      pc[i*3] = color.r; pc[i*3+1] = color.g; pc[i*3+2] = color.b
    }
    particles.geometry.attributes.position.needsUpdate = true
    particles.geometry.attributes.color.needsUpdate = true

    camera.position.x = Math.sin(t * 0.1) * 5
    camera.position.z = 18 + Math.cos(t * 0.08) * 4
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
