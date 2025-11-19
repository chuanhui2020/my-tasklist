<template>
  <div class="home-wrapper">
    <div class="home-layout">
      <section class="calendar-section">
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
            <p>提示：点击日期即可切换，标记后以暖黄色高亮显示。</p>
            <div v-if="manualHolidayList.length" class="calendar-list">
              <div class="calendar-list__title">本年已标记的公共假日</div>
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
            <div v-else class="calendar-empty">
              暂无自定义公共假日，选择日期后点击上方按钮即可添加。
            </div>
          </div>
        </el-card>
      </section>

      <section class="tasks-section">
        <el-card class="tasks-card" shadow="hover">
          <template #header>
            <div class="tasks-header">
              <div>
                <div class="tasks-title">今日任务概览</div>
                <div class="tasks-subtitle">聚焦今日待办，保持节奏</div>
              </div>
              <el-button type="primary" @click="goToTaskList">查看全部任务</el-button>
            </div>
          </template>

          <div v-if="loading" class="tasks-loading">
            <el-skeleton :rows="4" animated />
          </div>

          <div v-else-if="todayTasks.length === 0" class="tasks-empty">
            <el-empty description="今天的安排暂时为空" />
          </div>

          <div v-else class="tasks-list">
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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api'
import TaskCard from '@/components/TaskCard.vue'
import TaskForm from '@/components/TaskForm.vue'
import { useManualHolidays } from '@/composables/useManualHolidays'

export default {
  name: 'Home',
  components: {
    TaskCard,
    TaskForm
  },
  setup() {
    const router = useRouter()
    const todayTasks = ref([])
    const loading = ref(false)
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
          type: 'warning'
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
      await initManualHolidays()
    })

    return {
      calendarDate,
      selectedDateLabel,
      manualHolidayList,
      manualHolidayActive,
      todayTasks,
      loading,
      showTaskForm,
      editingTask,
      formatDayNumber,
      isManualHoliday,
      handleManualHolidayToggle,
      handlePanelChange,
      handleDateSelect,
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
  max-width: 1500px;
  margin: 0 auto;
  padding: 40px 32px 60px;
}

.home-layout {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 32px;
  align-items: start;
}

.calendar-card {
  border-radius: 20px;
  overflow: hidden;
  background: linear-gradient(160deg, #fef6e7 0%, #ffffff 70%);
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

.tasks-card {
  border-radius: 20px;
}

.tasks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.tasks-title {
  font-size: 22px;
  font-weight: 600;
  color: #1f1f1f;
}

.tasks-subtitle {
  font-size: 13px;
  color: #8c8c8c;
  margin-top: 6px;
}

.tasks-loading,
.tasks-empty {
  padding: 36px 12px;
}

.tasks-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

@media (max-width: 1100px) {
  .home-layout {
    grid-template-columns: 1fr;
  }
}
</style>
