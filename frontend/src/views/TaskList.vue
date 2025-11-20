<template>
  <div class="tasks-wrapper">
    <div class="layout">
      <!-- 奶龙动画区域 -->
      <aside class="layout-sidebar">
        <el-card class="tech-card animation-card" shadow="hover">
          <div class="card-header">
            <div class="header-left">
              <div class="card-title">
                <el-icon class="icon-pulse">
                  <MagicStick />
                </el-icon>
                <span>体素花园</span>
              </div>
              <div class="card-subtitle">放松一下，看看奶龙</div>
            </div>
          </div>

          <div class="animation-shell">
            <MilkDragon />
          </div>
        </el-card>
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
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, MagicStick, Odometer } from '@element-plus/icons-vue'
import api from '@/api'
import TaskCard from '@/components/TaskCard.vue'
import TaskForm from '@/components/TaskForm.vue'
import MilkDragon from '@/components/MilkDragon.vue'

export default {
  name: 'TaskList',
  components: {
    TaskCard,
    TaskForm,
    MilkDragon,
    Plus,
    MagicStick,
    Odometer
  },
  setup() {
    const tasks = ref([])
    const loading = ref(false)
    const statusFilter = ref('pending')
    const sortBy = ref('due_date')
    const showTaskForm = ref(false)
    const editingTask = ref(null)

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

    onMounted(async () => {
      await loadTasks()
    })

    return {
      tasks,
      loading,
      statusFilter,
      sortBy,
      showTaskForm,
      editingTask,
      statusFilterLabel,
      sortByLabel,
      showCreateForm,
      handleToggleStatus,
      handleEdit,
      handleDelete,
      handleTaskSubmit
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
  margin: 0 -20px -20px;
  border-radius: 0 0 24px 24px;
  overflow: hidden;
  min-height: 400px;
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
</style>
