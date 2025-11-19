<template>
  <el-card class="task-card" :class="{ 'task-completed': task.status === 'done' }">
    <template #header>
      <div class="task-header">
        <span class="task-title" :class="{ 'completed-title': task.status === 'done' }">
          {{ task.title }}
        </span>
        <el-tag :type="task.status === 'done' ? 'success' : 'warning'" size="small">
          {{ task.status === 'done' ? '已完成' : '待完成' }}
        </el-tag>
      </div>
    </template>
    
    <div class="task-content">
      <p v-if="task.description" class="task-description">
        {{ task.description }}
      </p>
      
      <div class="task-dates">
        <div v-if="task.due_date" class="due-date">
          <el-icon><Calendar /></el-icon>
          <span>截止: {{ formatDate(task.due_date) }}</span>
          <el-tag 
            v-if="isOverdue" 
            type="danger" 
            size="small"
            style="margin-left: 8px;"
          >
            已过期
          </el-tag>
        </div>
        <div class="created-date">
          <el-icon><Clock /></el-icon>
          <span>创建: {{ formatDateTime(task.created_at) }}</span>
        </div>
      </div>
    </div>
    
    <template #footer>
      <div class="task-actions">
        <el-button 
          :type="task.status === 'done' ? 'info' : 'success'"
          size="small"
          @click="$emit('toggle-status', task)"
        >
          <el-icon>
            <Check v-if="task.status === 'pending'" />
            <RefreshLeft v-else />
          </el-icon>
          {{ task.status === 'done' ? '标记未完成' : '标记完成' }}
        </el-button>
        
        <el-button 
          type="primary" 
          size="small" 
          @click="$emit('edit', task)"
        >
          <el-icon><Edit /></el-icon>
          编辑
        </el-button>
        
        <el-button 
          type="danger" 
          size="small" 
          @click="$emit('delete', task)"
        >
          <el-icon><Delete /></el-icon>
          删除
        </el-button>
      </div>
    </template>
  </el-card>
</template>

<script>
import { computed } from 'vue'
import { Calendar, Clock, Check, RefreshLeft, Edit, Delete } from '@element-plus/icons-vue'

export default {
  name: 'TaskCard',
  components: {
    Calendar,
    Clock,
    Check,
    RefreshLeft,
    Edit,
    Delete
  },
  props: {
    task: {
      type: Object,
      required: true
    }
  },
  emits: ['toggle-status', 'edit', 'delete'],
  setup(props) {
    const isOverdue = computed(() => {
      if (!props.task.due_date || props.task.status === 'done') return false
      const today = new Date().toISOString().split('T')[0]
      return props.task.due_date < today
    })
    
    const formatDate = (dateString) => {
      const date = new Date(dateString)
      return date.toLocaleDateString('zh-CN')
    }
    
    const formatDateTime = (dateTimeString) => {
      const date = new Date(dateTimeString)
      return date.toLocaleString('zh-CN')
    }
    
    return {
      isOverdue,
      formatDate,
      formatDateTime
    }
  }
}
</script>

<style scoped>
.task-card {
  height: fit-content;
  transition: all 0.3s ease;
}

.task-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.task-completed {
  background-color: #f0f9ff;
  border-color: #67c23a;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-title {
  font-weight: 600;
  font-size: 16px;
  color: #303133;
  flex: 1;
  margin-right: 10px;
}

.completed-title {
  text-decoration: line-through;
  color: #909399;
}

.task-content {
  padding: 10px 0;
}

.task-description {
  color: #606266;
  margin-bottom: 15px;
  line-height: 1.5;
}

.task-dates {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.due-date,
.created-date {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #909399;
  font-size: 14px;
}

.task-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .task-actions {
    flex-direction: column;
  }
  
  .task-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
}
</style>