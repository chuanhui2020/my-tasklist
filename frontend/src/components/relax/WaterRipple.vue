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
  camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 500)
  camera.position.set(0, 30, 60)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)

  // Wireframe terrain grid
  const gridW = 80
  const gridH = 60
  const segW = 80
  const segH = 60
  const geometry = new THREE.PlaneGeometry(gridW, gridH, segW, segH)
  geometry.rotateX(-Math.PI / 2)

  const material = new THREE.ShaderMaterial({
    transparent: true,
    wireframe: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color(0x06B6D4) },
      uColor2: { value: new THREE.Color(0x8B5CF6) }
    },
    vertexShader: `
      uniform float uTime;
      varying float vHeight;
      varying float vZ;

      void main() {
        vec3 pos = position;
        float wave1 = sin(pos.x * 0.15 + uTime * 0.8) * 3.0;
        float wave2 = sin(pos.z * 0.2 + uTime * 0.6) * 2.0;
        float wave3 = sin((pos.x + pos.z) * 0.1 + uTime * 0.4) * 4.0;
        pos.y = wave1 + wave2 + wave3;
        vHeight = pos.y;
        vZ = pos.z;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      varying float vHeight;
      varying float vZ;

      void main() {
        float t = (vHeight + 5.0) / 10.0;
        vec3 color = mix(uColor1, uColor2, t);
        float alpha = 0.3 + t * 0.4;
        float fade = smoothstep(-30.0, 0.0, vZ);
        gl_FragColor = vec4(color, alpha * fade);
      }
    `
  })

  const terrain = new THREE.Mesh(geometry, material)
  terrain.position.z = -10
  scene.add(terrain)

  // Horizon glow line
  const horizonGeo = new THREE.PlaneGeometry(100, 0.5)
  const horizonMat = new THREE.MeshBasicMaterial({
    color: 0xff6600,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
  const horizon = new THREE.Mesh(horizonGeo, horizonMat)
  horizon.position.set(0, 0, -40)
  scene.add(horizon)

  // Sun
  const sunGeo = new THREE.CircleGeometry(8, 32)
  const sunMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float dist = distance(vUv, vec2(0.5));
        float alpha = smoothstep(0.5, 0.1, dist) * 0.6;
        // Scanlines
        float scan = step(0.5, fract(vUv.y * 20.0 - uTime * 0.5));
        alpha *= 0.7 + scan * 0.3;
        vec3 color = mix(vec3(1.0, 0.3, 0.1), vec3(1.0, 0.8, 0.2), 1.0 - dist * 2.0);
        gl_FragColor = vec4(color, alpha);
      }
    `
  })
  const sun = new THREE.Mesh(sunGeo, sunMat)
  sun.position.set(0, 8, -50)
  scene.add(sun)

  // Stars
  const starCount = 300
  const starGeo = new THREE.BufferGeometry()
  const starPos = new Float32Array(starCount * 3)
  for (let i = 0; i < starCount; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 100
    starPos[i * 3 + 1] = 10 + Math.random() * 30
    starPos[i * 3 + 2] = -30 - Math.random() * 30
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff, size: 0.2, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  })
  scene.add(new THREE.Points(starGeo, starMat))

  renderer.render(scene, camera)
  ready.value = true

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const t = time * 0.001
    material.uniforms.uTime.value = t
    sunMat.uniforms.uTime.value = t

    // Scroll terrain
    terrain.position.z = -10 + (t * 3) % 1

    camera.position.x = Math.sin(t * 0.1) * 3
    camera.lookAt(0, 3, -20)
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
