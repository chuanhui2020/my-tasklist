<template>
  <div class="tasks-wrapper">
    <div class="layout">
      <!-- 奶龙动画区域 -->
      <aside class="layout-sidebar">
        <Transition name="sidebar-fade" mode="out-in">
          <el-card v-if="sidebarMode === 'anim'" key="anim" class="tech-card animation-card" shadow="hover">
          <div class="card-header">
            <div class="header-left">
              <div class="card-title">
                <el-icon class="icon-pulse">
                  <MagicStick />
                </el-icon>
                <span>体素花园</span>
              </div>
              <div class="card-subtitle">{{ animList[animIndex].name }} · {{ animPaused ? '已暂停' : `${10 - animSeconds}s` }}</div>
            </div>
          </div>

          <div ref="animationShell" class="animation-shell">
            <div
              v-for="scene in renderedScenes"
              :key="scene.key"
              class="animation-scene"
              :class="{ active: scene.key === activeSceneKey }"
              :data-scene-key="scene.key"
            >
              <component :is="scene.comp" />
            </div>
          </div>

          <div class="anim-controls">
            <button class="anim-btn" @click="animPrev">上一个</button>
            <button class="anim-btn" @click="animPaused = !animPaused">{{ animPaused ? '继续' : '暂停' }}</button>
            <button class="anim-btn" @click="animNext">下一个</button>
          </div>

          <div class="anim-dots">
            <span
              v-for="(a, i) in animList"
              :key="i"
              class="anim-dot"
              :class="{ active: i === animIndex }"
              :title="a.name"
              @click="animGoTo(i)"
            ></span>
          </div>
        </el-card>

        <LifeProgress v-else key="progress" />
        </Transition>
      </aside>

      <!-- 任务列表主区域 -->
      <main class="layout-content">
        <el-card class="tech-card toolbar-card" shadow="never">
          <div class="toolbar">
            <div class="filters">
              <el-select v-model="statusFilter" placeholder="筛选状态" style="width: 140px;">
                <el-option label="全部" value="" />
                <el-option label="待完成" value="pending" />
                <el-option label="已完成" value="done" />
              </el-select>

              <el-radio-group v-model="sortBy">
                <el-radio-button value="due_date">按截止日排序</el-radio-button>
                <el-radio-button value="created_at">按创建时间排序</el-radio-button>
              </el-radio-group>
            </div>

            <el-button type="primary" @click="showCreateForm">
              <el-icon>
                <Plus />
              </el-icon>
              新建任务
            </el-button>
          </div>
        </el-card>

        <el-card class="tech-card task-card" shadow="hover">
          <template #header>
            <div class="task-header">
              <div>
                <div class="task-title">
                  <el-icon class="icon-spin">
                    <Odometer />
                  </el-icon>
                  任务列表
                </div>
                <div class="task-subtitle">当前筛选：{{ statusFilterLabel }} · 排序依据：{{ sortByLabel }}</div>
              </div>
              <el-tag v-if="tasks.length" size="small" effect="dark" class="tech-tag">{{ tasks.length }} 项</el-tag>
            </div>
          </template>

          <div v-if="loading" class="task-loading">
            <div class="loading-spinner"></div>
          </div>

          <div v-else-if="tasks.length === 0" class="task-empty">
            <el-empty description="暂无任务" />
          </div>

          <div v-else class="task-grid">
            <TaskCard v-for="task in tasks" :key="task.id" :task="task" @toggle-status="handleToggleStatus"
              @edit="handleEdit" @delete="handleDelete" />
          </div>
        </el-card>
      </main>
    </div>

    <TaskForm :visible="showTaskForm" :task="editingTask" @close="showTaskForm = false" @submit="handleTaskSubmit" />
  </div>
</template>

<script>
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch, markRaw, defineAsyncComponent, h } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, MagicStick, Odometer } from '@element-plus/icons-vue'
import api from '@/api'
import TaskCard from '@/components/TaskCard.vue'
import TaskForm from '@/components/TaskForm.vue'
import LifeProgress from '@/components/LifeProgress.vue'

// CSS-only loading placeholder (zero JS cost)
const AnimLoading = {
  setup() {
    return () => h('div', {
      class: 'anim-loading-placeholder'
    }, [
      h('div', { class: 'anim-loading-spinner' })
    ])
  }
}

const animLoaders = [
  () => import('@/components/relax/BreathingCircle.vue'),
  () => import('@/components/relax/PendulumWave.vue'),
  () => import('@/components/relax/RainDrops.vue'),
  () => import('@/components/relax/LavaLamp.vue'),
  () => import('@/components/relax/BouncingBalls.vue'),
  () => import('@/components/relax/Kaleidoscope.vue'),
  () => import('@/components/relax/ParticleFireworks.vue'),
  () => import('@/components/relax/WaterRipple.vue'),
  () => import('@/components/relax/StarrySky.vue'),
  () => import('@/components/relax/CyberGrid.vue'),
  () => import('@/components/relax/PlasmaOrb.vue'),
  () => import('@/components/relax/HologramRing.vue'),
  () => import('@/components/relax/NeuralWeb.vue'),
  () => import('@/components/relax/VortexField.vue'),
  () => import('@/components/relax/DataStream.vue'),
  () => import('@/components/relax/CrystalMatrix.vue'),
  () => import('@/components/relax/GravityWell.vue'),
  () => import('@/components/relax/CircuitPulse.vue'),
  () => import('@/components/relax/CosmicDust.vue'),
  () => import('@/components/relax/WaveFunction.vue')
]

const wrapAsync = (loader) => markRaw(defineAsyncComponent({
  loader,
  loadingComponent: AnimLoading,
  delay: 0,
}))

const animList = [
  { name: '极光', comp: wrapAsync(animLoaders[0]) },
  { name: '波浪摆', comp: wrapAsync(animLoaders[1]) },
  { name: '粒子星系', comp: wrapAsync(animLoaders[2]) },
  { name: '几何隧道', comp: wrapAsync(animLoaders[3]) },
  { name: '粒子网络', comp: wrapAsync(animLoaders[4]) },
  { name: '流光线条', comp: wrapAsync(animLoaders[5]) },
  { name: '分形生长', comp: wrapAsync(animLoaders[6]) },
  { name: '波形山脉', comp: wrapAsync(animLoaders[7]) },
  { name: 'DNA螺旋', comp: wrapAsync(animLoaders[8]) },
  { name: '赛博网格', comp: wrapAsync(animLoaders[9]) },
  { name: '等离子球', comp: wrapAsync(animLoaders[10]) },
  { name: '全息光环', comp: wrapAsync(animLoaders[11]) },
  { name: '神经脉冲', comp: wrapAsync(animLoaders[12]) },
  { name: '量子漩涡', comp: wrapAsync(animLoaders[13]) },
  { name: '数据洪流', comp: wrapAsync(animLoaders[14]) },
  { name: '晶体矩阵', comp: wrapAsync(animLoaders[15]) },
  { name: '引力透镜', comp: wrapAsync(animLoaders[16]) },
  { name: '电路脉冲', comp: wrapAsync(animLoaders[17]) },
  { name: '星际尘埃', comp: wrapAsync(animLoaders[18]) },
  { name: '量子波函', comp: wrapAsync(animLoaders[19]) }
]

// Preload adjacent animations during idle time
const preloadAdjacent = (currentIdx) => {
  const next = (currentIdx + 1) % animLoaders.length
  const prev = (currentIdx - 1 + animLoaders.length) % animLoaders.length
  const doPreload = () => { animLoaders[next](); animLoaders[prev]() }
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(doPreload)
  } else {
    setTimeout(doPreload, 200)
  }
}

export default {
  name: 'TaskList',
  components: {
    TaskCard,
    TaskForm,
    LifeProgress,
    Plus,
    MagicStick,
    Odometer
  },
  setup() {
    const animationShell = ref(null)
    const tasks = ref([])
    const loading = ref(false)
    const statusFilter = ref('pending')
    const sortBy = ref('due_date')
    const showTaskForm = ref(false)
    const editingTask = ref(null)

    // Sidebar toggle: anim <-> progress
    const sidebarMode = ref('anim')
    let sidebarTimerId = null

    // Animation rotation
    const createScene = (idx, token = 0) => ({
      key: `scene-${idx}-${token}`,
      idx,
      comp: animList[idx].comp
    })

    const initialScene = createScene(0)
    const animIndex = ref(0)
    const animPaused = ref(false)
    const animSeconds = ref(0)
    const renderedScenes = ref([initialScene])
    const activeSceneKey = ref(initialScene.key)
    const pendingSceneKey = ref(null)
    let animTimerId = null
    let animReadyObserver = null
    let animReadyTimeoutId = null
    let animReadyFrameA = null
    let animSwitchToken = 0

    const clearAnimReadyWatch = () => {
      if (animReadyObserver) {
        animReadyObserver.disconnect()
        animReadyObserver = null
      }
      if (animReadyTimeoutId) {
        clearTimeout(animReadyTimeoutId)
        animReadyTimeoutId = null
      }
      if (animReadyFrameA) {
        cancelAnimationFrame(animReadyFrameA)
        animReadyFrameA = null
      }
    }

    const trimRenderedScenes = (keepKey) => {
      renderedScenes.value = renderedScenes.value.filter((scene) => scene.key === keepKey)
    }

    const finishAnimSwitch = (token, scene) => {
      animReadyFrameA = requestAnimationFrame(() => {
        animReadyFrameA = null
        if (token !== animSwitchToken) return
        activeSceneKey.value = scene.key
        pendingSceneKey.value = null
        animIndex.value = scene.idx
        clearAnimReadyWatch()
        nextTick(() => {
          if (token !== animSwitchToken) return
          trimRenderedScenes(scene.key)
        })
      })
    }

    const watchAnimReady = (token, scene) => {
      clearAnimReadyWatch()
      const shell = animationShell.value
      if (!shell) {
        return
      }

      const maybeFinish = () => {
        const sceneEl = shell.querySelector(`[data-scene-key="${scene.key}"]`)
        if (!sceneEl) return
        const canvas = sceneEl.querySelector('canvas')
        if (canvas) {
          finishAnimSwitch(token, scene)
        }
      }

      animReadyObserver = new MutationObserver(() => {
        if (token !== animSwitchToken) return
        maybeFinish()
      })
      animReadyObserver.observe(shell, { childList: true, subtree: true })

      animReadyTimeoutId = setTimeout(() => {
        if (token !== animSwitchToken) return
        finishAnimSwitch(token, scene)
      }, 1500)

      maybeFinish()
    }

    const animSwitchTo = (idx) => {
      if (idx === animIndex.value && !pendingSceneKey.value) return
      animSwitchToken += 1
      const token = animSwitchToken
      const scene = createScene(idx, token)
      clearAnimReadyWatch()
      pendingSceneKey.value = scene.key
      animLoaders[idx]()
      preloadAdjacent(idx)
      renderedScenes.value = renderedScenes.value.filter((item) => item.key === activeSceneKey.value)
      renderedScenes.value.push(scene)
      animSeconds.value = 0
      nextTick(() => {
        watchAnimReady(token, scene)
      })
    }

    const getCurrentTargetIndex = () => {
      const pendingScene = renderedScenes.value.find((scene) => scene.key === pendingSceneKey.value)
      return pendingScene ? pendingScene.idx : animIndex.value
    }

    const animNext = () => {
      animSwitchTo((getCurrentTargetIndex() + 1) % animList.length)
    }

    const animPrev = () => {
      animSwitchTo((getCurrentTargetIndex() - 1 + animList.length) % animList.length)
    }

    const animGoTo = (idx) => {
      if (idx !== getCurrentTargetIndex()) animSwitchTo(idx)
    }

    const statusFilterLabel = computed(() => {
      if (statusFilter.value === 'pending') return '待完成'
      if (statusFilter.value === 'done') return '已完成'
      return '全部'
    })

    const sortByLabel = computed(() => (sortBy.value === 'created_at' ? '创建时间' : '截止日期'))

    const loadTasks = async ({ showSpinner = true } = {}) => {
      if (showSpinner) {
        loading.value = true
      }
      try {
        const params = {
          status: statusFilter.value || undefined,
          sort: sortBy.value
        }
        const response = await api.getTasks(params)
        tasks.value = response.data
      } catch (error) {
        console.error('加载任务失败:', error)
        ElMessage.error('加载任务失败，请稍后重试')
      } finally {
        if (showSpinner) {
          loading.value = false
        }
      }
    }

    const showCreateForm = () => {
      editingTask.value = null
      showTaskForm.value = true
    }

    const handleToggleStatus = async (task) => {
      const newStatus = task.status === 'pending' ? 'done' : 'pending'
      try {
        await api.updateTaskStatus(task.id, newStatus)
        ElMessage.success('任务状态已更新')
        await loadTasks({ showSpinner: false })
      } catch (error) {
        console.error('更新任务状态失败:', error)
        ElMessage.error('更新任务状态失败，请稍后重试')
      }
    }

    const handleEdit = (task) => {
      editingTask.value = task
      showTaskForm.value = true
    }

    const handleDelete = async (task) => {
      try {
        await ElMessageBox.confirm('确定要删除这个任务吗？', '确认删除', {
          type: 'warning'
        })
        await api.deleteTask(task.id)
        await loadTasks({ showSpinner: false })
        ElMessage.success('任务已删除')
      } catch (error) {
        if (error !== 'cancel') {
          console.error('删除任务失败:', error)
          ElMessage.error('删除任务失败，请稍后重试')
        }
      }
    }

    const handleTaskSubmit = async () => {
      showTaskForm.value = false
      editingTask.value = null
      await loadTasks({ showSpinner: false })
    }

    watch([statusFilter, sortBy], () => {
      loadTasks()
    })

    onBeforeUnmount(() => {
      if (animTimerId) clearInterval(animTimerId)
      if (sidebarTimerId) clearTimeout(sidebarTimerId)
      clearAnimReadyWatch()
    })

    onMounted(async () => {
      await loadTasks()
      preloadAdjacent(animIndex.value)
      animTimerId = setInterval(() => {
        if (animPaused.value) return
        animSeconds.value++
        if (animSeconds.value >= 60) {
          animNext()
        }
      }, 1000)
      function scheduleSidebar() {
        // 花园动画显示1分钟，人生进度显示5分钟
        const duration = sidebarMode.value === 'anim' ? 60000 : 300000
        sidebarTimerId = setTimeout(() => {
          sidebarMode.value = sidebarMode.value === 'anim' ? 'progress' : 'anim'
          scheduleSidebar()
        }, duration)
      }
      scheduleSidebar()
    })

    watch(animIndex, (idx) => {
      preloadAdjacent(idx)
    })

    return {
      tasks,
      loading,
      statusFilter,
      sortBy,
      showTaskForm,
      editingTask,
      animationShell,
      statusFilterLabel,
      sortByLabel,
      showCreateForm,
      handleToggleStatus,
      handleEdit,
      handleDelete,
      handleTaskSubmit,
      renderedScenes,
      activeSceneKey,
      animList,
      animIndex,
      animPaused,
      animSeconds,
      animNext,
      animPrev,
      animGoTo,
      sidebarMode
    }
  }
}
</script>

<style scoped>
.tasks-wrapper {
  max-width: 1600px;
  margin: 0 auto;
  padding: 40px 32px 60px;
}

.layout {
  display: grid;
  grid-template-columns: 450px 1fr;
  gap: 32px;
  align-items: start;
}

/* Tech Card Styles */
.tech-card {
  background: var(--bg-glass) !important;
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border) !important;
  box-shadow: var(--shadow-lg) !important;
  border-radius: 24px;
  overflow: visible;
  position: relative;
  color: var(--text-primary);
}

.tech-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--glass-highlight), transparent);
}

.card-header,
.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.card-title,
.task-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-subtitle,
.task-subtitle {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
  margin-left: 28px;
}

.icon-pulse {
  animation: pulse 3s infinite;
  color: var(--primary-color);
}

.icon-spin {
  color: var(--secondary-color);
}

/* Animation Section */
.animation-shell {
  margin: 0 -20px;
  overflow: hidden;
  height: 400px;
  position: relative;
  isolation: isolate;
  background: #0f172a;
}

.animation-shell::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 20% 20%, rgba(6, 182, 212, 0.14), transparent 40%),
    radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.14), transparent 44%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(15, 23, 42, 0.98));
  z-index: 0;
  pointer-events: none;
}

.animation-scene {
  position: absolute;
  inset: 0;
  z-index: 1;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.animation-scene.active {
  opacity: 1;
  visibility: visible;
  z-index: 2;
}

.animation-shell :deep(.relax-canvas) {
  width: 100%;
  height: 100%;
  display: block;
  background:
    radial-gradient(circle at 20% 20%, rgba(6, 182, 212, 0.08), transparent 38%),
    radial-gradient(circle at 78% 80%, rgba(139, 92, 246, 0.08), transparent 42%),
    #0f172a;
}

.animation-shell :deep(canvas) {
  display: block;
  background: #0f172a;
}

.animation-card :deep(.el-card__body) {
  background: #0f172a !important;
}

.animation-card.tech-card {
  background: #0f172a !important;
}

.anim-controls {
  display: flex;
  justify-content: center;
  gap: 10px;
  padding: 12px 0 8px;
}

.anim-btn {
  padding: 4px 14px;
  border-radius: 6px;
  border: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.anim-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
  border-color: var(--primary-color);
}

.anim-dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  padding-bottom: 8px;
}

.anim-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  cursor: pointer;
  transition: all 0.3s ease;
}

.anim-dot:hover {
  background: rgba(255, 255, 255, 0.3);
}

.anim-dot.active {
  background: var(--primary-color);
  box-shadow: 0 0 6px rgba(6, 182, 212, 0.5);
}

/* Toolbar */
.toolbar-card {
  margin-bottom: 20px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.filters {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

/* Task Card */
.task-card {
  margin-top: 0;
}

.task-loading,
.task-empty {
  padding: 36px 12px;
}

.task-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(6, 182, 212, 0.1);
  border-radius: 50%;
  border-top-color: var(--primary-color);
  animation: spin 1s ease-in-out infinite;
  margin: 40px auto;
}

.tech-tag {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid var(--border-color);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.7;
    transform: scale(0.95);
  }

  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@media (max-width: 1200px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .layout-sidebar {
    order: 2;
  }
}

.anim-loading-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(6,182,212,0.08), rgba(139,92,246,0.08));
  background-size: 200% 200%;
  animation: shimmer 2s ease infinite;
  border-radius: 12px;
}

.anim-loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(6,182,212,0.2);
  border-top-color: rgba(6,182,212,0.8);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes shimmer {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* Sidebar card toggle transition */
.sidebar-fade-enter-active { transition: opacity 0.4s ease, transform 0.4s ease; }
.sidebar-fade-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.sidebar-fade-enter-from { opacity: 0; transform: translateY(12px); }
.sidebar-fade-leave-to { opacity: 0; transform: translateY(-12px); }
</style>
