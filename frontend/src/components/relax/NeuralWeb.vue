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
  camera.position.set(0, 0, 35)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)

  // Neural nodes in 3D space
  const nodeCount = 80
  const nodeGeo = new THREE.SphereGeometry(0.3, 12, 12)
  const nodes = []
  for (let i = 0; i < nodeCount; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(0.55, 0.9, 0.5),
      transparent: true, opacity: 0.8
    })
    const mesh = new THREE.Mesh(nodeGeo, mat)
    mesh.position.set(
      (Math.random() - 0.5) * 40,
      (Math.random() - 0.5) * 25,
      (Math.random() - 0.5) * 20
    )
    scene.add(mesh)
    nodes.push({ mesh, baseHue: 0.5 + Math.random() * 0.2, activation: 0, cooldown: 0 })
  }

  // Connection lines
  const maxConn = 300
  const lineGeo = new THREE.BufferGeometry()
  const linePos = new Float32Array(maxConn * 6)
  const lineCol = new Float32Array(maxConn * 6)
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3))
  lineGeo.setAttribute('color', new THREE.BufferAttribute(lineCol, 3))
  const lineMat = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false
  })
  const lines = new THREE.LineSegments(lineGeo, lineMat)
  scene.add(lines)

  // Pulse particles traveling along connections
  const pulseCount = 200
  const pulseGeo = new THREE.BufferGeometry()
  const pulsePos = new Float32Array(pulseCount * 3)
  const pulseCol = new Float32Array(pulseCount * 3)
  pulseGeo.setAttribute('position', new THREE.BufferAttribute(pulsePos, 3))
  pulseGeo.setAttribute('color', new THREE.BufferAttribute(pulseCol, 3))
  const pulseMat = new THREE.PointsMaterial({
    size: 0.2, vertexColors: true, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false
  })
  const pulses = new THREE.Points(pulseGeo, pulseMat)
  scene.add(pulses)

  const pulseData = []
  for (let i = 0; i < pulseCount; i++) {
    pulseData.push({ from: 0, to: 0, t: 0, active: false, speed: 0 })
  }

  const connectDist = 10
  const color = new THREE.Color()

  renderer.render(scene, camera)
  ready.value = true

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const t = time * 0.001

    // Random activation
    if (Math.random() < 0.05) {
      const idx = Math.floor(Math.random() * nodeCount)
      nodes[idx].activation = 1.0
    }

    // Update nodes
    for (const n of nodes) {
      if (n.activation > 0) {
        n.activation *= 0.97
        const scale = 1 + n.activation * 1.5
        n.mesh.scale.setScalar(scale)
        n.mesh.material.color.setHSL(n.baseHue, 0.9, 0.5 + n.activation * 0.4)
      } else {
        n.mesh.scale.setScalar(1)
        n.mesh.material.color.setHSL(n.baseHue, 0.9, 0.5)
      }
    }

    // Build connections + spawn pulses
    let lineIdx = 0
    const lp = lines.geometry.attributes.position.array
    const lc = lines.geometry.attributes.color.array
    for (let i = 0; i < nodeCount && lineIdx < maxConn; i++) {
      for (let j = i + 1; j < nodeCount && lineIdx < maxConn; j++) {
        const dx = nodes[i].mesh.position.x - nodes[j].mesh.position.x
        const dy = nodes[i].mesh.position.y - nodes[j].mesh.position.y
        const dz = nodes[i].mesh.position.z - nodes[j].mesh.position.z
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (dist < connectDist) {
          const alpha = 1 - dist / connectDist
          const idx6 = lineIdx * 6
          lp[idx6] = nodes[i].mesh.position.x; lp[idx6+1] = nodes[i].mesh.position.y; lp[idx6+2] = nodes[i].mesh.position.z
          lp[idx6+3] = nodes[j].mesh.position.x; lp[idx6+4] = nodes[j].mesh.position.y; lp[idx6+5] = nodes[j].mesh.position.z
          color.setHSL(0.55, 0.8, 0.4)
          lc[idx6] = color.r*alpha; lc[idx6+1] = color.g*alpha; lc[idx6+2] = color.b*alpha
          lc[idx6+3] = color.r*alpha; lc[idx6+4] = color.g*alpha; lc[idx6+5] = color.b*alpha

          // Spawn pulse when node activates
          if (nodes[i].activation > 0.8 || nodes[j].activation > 0.8) {
            for (const pd of pulseData) {
              if (!pd.active) {
                pd.from = i; pd.to = j; pd.t = 0; pd.active = true
                pd.speed = 0.02 + Math.random() * 0.02
                break
              }
            }
          }
          lineIdx++
        }
      }
    }
    for (let i = lineIdx * 6; i < maxConn * 6; i++) { lp[i] = 0; lc[i] = 0 }
    lines.geometry.attributes.position.needsUpdate = true
    lines.geometry.attributes.color.needsUpdate = true
    lines.geometry.setDrawRange(0, lineIdx * 2)

    // Update pulses
    const pp = pulses.geometry.attributes.position.array
    const pc = pulses.geometry.attributes.color.array
    for (let i = 0; i < pulseCount; i++) {
      const pd = pulseData[i]
      if (pd.active) {
        pd.t += pd.speed
        if (pd.t >= 1) {
          pd.active = false
          nodes[pd.to].activation = Math.max(nodes[pd.to].activation, 0.6)
          pp[i*3] = 0; pp[i*3+1] = -100; pp[i*3+2] = 0
        } else {
          const a = nodes[pd.from].mesh.position
          const b = nodes[pd.to].mesh.position
          pp[i*3] = a.x + (b.x - a.x) * pd.t
          pp[i*3+1] = a.y + (b.y - a.y) * pd.t
          pp[i*3+2] = a.z + (b.z - a.z) * pd.t
          color.setHSL(0.5, 1, 0.7)
          pc[i*3] = color.r; pc[i*3+1] = color.g; pc[i*3+2] = color.b
        }
      } else {
        pp[i*3] = 0; pp[i*3+1] = -100; pp[i*3+2] = 0
      }
    }
    pulses.geometry.attributes.position.needsUpdate = true
    pulses.geometry.attributes.color.needsUpdate = true

    camera.position.x = Math.sin(t * 0.12) * 10
    camera.position.y = Math.cos(t * 0.08) * 5
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
