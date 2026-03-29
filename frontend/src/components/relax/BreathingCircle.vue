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
  camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000)
  camera.position.set(0, 2, 8)
  camera.lookAt(0, 2, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)

  // Aurora ribbons
  const ribbonCount = 5
  const ribbons = []
  const colors = [0x00ff88, 0x00ccff, 0x8855ff, 0x00ffcc, 0xff55aa]

  for (let r = 0; r < ribbonCount; r++) {
    const segments = 200
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(segments * 3 * 2)
    const alphas = new Float32Array(segments * 2)
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1))

    const material = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(colors[r]) },
        uTime: { value: 0 }
      },
      vertexShader: `
        attribute float alpha;
        varying float vAlpha;
        void main() {
          vAlpha = alpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(uColor, vAlpha * 0.4);
        }
      `
    })

    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)
    ribbons.push({ mesh, geometry, segments, offset: r * 1.2, speed: 0.3 + r * 0.1, yBase: r * 0.8 })
  }

  // Stars
  const starGeo = new THREE.BufferGeometry()
  const starCount = 500
  const starPos = new Float32Array(starCount * 3)
  for (let i = 0; i < starCount; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 40
    starPos[i * 3 + 1] = Math.random() * 15
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 20 - 5
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, transparent: true, opacity: 0.6 })
  scene.add(new THREE.Points(starGeo, starMat))

  renderer.render(scene, camera)
  ready.value = true

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const t = time * 0.001

    for (const rb of ribbons) {
      const pos = rb.geometry.attributes.position.array
      const alp = rb.geometry.attributes.alpha.array
      for (let i = 0; i < rb.segments; i++) {
        const u = i / rb.segments
        const x = (u - 0.5) * 16
        const wave1 = Math.sin(u * 3 + t * rb.speed + rb.offset) * 1.5
        const wave2 = Math.sin(u * 5 + t * rb.speed * 0.7 + rb.offset * 2) * 0.8
        const y = rb.yBase + wave1 + wave2
        const thickness = (0.3 + Math.sin(u * Math.PI) * 0.5) * (0.5 + Math.sin(t * 0.5 + rb.offset) * 0.3)

        pos[i * 6] = x
        pos[i * 6 + 1] = y + thickness
        pos[i * 6 + 2] = -2 + Math.sin(u * 2 + t * 0.3) * 1.5
        pos[i * 6 + 3] = x
        pos[i * 6 + 4] = y - thickness
        pos[i * 6 + 5] = -2 + Math.sin(u * 2 + t * 0.3) * 1.5

        const edgeFade = Math.sin(u * Math.PI)
        alp[i * 2] = edgeFade
        alp[i * 2 + 1] = edgeFade
      }
      rb.geometry.attributes.position.needsUpdate = true
      rb.geometry.attributes.alpha.needsUpdate = true
      rb.geometry.setIndex(null)
      // Build index for triangle strip
      const indices = []
      for (let i = 0; i < rb.segments - 1; i++) {
        indices.push(i * 2, i * 2 + 1, i * 2 + 2)
        indices.push(i * 2 + 1, i * 2 + 3, i * 2 + 2)
      }
      rb.geometry.setIndex(indices)
      rb.mesh.material.uniforms.uTime.value = t
    }

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
