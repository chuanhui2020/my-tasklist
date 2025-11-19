<template>
  <div class="tasks-wrapper">
    <div class="layout">
      <aside class="layout-calendar">
        <el-card class="calendar-card" shadow="hover">
          <div class="calendar-header">
            <div>
              <div class="calendar-title">公共假日管理</div>
              <div class="calendar-subtitle">当前选择：{{ selectedDateLabel }}</div>
            </div>
            <el-button
              size="small"
              :type="manualHolidayActive ? 'warning' : 'primary'"
              class="calendar-action"
              @click="handleManualHolidayToggle"
            >
              {{ manualHolidayActive ? '取消标记' : '标记为公共假日' }}
            </el-button>
          </div>

          <div class="calendar-shell">
            <el-calendar
              v-model="calendarDate"
              :fullscreen="false"
              @panel-change="handlePanelChange"
            >
              <template #date-cell="{ data }">
                <div
                  class="date-cell"
                  :class="{
                    'date-cell--selected': data.isSelected,
                    'date-cell--manual': isManualHoliday(data.day)
                  }"
                  @click.stop="handleDateSelect(data.day)"
                >
                  <span class="date-cell__number">{{ formatDayNumber(data.day) }}</span>
                  <span v-if="isManualHoliday(data.day)" class="date-cell__tag">假日</span>
                </div>
              </template>
            </el-calendar>
          </div>

          <div class="calendar-footnote">
            <p>点击任意日期可切换，点击“标记为公共假日”即可保存到服务器。</p>
            <div v-if="manualHolidayList.length" class="calendar-list">
              <div class="calendar-list__title">本年公共假日</div>
              <div class="calendar-list__tags">
                <el-tag
                  v-for="item in manualHolidayList"
                  :key="item"
                  size="small"
                  effect="plain"
                >
                  {{ item }}
                </el-tag>
              </div>
            </div>
            <div v-else class="calendar-empty">尚未标记公共假日，马上来规划吧。</div>
          </div>
        </el-card>
      </aside>

      <main class="layout-content">
        <el-card class="toolbar-card" shadow="never">
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
              <el-icon><Plus /></el-icon>
              新建任务
            </el-button>
          </div>
        </el-card>

        <el-card class="task-card" shadow="hover">
          <template #header>
            <div class="task-header">
              <div>
                <div class="task-title">任务列表</div>
                <div class="task-subtitle">当前筛选：{{ statusFilterLabel }} · 排序依据：{{ sortByLabel }}</div>
              </div>
              <el-tag v-if="tasks.length" size="small" effect="plain">{{ tasks.length }} 项</el-tag>
            </div>
          </template>

          <div v-if="loading" class="task-loading">
            <el-skeleton :rows="6" animated />
          </div>

          <div v-else-if="tasks.length === 0" class="task-empty">
            <el-empty description="暂无任务" />
          </div>

          <div v-else class="task-grid">
            <TaskCard
              v-for="task in tasks"
              :key="task.id"
              :task="task"
              @toggle-status="handleToggleStatus"
              @edit="handleEdit"
              @delete="handleDelete"
            />
          </div>
        </el-card>
      </main>
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
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import api from '@/api'
import TaskCard from '@/components/TaskCard.vue'
import TaskForm from '@/components/TaskForm.vue'
import { useManualHolidays } from '@/composables/useManualHolidays'

export default {
  name: 'TaskList',
  components: {
    TaskCard,
    TaskForm,
    Plus
  },
  setup() {
    const tasks = ref([])
    const loading = ref(false)
    const statusFilter = ref('')
    const sortBy = ref('due_date')
    const showTaskForm = ref(false)
    const editingTask = ref(null)

    const {
      calendarDate,
      selectedDateLabel,
      manualHolidayList,
      manualHolidayActive,
      formatDayNumber,
      isManualHoliday,
      handleManualHolidayToggle,
      handleDateSelect,
      handlePanelChange,
      initManualHolidays
    } = useManualHolidays()

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
      await initManualHolidays()
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
      calendarDate,
      selectedDateLabel,
      manualHolidayList,
      manualHolidayActive,
      formatDayNumber,
      isManualHoliday,
      handleManualHolidayToggle,
      handleDateSelect,
      handlePanelChange,
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
  max-width: 1560px;
  margin: 0 auto;
  padding: 40px 32px 60px;
}

.layout {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 32px;
  align-items: start;
}

.calendar-card {
  border-radius: 20px;
  background: linear-gradient(160deg, #fef6e7 0%, #ffffff 70%);
  overflow: hidden;
  box-shadow: 0 15px 35px rgba(255, 193, 7, 0.15);
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 12px;
}

.calendar-title {
  font-size: 20px;
  font-weight: 600;
  color: #d48806;
}

.calendar-subtitle {
  font-size: 13px;
  color: #8c8c8c;
  margin-top: 6px;
}

.calendar-shell {
  position: relative;
  width: 100%;
  padding: 12px;
}

:deep(.el-calendar) {
  background: transparent;
}

:deep(.el-calendar__header) {
  padding: 0 8px 12px;
  font-size: 13px;
  color: #595959;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
}

:deep(.el-calendar__header span) {
  flex: 1;
  text-align: center;
  font-weight: 500;
}

:deep(.el-calendar__header .el-button-group) {
  order: 1;
  display: flex;
  gap: 6px;
}

:deep(.el-calendar__header .el-button-group .el-button) {
  font-size: 12px;
  padding: 4px 10px;
}

:deep(.el-calendar__body) {
  padding: 0 6px 12px;
}

:deep(.el-calendar-table) {
  table-layout: fixed;
}

:deep(.el-calendar-table td) {
  width: calc(100% / 7);
  height: 0;
  padding-bottom: calc(100% / 7);
  position: relative;
}

:deep(.el-calendar-day) {
  position: absolute;
  inset: 6px;
  padding: 0;
}

.date-cell {
  width: 100%;
  height: 100%;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 6px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.date-cell::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20%;
  height: 20%;
  transform: translate(-50%, -50%) scale(0);
  border-radius: 50%;
  background-color: rgba(82, 196, 26, 0.45);
  opacity: 0;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.date-cell:hover::before {
  transform: translate(-50%, -50%) scale(1);
  opacity: 1;
}

.date-cell--selected {
  box-shadow: inset 0 0 0 2px rgba(64, 158, 255, 0.45);
}

.date-cell--manual {
  background-color: rgba(82, 196, 26, 0.4);
  box-shadow: inset 0 0 0 1px rgba(47, 160, 10, 0.6);
}

.date-cell__number {
  font-size: 15px;
  font-weight: 600;
}

.date-cell__tag {
  display: none;
}

.calendar-footnote {
  margin-top: 18px;
  font-size: 12px;
  color: #8c8c8c;
  line-height: 1.6;
}

.calendar-list {
  margin-top: 12px;
  padding: 14px;
  background-color: rgba(255, 214, 102, 0.18);
  border-radius: 14px;
}

.calendar-list__title {
  font-weight: 500;
  color: #ad6800;
  margin-bottom: 8px;
}

.calendar-list__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.calendar-empty {
  margin-top: 12px;
  color: #bfbfbf;
}

.toolbar-card {
  border-radius: 20px;
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

.task-card {
  border-radius: 20px;
  margin-top: 20px;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-title {
  font-size: 22px;
  font-weight: 600;
  color: #1f1f1f;
}

.task-subtitle {
  font-size: 13px;
  color: #8c8c8c;
  margin-top: 6px;
}

.task-loading,
.task-empty {
  padding: 36px 12px;
}

.task-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}

@media (max-width: 1200px) {
  .layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 992px) {
  .task-grid {
    grid-template-columns: 1fr;
  }
}
</style>
