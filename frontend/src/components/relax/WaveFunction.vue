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
  camera.position.set(0, 15, 30)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)

  // 3D wave function surface
  const gridSize = 60
  const geo = new THREE.PlaneGeometry(30, 30, gridSize, gridSize)
  geo.rotateX(-Math.PI / 2)
  const mat = new THREE.ShaderMaterial({
    transparent: true, wireframe: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      uniform float uTime;
      varying float vHeight;
      varying float vDist;
      void main() {
        vec3 pos = position;
        float dist = length(pos.xz);
        float wave1 = sin(dist * 0.8 - uTime * 2.0) * exp(-dist * 0.05);
        float wave2 = sin(dist * 1.2 - uTime * 3.0 + 1.0) * exp(-dist * 0.08) * 0.5;
        float wave3 = cos(pos.x * 0.5 + uTime) * cos(pos.z * 0.5 + uTime * 0.7) * 0.8;
        pos.y = (wave1 + wave2 + wave3) * 3.0;
        vHeight = pos.y;
        vDist = dist;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying float vHeight;
      varying float vDist;
      void main() {
        float t = (vHeight + 3.0) / 6.0;
        vec3 col1 = vec3(0.0, 0.5, 1.0);
        vec3 col2 = vec3(0.5, 0.0, 1.0);
        vec3 col3 = vec3(0.0, 1.0, 0.8);
        vec3 color = mix(col1, col2, t);
        color = mix(color, col3, sin(uTime * 0.5) * 0.5 + 0.5);
        float alpha = 0.3 + abs(vHeight) * 0.1;
        float fade = smoothstep(20.0, 5.0, vDist);
        gl_FragColor = vec4(color, alpha * fade);
      }
    `
  })
  const surface = new THREE.Mesh(geo, mat)
  scene.add(surface)

  // Probability cloud particles
  const pCount = 1000
  const pGeo = new THREE.BufferGeometry()
  const pPos = new Float32Array(pCount * 3)
  const pCol = new Float32Array(pCount * 3)
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3))

  const pData = []
  const color = new THREE.Color()
  for (let i = 0; i < pCount; i++) {
    const x = (Math.random() - 0.5) * 30
    const z = (Math.random() - 0.5) * 30
    const y = (Math.random() - 0.5) * 6
    pPos[i*3] = x; pPos[i*3+1] = y; pPos[i*3+2] = z
    pData.push({ x, z, phase: Math.random() * Math.PI * 2 })
    color.setHSL(0.6 + Math.random() * 0.15, 0.8, 0.5 + Math.random() * 0.3)
    pCol[i*3] = color.r; pCol[i*3+1] = color.g; pCol[i*3+2] = color.b
  }

  const pMat = new THREE.PointsMaterial({
    size: 0.15, vertexColors: true, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  })
  const particles = new THREE.Points(pGeo, pMat)
  scene.add(particles)

  renderer.render(scene, camera)
  ready.value = true

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const t = time * 0.001
    mat.uniforms.uTime.value = t

    // Particles follow wave function probability
    const pp = particles.geometry.attributes.position.array
    for (let i = 0; i < pCount; i++) {
      const d = pData[i]
      const dist = Math.sqrt(d.x * d.x + d.z * d.z)
      const wave = Math.sin(dist * 0.8 - t * 2) * Math.exp(-dist * 0.05) * 3
      const probability = Math.exp(-Math.abs(pp[i*3+1] - wave) * 0.5)
      pp[i*3+1] += (wave - pp[i*3+1]) * 0.02 + Math.sin(t + d.phase) * 0.05 * (1 - probability)
      pp[i*3] = d.x + Math.sin(t * 0.3 + d.phase) * 0.5
      pp[i*3+2] = d.z + Math.cos(t * 0.2 + d.phase) * 0.5
    }
    particles.geometry.attributes.position.needsUpdate = true

    camera.position.x = Math.sin(t * 0.1) * 10
    camera.position.y = 15 + Math.cos(t * 0.08) * 5
    camera.position.z = Math.cos(t * 0.1) * 25
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
