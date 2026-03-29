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
  camera.position.set(0, 3, 8)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)

  // Multiple concentric rings
  const rings = []
  const ringColors = [0x00ffcc, 0x0088ff, 0xaa44ff, 0x00ff88, 0xff44aa]
  for (let i = 0; i < 5; i++) {
    const radius = 1.5 + i * 0.7
    const geo = new THREE.TorusGeometry(radius, 0.02, 8, 100)
    const mat = new THREE.MeshBasicMaterial({
      color: ringColors[i], transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = Math.PI / 2 + (i - 2) * 0.15
    scene.add(mesh)
    rings.push({ mesh, radius, speed: 0.3 + i * 0.15, tilt: (i - 2) * 0.15 })
  }

  // Data particles flowing along rings
  const pCount = 600
  const pGeo = new THREE.BufferGeometry()
  const pPos = new Float32Array(pCount * 3)
  const pCol = new Float32Array(pCount * 3)
  const pData = []
  const color = new THREE.Color()
  for (let i = 0; i < pCount; i++) {
    const ringIdx = i % 5
    const r = rings[ringIdx]
    const angle = Math.random() * Math.PI * 2
    pData.push({ ringIdx, angle, speed: r.speed * (0.8 + Math.random() * 0.4) })
    pPos[i * 3] = Math.cos(angle) * r.radius
    pPos[i * 3 + 1] = 0
    pPos[i * 3 + 2] = Math.sin(angle) * r.radius
    color.set(ringColors[ringIdx])
    pCol[i * 3] = color.r; pCol[i * 3 + 1] = color.g; pCol[i * 3 + 2] = color.b
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3))
  const pMat = new THREE.PointsMaterial({
    size: 0.08, vertexColors: true, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false
  })
  const particles = new THREE.Points(pGeo, pMat)
  scene.add(particles)

  // Center hologram core
  const coreGeo = new THREE.IcosahedronGeometry(0.8, 1)
  const coreMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    wireframe: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      uniform float uTime;
      varying float vFresnel;
      void main() {
        vec3 pos = position;
        pos += normal * sin(pos.y * 5.0 + uTime * 2.0) * 0.05;
        vFresnel = pow(1.0 - abs(dot(normal, vec3(0,0,1))), 1.5);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying float vFresnel;
      void main() {
        vec3 color = mix(vec3(0.0, 1.0, 0.8), vec3(0.4, 0.0, 1.0), vFresnel);
        float alpha = 0.3 + vFresnel * 0.5;
        gl_FragColor = vec4(color, alpha);
      }
    `
  })
  const core = new THREE.Mesh(coreGeo, coreMat)
  scene.add(core)

  renderer.render(scene, camera)
  ready.value = true

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const t = time * 0.001
    coreMat.uniforms.uTime.value = t
    core.rotation.y = t * 0.5
    core.rotation.x = t * 0.3

    for (const r of rings) {
      r.mesh.rotation.z = t * r.speed
      r.mesh.rotation.x = Math.PI / 2 + r.tilt + Math.sin(t * 0.5 + r.radius) * 0.1
    }

    const pp = particles.geometry.attributes.position.array
    for (let i = 0; i < pCount; i++) {
      const d = pData[i]
      d.angle += d.speed * 0.008
      const r = rings[d.ringIdx]
      pp[i * 3] = Math.cos(d.angle) * r.radius
      pp[i * 3 + 1] = Math.sin(d.angle + t) * 0.2
      pp[i * 3 + 2] = Math.sin(d.angle) * r.radius
    }
    particles.geometry.attributes.position.needsUpdate = true

    camera.position.x = Math.sin(t * 0.12) * 3
    camera.position.y = 3 + Math.cos(t * 0.08) * 1.5
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
