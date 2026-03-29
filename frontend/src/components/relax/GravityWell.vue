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
  camera.position.set(0, 8, 25)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)

  // Accretion disk particles
  const diskCount = 1200
  const diskGeo = new THREE.BufferGeometry()
  const diskPos = new Float32Array(diskCount * 3)
  const diskCol = new Float32Array(diskCount * 3)
  diskGeo.setAttribute('position', new THREE.BufferAttribute(diskPos, 3))
  diskGeo.setAttribute('color', new THREE.BufferAttribute(diskCol, 3))

  const diskData = []
  const color = new THREE.Color()
  for (let i = 0; i < diskCount; i++) {
    const angle = Math.random() * Math.PI * 2
    const r = 3 + Math.random() * 12
    const y = (Math.random() - 0.5) * 0.5 * (1 - (r - 3) / 15)
    diskData.push({ angle, r, y, speed: 1.5 / (r * 0.3) })
    diskPos[i*3] = Math.cos(angle) * r
    diskPos[i*3+1] = y
    diskPos[i*3+2] = Math.sin(angle) * r
    const hue = 0.05 + (r / 15) * 0.15
    color.setHSL(hue, 0.9, 0.5 + (1 - r / 15) * 0.4)
    diskCol[i*3] = color.r; diskCol[i*3+1] = color.g; diskCol[i*3+2] = color.b
  }

  const diskMat = new THREE.PointsMaterial({
    size: 0.1, vertexColors: true, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false
  })
  const disk = new THREE.Points(diskGeo, diskMat)
  scene.add(disk)

  // Black hole center - dark sphere with event horizon glow
  const bhGeo = new THREE.SphereGeometry(2, 32, 32)
  const bhMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
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
        float rim = pow(1.0 - abs(dot(vNormal, vec3(0,0,1))), 3.0);
        float pulse = 0.8 + sin(uTime * 2.0) * 0.2;
        vec3 color = mix(vec3(0.0), vec3(1.0, 0.4, 0.0), rim * pulse);
        float alpha = 0.95 - rim * 0.3;
        gl_FragColor = vec4(color, alpha);
      }
    `
  })
  scene.add(new THREE.Mesh(bhGeo, bhMat))

  // Gravitational lensing ring
  const lensGeo = new THREE.TorusGeometry(2.5, 0.08, 8, 100)
  const lensMat = new THREE.MeshBasicMaterial({
    color: 0xff6600, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  })
  const lensRing = new THREE.Mesh(lensGeo, lensMat)
  lensRing.rotation.x = Math.PI / 2
  scene.add(lensRing)

  // Light rays being bent
  const rayCount = 30
  const rays = []
  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2
    const pts = []
    for (let j = 0; j <= 30; j++) {
      const t = j / 30
      const r = 15 - t * 12
      const bend = Math.pow(t, 2) * 3
      pts.push(new THREE.Vector3(
        Math.cos(angle + bend * 0.1) * r,
        Math.sin(t * Math.PI) * 2 * (1 - t),
        Math.sin(angle + bend * 0.1) * r
      ))
    }
    const curve = new THREE.CatmullRomCurve3(pts)
    const tubeGeo = new THREE.TubeGeometry(curve, 30, 0.02, 4, false)
    const tubeMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(0.08 + Math.random() * 0.05, 0.9, 0.6),
      transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
    const ray = new THREE.Mesh(tubeGeo, tubeMat)
    scene.add(ray)
    rays.push({ mesh: ray, baseAngle: angle })
  }

  // Background stars
  const starCount = 400
  const starGeo = new THREE.BufferGeometry()
  const starPos = new Float32Array(starCount * 3)
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = 40 + Math.random() * 20
    starPos[i*3] = r * Math.sin(phi) * Math.cos(theta)
    starPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta)
    starPos[i*3+2] = r * Math.cos(phi)
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  const starMat = new THREE.PointsMaterial({
    size: 0.15, color: 0xffffff, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false
  })
  scene.add(new THREE.Points(starGeo, starMat))

  renderer.render(scene, camera)
  ready.value = true

  const animate = (time) => {
    animationId = requestAnimationFrame(animate)
    const t = time * 0.001
    bhMat.uniforms.uTime.value = t

    // Rotate disk particles
    const dp = disk.geometry.attributes.position.array
    const dc = disk.geometry.attributes.color.array
    for (let i = 0; i < diskCount; i++) {
      const d = diskData[i]
      d.angle += d.speed * 0.005
      dp[i*3] = Math.cos(d.angle) * d.r
      dp[i*3+1] = d.y + Math.sin(t * 2 + d.angle) * 0.1
      dp[i*3+2] = Math.sin(d.angle) * d.r
      const hue = (0.05 + (d.r / 15) * 0.15 + t * 0.01) % 1
      color.setHSL(hue, 0.9, 0.5 + (1 - d.r / 15) * 0.4)
      dc[i*3] = color.r; dc[i*3+1] = color.g; dc[i*3+2] = color.b
    }
    disk.geometry.attributes.position.needsUpdate = true
    disk.geometry.attributes.color.needsUpdate = true

    lensRing.rotation.z = t * 0.5
    lensRing.scale.setScalar(1 + Math.sin(t * 1.5) * 0.05)

    camera.position.x = Math.sin(t * 0.08) * 10
    camera.position.y = 8 + Math.cos(t * 0.06) * 4
    camera.position.z = Math.cos(t * 0.08) * 20
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
