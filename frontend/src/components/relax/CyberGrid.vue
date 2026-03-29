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
  scene.fog = new THREE.FogExp2(0x000011, 0.015)
  camera = new THREE.PerspectiveCamera(70, w / h, 0.1, 200)
  camera.position.set(0, 8, 20)
  camera.lookAt(0, 0, -10)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)

  // Neon grid floor
  const gridGeo = new THREE.PlaneGeometry(200, 200, 80, 80)
  gridGeo.rotateX(-Math.PI / 2)
  const gridMat = new THREE.ShaderMaterial({
    transparent: true,
    wireframe: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      uniform float uTime;
      varying float vDist;
      void main() {
        vec3 pos = position;
        pos.y += sin(pos.x * 0.1 + uTime) * 0.5 + sin(pos.z * 0.1 + uTime * 0.7) * 0.5;
        vDist = length(pos.xz) * 0.01;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      varying float vDist;
      void main() {
        float alpha = smoothstep(1.0, 0.0, vDist) * 0.4;
        gl_FragColor = vec4(0.0, 0.9, 1.0, alpha);
      }
    `
  })
  const grid = new THREE.Mesh(gridGeo, gridMat)
  scene.add(grid)

  // Light pillars shooting up from grid
  const pillarCount = 15
  const pillars = []
  const pillarGeo = new THREE.CylinderGeometry(0.05, 0.15, 1, 6)
  for (let i = 0; i < pillarCount; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(0.5 + Math.random() * 0.2, 1, 0.6),
      transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
    const mesh = new THREE.Mesh(pillarGeo, mat)
    mesh.position.set((Math.random() - 0.5) * 40, 0, (Math.random() - 0.5) * 40 - 10)
    mesh.scale.y = 5 + Math.random() * 15
    mesh.position.y = mesh.scale.y * 0.5
    scene.add(mesh)
    pillars.push({ mesh, baseY: mesh.position.y, speed: 1 + Math.random() * 2, phase: Math.random() * Math.PI * 2 })
  }

  // Rising particles
  const pCount = 800
  const pGeo = new THREE.BufferGeometry()
  const pPos = new Float32Array(pCount * 3)
  const pCol = new Float32Array(pCount * 3)
  const pVel = new Float32Array(pCount)
  const color = new THREE.Color()
  for (let i = 0; i < pCount; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 50
    pPos[i * 3 + 1] = Math.random() * 30
    pPos[i * 3 + 2] = (Math.random() - 0.5) * 50 - 10
    color.setHSL(0.5 + Math.random() * 0.15, 0.9, 0.6)
    pCol[i * 3] = color.r; pCol[i * 3 + 1] = color.g; pCol[i * 3 + 2] = color.b
    pVel[i] = 0.02 + Math.random() * 0.05
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3))
  const pMat = new THREE.PointsMaterial({
    size: 0.15, vertexColors: true, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false
  })
  const particles = new THREE.Points(pGeo, pMat)
  scene.add(particles)

  renderer.render(scene, camera)
  ready.value = true

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const t = time * 0.001
    gridMat.uniforms.uTime.value = t

    for (const p of pillars) {
      const pulse = 0.5 + Math.sin(t * p.speed + p.phase) * 0.5
      p.mesh.material.opacity = 0.3 + pulse * 0.5
      p.mesh.scale.y = 5 + pulse * 15
      p.mesh.position.y = p.mesh.scale.y * 0.5
    }

    const pp = particles.geometry.attributes.position.array
    for (let i = 0; i < pCount; i++) {
      pp[i * 3 + 1] += pVel[i]
      if (pp[i * 3 + 1] > 30) {
        pp[i * 3 + 1] = 0
        pp[i * 3] = (Math.random() - 0.5) * 50
        pp[i * 3 + 2] = (Math.random() - 0.5) * 50 - 10
      }
    }
    particles.geometry.attributes.position.needsUpdate = true

    camera.position.x = Math.sin(t * 0.1) * 5
    camera.lookAt(0, 3, -10)
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
