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
  camera.position.set(0, 0, 6)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)

  // Plasma orb with ShaderMaterial
  const orbGeo = new THREE.SphereGeometry(1.5, 64, 64)
  const orbMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vPos;
      void main() {
        vNormal = normal;
        vPos = position;
        vec3 pos = position;
        float noise = sin(pos.x * 4.0 + uTime * 2.0) * sin(pos.y * 4.0 + uTime * 1.5) * sin(pos.z * 4.0 + uTime * 1.8);
        pos += normal * noise * 0.15;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vPos;
      void main() {
        float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
        float plasma = sin(vPos.x * 8.0 + uTime * 3.0) * sin(vPos.y * 6.0 + uTime * 2.0) * sin(vPos.z * 7.0 + uTime * 2.5);
        plasma = plasma * 0.5 + 0.5;
        vec3 col1 = vec3(0.0, 0.8, 1.0);
        vec3 col2 = vec3(0.6, 0.0, 1.0);
        vec3 col3 = vec3(0.0, 1.0, 0.5);
        vec3 color = mix(col1, col2, plasma);
        color = mix(color, col3, fresnel * 0.5);
        float alpha = 0.4 + fresnel * 0.5 + plasma * 0.2;
        gl_FragColor = vec4(color, alpha);
      }
    `
  })
  const orb = new THREE.Mesh(orbGeo, orbMat)
  scene.add(orb)

  // Outer glow shell
  const glowGeo = new THREE.SphereGeometry(1.8, 32, 32)
  const glowMat = new THREE.ShaderMaterial({
    transparent: true, side: THREE.BackSide, depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
        float pulse = 0.8 + sin(uTime * 1.5) * 0.2;
        vec3 color = mix(vec3(0.0, 0.5, 1.0), vec3(0.5, 0.0, 1.0), sin(uTime * 0.5) * 0.5 + 0.5);
        gl_FragColor = vec4(color, intensity * 0.5 * pulse);
      }
    `
  })
  scene.add(new THREE.Mesh(glowGeo, glowMat))

  // Orbiting particle ring
  const ringCount = 500
  const ringGeo = new THREE.BufferGeometry()
  const ringPos = new Float32Array(ringCount * 3)
  const ringAngles = new Float32Array(ringCount)
  const ringRadii = new Float32Array(ringCount)
  const ringSpeeds = new Float32Array(ringCount)
  const ringYOff = new Float32Array(ringCount)
  for (let i = 0; i < ringCount; i++) {
    ringAngles[i] = Math.random() * Math.PI * 2
    ringRadii[i] = 2.2 + Math.random() * 0.8
    ringSpeeds[i] = 0.3 + Math.random() * 0.5
    ringYOff[i] = (Math.random() - 0.5) * 0.6
    ringPos[i * 3] = Math.cos(ringAngles[i]) * ringRadii[i]
    ringPos[i * 3 + 1] = ringYOff[i]
    ringPos[i * 3 + 2] = Math.sin(ringAngles[i]) * ringRadii[i]
  }
  ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPos, 3))
  const ringMat = new THREE.PointsMaterial({
    size: 0.06, color: 0x44ccff, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false
  })
  const ring = new THREE.Points(ringGeo, ringMat)
  scene.add(ring)

  renderer.render(scene, camera)
  ready.value = true

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const t = time * 0.001
    orbMat.uniforms.uTime.value = t
    glowMat.uniforms.uTime.value = t
    orb.rotation.y = t * 0.2

    const rp = ring.geometry.attributes.position.array
    for (let i = 0; i < ringCount; i++) {
      ringAngles[i] += ringSpeeds[i] * 0.01
      rp[i * 3] = Math.cos(ringAngles[i]) * ringRadii[i]
      rp[i * 3 + 1] = ringYOff[i] + Math.sin(t * 2 + i) * 0.1
      rp[i * 3 + 2] = Math.sin(ringAngles[i]) * ringRadii[i]
    }
    ring.geometry.attributes.position.needsUpdate = true
    ring.rotation.x = Math.sin(t * 0.3) * 0.3
    ring.rotation.z = Math.cos(t * 0.2) * 0.2

    camera.position.x = Math.sin(t * 0.15) * 2
    camera.position.y = Math.cos(t * 0.1) * 1.5
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
