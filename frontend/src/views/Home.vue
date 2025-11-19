<template>
  <div class="home-wrapper">
    <!-- Hero Section -->
    <div class="hero-section">
      <div class="hero-content">
        <h1 class="hero-title text-gradient">
          <span class="greeting">{{ greeting }}</span>, 欢迎回来
        </h1>
        <p class="hero-subtitle">
          今日待办 <span class="highlight-count">{{ todayTasks.length }}</span> 项 · 
          <span class="date-display">{{ currentDateDisplay }}</span>
        </p>
      </div>
      <div class="hero-decoration">
        <div class="pulse-circle"></div>
      </div>
    </div>

    <div class="home-layout">
      <!-- Milk Dragon Animation Section -->
      <section class="animation-section">
        <el-card class="tech-card animation-card" shadow="hover">
          <div class="card-header">
            <div class="header-left">
              <div class="card-title">
                <el-icon class="icon-pulse"><MagicStick /></el-icon>
                <span>体素花园</span>
              </div>
              <div class="card-subtitle">放松一下，看看奶龙</div>
            </div>
          </div>

          <div class="animation-shell">
            <MilkDragon />
          </div>
        </el-card>
      </section>

      <!-- Tasks Section -->
      <section class="tasks-section">
        <el-card class="tech-card tasks-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <div class="header-left">
                <div class="card-title">
                  <el-icon class="icon-spin"><Odometer /></el-icon>
                  <span>今日任务</span>
                </div>
                <div class="card-subtitle">保持专注，高效完成</div>
              </div>
              <el-button text class="view-all-btn" @click="goToTaskList">
                查看全部 <el-icon><ArrowRight /></el-icon>
              </el-button>
            </div>
          </template>

          <div v-if="loading" class="tasks-loading">
            <div class="loading-spinner"></div>
          </div>

          <div v-else-if="todayTasks.length === 0" class="tasks-empty">
            <el-empty description="今日无待办任务" :image-size="120" />
          </div>

          <div v-else class="tasks-grid">
            <TaskCard
              v-for="task in todayTasks"
              :key="task.id"
              :task="task"
              @toggle-status="handleToggleStatus"
              @edit="handleEdit"
              @delete="handleDelete"
            />
          </div>
        </el-card>
      </section>
    </div>

    <TaskForm
      :visible="showTaskForm"
      :task="editingTask"
      @close="showTaskForm = false"
      @submit="handleTaskSubmit"
    />
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Odometer, ArrowRight, MagicStick } from '@element-plus/icons-vue'
import api from '@/api'
import TaskCard from '@/components/TaskCard.vue'
import TaskForm from '@/components/TaskForm.vue'
import MilkDragon from '@/components/MilkDragon.vue'

export default {
  name: 'Home',
  components: {
    TaskCard,
    TaskForm,
    MilkDragon,
    Odometer,
    ArrowRight,
    MagicStick
  },
  setup() {
    const router = useRouter()
    const todayTasks = ref([])
    const loading = ref(false)
    const showTaskForm = ref(false)
    const editingTask = ref(null)

    const greeting = computed(() => {
      const hour = new Date().getHours()
      if (hour < 6) return '夜深了'
      if (hour < 12) return '早上好'
      if (hour < 18) return '下午好'
      return '晚上好'
    })

    const currentDateDisplay = computed(() => {
      return new Date().toLocaleDateString('zh-CN', { 
        month: 'long', 
        day: 'numeric', 
        weekday: 'long' 
      })
    })

    const loadTodayTasks = async ({ showSpinner = true } = {}) => {
      if (showSpinner) {
        loading.value = true
      }
      try {
        const response = await api.getTasks()
        const today = new Date().toISOString().split('T')[0]
        todayTasks.value = response.data.filter(task =>
          task.due_date === today ||
          (task.status === 'pending' && (!task.due_date || task.due_date <= today))
        )
      } catch (error) {
        console.error('加载今日任务失败:', error)
        ElMessage.error('加载今日任务失败，请稍后重试')
      } finally {
        if (showSpinner) {
          loading.value = false
        }
      }
    }

    const goToTaskList = () => {
      router.push('/tasks')
    }

    const handleToggleStatus = async (task) => {
      const newStatus = task.status === 'pending' ? 'done' : 'pending'
      try {
        await api.updateTaskStatus(task.id, newStatus)
        ElMessage.success('任务状态已更新')
        await loadTodayTasks({ showSpinner: false })
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
          type: 'warning',
          customClass: 'tech-message-box'
        })
        await api.deleteTask(task.id)
        await loadTodayTasks({ showSpinner: false })
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
      await loadTodayTasks({ showSpinner: false })
    }

    onMounted(async () => {
      await loadTodayTasks()
    })

    return {
      todayTasks,
      loading,
      showTaskForm,
      editingTask,
      greeting,
      currentDateDisplay,
      goToTaskList,
      handleToggleStatus,
      handleEdit,
      handleDelete,
      handleTaskSubmit
    }
  }
}
</script>

<style scoped>
.home-wrapper {
  max-width: 1600px;
  margin: 0 auto;
  padding: 20px 40px 60px;
}

/* Hero Section */
.hero-section {
  margin-bottom: 40px;
  position: relative;
  padding: 20px 0;
}

.hero-title {
  font-size: 36px;
  font-weight: 800;
  margin: 0 0 10px;
  letter-spacing: -1px;
}

.greeting {
  color: var(--primary-color);
  text-shadow: var(--glow-primary);
}

.hero-subtitle {
  font-size: 16px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.highlight-count {
  color: var(--secondary-color);
  font-weight: 700;
  font-size: 20px;
  text-shadow: var(--secondary-glow);
}

.date-display {
  color: var(--text-muted);
  font-size: 14px;
}

/* Layout Grid */
.home-layout {
  display: grid;
  grid-template-columns: 450px 1fr; /* 调整左侧宽度以适应动画 */
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

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.card-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-subtitle {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
  margin-left: 28px; /* Align with text start */
}

.icon-pulse {
  animation: pulse 3s infinite;
  color: var(--primary-color);
}

.icon-spin {
  color: var(--secondary-color);
}

/* Animation Section Specifics */
.animation-shell {
  margin: 0 -20px -20px; /* 抵消 padding */
  border-radius: 0 0 24px 24px;
  overflow: hidden;
  min-height: 400px;
}

/* Tasks Section */
.tasks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.view-all-btn {
  color: var(--primary-color);
  font-weight: 500;
}

.view-all-btn:hover {
  color: var(--primary-color);
  text-shadow: var(--glow-primary);
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

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(0.95); }
  100% { opacity: 1; transform: scale(1); }
}

@media (max-width: 1200px) {
  .home-layout {
    grid-template-columns: 1fr;
  }
  
  .animation-section {
    order: 2;
  }
}
</style>
