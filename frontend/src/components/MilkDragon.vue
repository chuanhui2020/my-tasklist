<template>
  <div ref="container" class="milk-dragon-container">
    <div v-if="loading" class="loading-text">正在构建体素世界...</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const container = ref(null)
const loading = ref(true)
let renderer, scene, camera, controls, animationId

// --- 配置 ---
const VOXEL_SIZE = 1
const PALETTE = {
  GRASS_LIGHT: 0x7CFC00,
  GRASS_DARK: 0x228B22,
  DIRT: 0x8B4513,
  WATER: 0x40E0D0,
  STONE_LIGHT: 0xD3D3D3,
  STONE_DARK: 0x808080,
  WOOD: 0x8B0000, // 红木
  WOOD_BROWN: 0x5C4033,
  SAKURA_PINK: 0xFFB7C5,
  SAKURA_DARK: 0xFF69B4,
  LEAF_GREEN: 0x006400,
  DRAGON_SKIN: 0xFFFDD0, // 奶油色
  DRAGON_BELLY: 0xFFFACD,
  DRAGON_BLUSH: 0xFF69B4,
  EYE_BLACK: 0x111111,
  FLOWER_YELLOW: 0xFFD700,
  FLOWER_PURPLE: 0x9370DB
}

// --- Voxel 管理系统 (基于 InstancedMesh 优化) ---
class VoxelWorld {
  constructor() {
    this.voxels = []
    this.geometry = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE)
    //稍微缩小一点点方块，产生体素之间的缝隙感，更精致
    this.geometry.scale(0.95, 0.95, 0.95)
    this.material = new THREE.MeshStandardMaterial({
      roughness: 0.8,
      metalness: 0.1
    })
  }

  add(x, y, z, color) {
    this.voxels.push({ x, y, z, color })
  }

  // 批量添加球体
  addSphere(cx, cy, cz, radius, color, probability = 1) {
    const r2 = radius * radius
    for (let x = Math.floor(-radius); x <= Math.ceil(radius); x++) {
      for (let y = Math.floor(-radius); y <= Math.ceil(radius); y++) {
        for (let z = Math.floor(-radius); z <= Math.ceil(radius); z++) {
          if (x * x + y * y + z * z <= r2) {
            if (Math.random() < probability) {
              this.add(cx + x, cy + y, cz + z, color)
            }
          }
        }
      }
    }
  }

  build(scene) {
    if (this.voxels.length === 0) return

    const mesh = new THREE.InstancedMesh(this.geometry, this.material, this.voxels.length)
    mesh.castShadow = true
    mesh.receiveShadow = true

    const dummy = new THREE.Object3D()
    const color = new THREE.Color()

    this.voxels.forEach((v, i) => {
      dummy.position.set(v.x * VOXEL_SIZE, v.y * VOXEL_SIZE, v.z * VOXEL_SIZE)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, color.setHex(v.color))
    })

    mesh.instanceMatrix.needsUpdate = true
    mesh.instanceColor.needsUpdate = true
    scene.add(mesh)
  }
}

const initThree = () => {
  if (!container.value) return

  // --- 初始化场景 ---
  scene = new THREE.Scene()
  // 使用透明背景以便融入网页
  scene.background = null 
  // scene.fog = new THREE.Fog(0x87CEEB, 40, 90)

  const width = container.value.clientWidth
  const height = container.value.clientHeight

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
  camera.position.set(35, 35, 35)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(width, height)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  container.value.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.autoRotate = true
  controls.autoRotateSpeed = 1.0

  // --- 灯光 ---
  const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.6)
  scene.add(ambientLight)

  const dirLight = new THREE.DirectionalLight(0xFFFFFF, 1.2)
  dirLight.position.set(50, 80, 30)
  dirLight.castShadow = true
  dirLight.shadow.mapSize.width = 2048
  dirLight.shadow.mapSize.height = 2048
  dirLight.shadow.camera.near = 0.5
  dirLight.shadow.camera.far = 200
  dirLight.shadow.camera.left = -50
  dirLight.shadow.camera.right = 50
  dirLight.shadow.camera.top = 50
  dirLight.shadow.camera.bottom = -50
  scene.add(dirLight)

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4)
  scene.add(hemiLight)

  // --- 场景构建逻辑 ---
  const world = new VoxelWorld()

  // 1. 地形生成 (花园底座)
  const SIZE = 24
  for (let x = -SIZE; x <= SIZE; x++) {
    for (let z = -SIZE; z <= SIZE; z++) {
      // 距离中心的距离
      const dist = Math.sqrt(x * x + z * z)

      // 基础高度噪声 (简单的伪随机)
      let height = Math.floor(Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2)

      // 挖一个池塘 (在右前方)
      let isWater = false
      if (x > 5 && x < 15 && z > 0 && z < 12) {
        height = -2
        isWater = true
      } else if (dist > SIZE - 2) {
        // 边缘逐渐降低
        height -= 2
      }

      // 填充底层土壤
      for (let y = -5; y <= height; y++) {
        let color = PALETTE.DIRT
        // 表面
        if (y === height) {
          color = isWater ? PALETTE.DIRT : (Math.random() > 0.5 ? PALETTE.GRASS_LIGHT : PALETTE.GRASS_DARK)
        }
        world.add(x, y, z, color)
      }

      // 填充水
      if (isWater) {
        for (let y = height + 1; y <= -1; y++) {
          world.add(x, y, z, PALETTE.WATER)
        }
      }
    }
  }

  // 2. 弯曲的小路 (石子路)
  // 使用正弦波模拟路径
  for (let z = -SIZE + 2; z <= SIZE - 2; z++) {
    const pathX = Math.floor(Math.sin(z * 0.2) * 8 - 5) // 偏向左侧
    // 路径宽度
    for (let w = -1; w <= 1; w++) {
      const px = pathX + w
      // 确保在地面上
      const py = Math.floor(Math.sin(px * 0.1) * Math.cos(z * 0.1) * 2)
      // 避免覆盖水面
      if (!(px > 5 && px < 15 && z > 0 && z < 12)) {
        world.add(px, py + 1, z, Math.random() > 0.5 ? PALETTE.STONE_LIGHT : PALETTE.STONE_DARK)
      }
    }
  }

  // 3. 石桥 (跨越池塘)
  // 连接池塘两端
  for (let x = 4; x <= 16; x++) {
    const zBridge = 6
    // 拱桥高度计算
    const archHeight = Math.max(0, -Math.pow((x - 10) / 3, 2) + 3)
    const by = Math.floor(archHeight)

    // 桥面
    world.add(x, by, zBridge, PALETTE.STONE_LIGHT)
    world.add(x, by, zBridge + 1, PALETTE.STONE_LIGHT)

    // 栏杆
    if (x % 2 === 0) {
      world.add(x, by + 1, zBridge, PALETTE.WOOD)
      world.add(x, by + 1, zBridge + 1, PALETTE.WOOD)
    }
  }

  // 4. 植物与细节
  const trees = [
    { x: -15, z: -15, type: 'sakura' },
    { x: 15, z: -15, type: 'sakura' },
    { x: -18, z: 10, type: 'green' },
    { x: 18, z: 18, type: 'green' }
  ]

  trees.forEach(tree => {
    const trunkH = 6 + Math.floor(Math.random() * 4)
    const yBase = Math.floor(Math.sin(tree.x * 0.1) * Math.cos(tree.z * 0.1) * 2) + 1

    // 树干
    for (let y = 0; y < trunkH; y++) {
      world.add(tree.x, yBase + y, tree.z, PALETTE.WOOD_BROWN)
      // 树根稍微宽一点
      if (y === 0) {
        world.add(tree.x + 1, yBase, tree.z, PALETTE.WOOD_BROWN)
        world.add(tree.x - 1, yBase, tree.z, PALETTE.WOOD_BROWN)
        world.add(tree.x, yBase, tree.z + 1, PALETTE.WOOD_BROWN)
        world.add(tree.x, yBase, tree.z - 1, PALETTE.WOOD_BROWN)
      }
    }

    // 树冠
    const leafColor = tree.type === 'sakura' ? PALETTE.SAKURA_PINK : PALETTE.LEAF_GREEN
    const leafColor2 = tree.type === 'sakura' ? PALETTE.SAKURA_DARK : PALETTE.GRASS_DARK

    world.addSphere(tree.x, yBase + trunkH, tree.z, 4, leafColor, 0.8)
    // 添加一些深色叶子点缀
    world.addSphere(tree.x, yBase + trunkH, tree.z, 3.5, leafColor2, 0.3)
  })

  // 石灯笼
  function buildLantern(x, z) {
    const y = Math.floor(Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2) + 1
    world.add(x, y, z, PALETTE.STONE_DARK)
    world.add(x, y + 1, z, PALETTE.STONE_DARK)
    world.add(x, y + 2, z, PALETTE.STONE_LIGHT) // 灯室
    world.add(x - 1, y + 3, z, PALETTE.STONE_DARK) // 屋顶
    world.add(x + 1, y + 3, z, PALETTE.STONE_DARK)
    world.add(x, y + 3, z - 1, PALETTE.STONE_DARK)
    world.add(x, y + 3, z + 1, PALETTE.STONE_DARK)
    world.add(x, y + 3, z, PALETTE.STONE_DARK)
    world.add(x, y + 4, z, PALETTE.STONE_DARK) // 顶尖
  }
  buildLantern(-8, 8)
  buildLantern(12, -8)

  // 随机花朵
  for (let i = 0; i < 50; i++) {
    const rx = Math.floor((Math.random() * SIZE * 2) - SIZE)
    const rz = Math.floor((Math.random() * SIZE * 2) - SIZE)
    // 避开中心和水域
    if (Math.abs(rx) > 5 || Math.abs(rz) > 5) {
      if (!(rx > 5 && rx < 15 && rz > 0 && rz < 12)) {
        const ry = Math.floor(Math.sin(rx * 0.1) * Math.cos(rz * 0.1) * 2) + 1
        world.add(rx, ry, rz, Math.random() > 0.5 ? PALETTE.FLOWER_YELLOW : PALETTE.FLOWER_PURPLE)
      }
    }
  }

  // 5. 奶龙 (中心主角)
  // 坐标偏移
  const dx = 0, dy = 1, dz = 0

  // 身体 (胖乎乎的球体)
  world.addSphere(dx, dy + 3, dz, 3.5, PALETTE.DRAGON_SKIN)

  // 肚皮 (稍微靠前)
  for (let y = dy + 1; y < dy + 5; y++) {
    for (let x = dx - 2; x <= dx + 2; x++) {
      world.add(x, y, dz + 3, PALETTE.DRAGON_BELLY)
    }
  }

  // 头 (更大的球体)
  world.addSphere(dx, dy + 7.5, dz, 2.8, PALETTE.DRAGON_SKIN)

  // 脸颊腮红
  world.add(dx + 2, dy + 7, dz + 2, PALETTE.DRAGON_BLUSH)
  world.add(dx - 2, dy + 7, dz + 2, PALETTE.DRAGON_BLUSH)

  // 眼睛
  world.add(dx + 1, dy + 8, dz + 2.5, PALETTE.EYE_BLACK)
  world.add(dx - 1, dy + 8, dz + 2.5, PALETTE.EYE_BLACK)

  // 鼻子/嘴巴区域
  world.add(dx, dy + 6.5, dz + 3, PALETTE.DRAGON_SKIN)

  // 小角
  world.add(dx + 1, dy + 10, dz, PALETTE.FLOWER_YELLOW)
  world.add(dx - 1, dy + 10, dz, PALETTE.FLOWER_YELLOW)

  // 手臂 (短短的)
  world.add(dx + 3, dy + 4, dz + 1, PALETTE.DRAGON_SKIN)
  world.add(dx + 4, dy + 3.5, dz + 1.5, PALETTE.DRAGON_SKIN) // 右手
  world.add(dx - 3, dy + 4, dz + 1, PALETTE.DRAGON_SKIN)
  world.add(dx - 4, dy + 3.5, dz + 1.5, PALETTE.DRAGON_SKIN) // 左手

  // 腿 (坐着的姿势)
  world.add(dx + 2.5, dy + 1, dz + 2, PALETTE.DRAGON_SKIN)
  world.add(dx + 3, dy + 0.5, dz + 3, PALETTE.DRAGON_SKIN)
  world.add(dx - 2.5, dy + 1, dz + 2, PALETTE.DRAGON_SKIN)
  world.add(dx - 3, dy + 0.5, dz + 3, PALETTE.DRAGON_SKIN)

  // 尾巴 (从后面绕出来)
  world.add(dx, dy + 1, dz - 3, PALETTE.DRAGON_SKIN)
  world.add(dx + 1, dy + 0.5, dz - 3.5, PALETTE.DRAGON_SKIN)
  world.add(dx + 2, dy + 0.5, dz - 3, PALETTE.DRAGON_SKIN)
  world.add(dx + 3, dy + 0.5, dz - 2, PALETTE.DRAGON_SKIN) // 尾巴尖

  // 背上的小翅膀
  world.add(dx + 1, dy + 5, dz - 3, PALETTE.FLOWER_YELLOW)
  world.add(dx + 2, dy + 6, dz - 3.5, PALETTE.FLOWER_YELLOW)
  world.add(dx - 1, dy + 5, dz - 3, PALETTE.FLOWER_YELLOW)
  world.add(dx - 2, dy + 6, dz - 3.5, PALETTE.FLOWER_YELLOW)

  // 长椅 (在奶龙旁边)
  const benchZ = 5
  const benchX = -6
  world.add(benchX, 1, benchZ, PALETTE.WOOD)
  world.add(benchX + 1, 1, benchZ, PALETTE.WOOD)
  world.add(benchX + 2, 1, benchZ, PALETTE.WOOD)
  world.add(benchX, 2, benchZ, PALETTE.WOOD) // 腿
  world.add(benchX + 2, 2, benchZ, PALETTE.WOOD) // 腿
  world.add(benchX, 2.5, benchZ, PALETTE.WOOD_BROWN) // 座位
  world.add(benchX + 1, 2.5, benchZ, PALETTE.WOOD_BROWN)
  world.add(benchX + 2, 2.5, benchZ, PALETTE.WOOD_BROWN)
  world.add(benchX, 3.5, benchZ - 0.5, PALETTE.WOOD) // 靠背
  world.add(benchX + 1, 3.5, benchZ - 0.5, PALETTE.WOOD)
  world.add(benchX + 2, 3.5, benchZ - 0.5, PALETTE.WOOD)

  // --- 构建并渲染 ---
  world.build(scene)
  loading.value = false

  // --- 粒子系统 (樱花飘落) ---
  const particleGeo = new THREE.BufferGeometry()
  const particleCount = 300
  const posArray = new Float32Array(particleCount * 3)
  const speedArray = []

  for (let i = 0; i < particleCount; i++) {
    posArray[i * 3] = (Math.random() - 0.5) * 40
    posArray[i * 3 + 1] = Math.random() * 20 + 5
    posArray[i * 3 + 2] = (Math.random() - 0.5) * 40
    speedArray.push({
      y: Math.random() * 0.05 + 0.02,
      x: (Math.random() - 0.5) * 0.02,
      z: (Math.random() - 0.5) * 0.02
    })
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3))
  const particleMat = new THREE.PointsMaterial({
    color: 0xFFB7C5,
    size: 0.4,
    transparent: true,
    opacity: 0.8
  })
  const particles = new THREE.Points(particleGeo, particleMat)
  scene.add(particles)

  // --- 动画循环 ---
  const animate = () => {
    animationId = requestAnimationFrame(animate)

    controls.update()

    // 樱花动画
    const positions = particles.geometry.attributes.position.array
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] += speedArray[i].x
      positions[i * 3 + 1] -= speedArray[i].y
      positions[i * 3 + 2] += speedArray[i].z

      // 重置
      if (positions[i * 3 + 1] < -2) {
        positions[i * 3 + 1] = Math.random() * 20 + 10
        positions[i * 3] = (Math.random() - 0.5) * 40
        positions[i * 3 + 2] = (Math.random() - 0.5) * 40
      }
    }
    particles.geometry.attributes.position.needsUpdate = true

    renderer.render(scene, camera)
  }

  animate()

  // --- 窗口大小调整 ---
  const handleResize = () => {
    if (!container.value) return
    const width = container.value.clientWidth
    const height = container.value.clientHeight
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
  }
  
  window.addEventListener('resize', handleResize)
}

onMounted(() => {
  initThree()
})

onBeforeUnmount(() => {
  if (animationId) cancelAnimationFrame(animationId)
  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss()
  }
  // 清理其他资源...
})
</script>

<style scoped>
.milk-dragon-container {
  width: 100%;
  height: 500px; /* 或者根据需要调整 */
  position: relative;
  overflow: hidden;
  border-radius: 24px;
  /* background: linear-gradient(to bottom, #87CEEB, #e0f7fa); */
  /* 保持透明或使用之前的玻璃拟态背景 */
}

.loading-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--text-primary);
  font-size: 18px;
  font-weight: bold;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
  pointer-events: none;
}
</style>
