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
  camera.position.set(0, 5, 20)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)

  // Data stream curves
  const streamCount = 8
  const streams = []
  const streamColors = [0x00ffcc, 0x0088ff, 0x8844ff, 0x00ff88, 0xff4488, 0x44ccff, 0xaaff00, 0xff8800]

  for (let s = 0; s < streamCount; s++) {
    const points = []
    const baseY = (s - streamCount / 2) * 2
    const baseZ = (Math.random() - 0.5) * 10
    for (let i = 0; i <= 50; i++) {
      const t = i / 50
      points.push(new THREE.Vector3(
        (t - 0.5) * 30,
        baseY + Math.sin(t * Math.PI * 3 + s) * 2,
        baseZ + Math.cos(t * Math.PI * 2 + s * 0.5) * 3
      ))
    }
    const curve = new THREE.CatmullRomCurve3(points)
    const tubeGeo = new THREE.TubeGeometry(curve, 80, 0.03, 6, false)
    const tubeMat = new THREE.MeshBasicMaterial({
      color: streamColors[s], transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
    const tube = new THREE.Mesh(tubeGeo, tubeMat)
    scene.add(tube)
    streams.push({ curve, tube, color: streamColors[s], baseY, baseZ })
  }

  // Data particles flowing along streams
  const pCount = 800
  const pGeo = new THREE.BufferGeometry()
  const pPos = new Float32Array(pCount * 3)
  const pCol = new Float32Array(pCount * 3)
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3))
  const pMat = new THREE.PointsMaterial({
    size: 0.12, vertexColors: true, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false
  })
  const particles = new THREE.Points(pGeo, pMat)
  scene.add(particles)

  const pData = []
  const color = new THREE.Color()
  for (let i = 0; i < pCount; i++) {
    const sIdx = i % streamCount
    pData.push({ streamIdx: sIdx, t: Math.random(), speed: 0.003 + Math.random() * 0.005 })
    color.set(streamColors[sIdx])
    pCol[i*3] = color.r; pCol[i*3+1] = color.g; pCol[i*3+2] = color.b
  }

  // Junction nodes where streams cross
  const nodeGeo = new THREE.SphereGeometry(0.2, 12, 12)
  const junctions = []
  for (let i = 0; i < 6; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ffff, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
    const mesh = new THREE.Mesh(nodeGeo, mat)
    mesh.position.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6)
    scene.add(mesh)
    junctions.push({ mesh, phase: Math.random() * Math.PI * 2 })
  }

  renderer.render(scene, camera)
  ready.value = true

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const t = time * 0.001

    // Update stream curves dynamically
    for (let s = 0; s < streamCount; s++) {
      const st = streams[s]
      const points = []
      for (let i = 0; i <= 50; i++) {
        const u = i / 50
        points.push(new THREE.Vector3(
          (u - 0.5) * 30,
          st.baseY + Math.sin(u * Math.PI * 3 + s + t * 0.5) * 2,
          st.baseZ + Math.cos(u * Math.PI * 2 + s * 0.5 + t * 0.3) * 3
        ))
      }
      st.curve = new THREE.CatmullRomCurve3(points)
    }

    // Move particles along streams
    const pp = particles.geometry.attributes.position.array
    for (let i = 0; i < pCount; i++) {
      const d = pData[i]
      d.t += d.speed
      if (d.t > 1) d.t -= 1
      const pt = streams[d.streamIdx].curve.getPoint(d.t)
      pp[i*3] = pt.x + (Math.random() - 0.5) * 0.1
      pp[i*3+1] = pt.y + (Math.random() - 0.5) * 0.1
      pp[i*3+2] = pt.z + (Math.random() - 0.5) * 0.1
    }
    particles.geometry.attributes.position.needsUpdate = true

    // Pulse junctions
    for (const j of junctions) {
      const pulse = 0.5 + Math.sin(t * 3 + j.phase) * 0.5
      j.mesh.scale.setScalar(0.8 + pulse * 1.2)
      j.mesh.material.opacity = 0.3 + pulse * 0.5
    }

    camera.position.x = Math.sin(t * 0.1) * 5
    camera.position.y = 5 + Math.cos(t * 0.08) * 3
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
