<template>
  <el-card 
    class="task-card" 
    :class="{ 
      'task-completed': task.status === 'done',
      'task-overdue': isOverdue && task.status !== 'done'
    }"
  >
    <div class="card-glow"></div>
    <div class="task-header">
      <div class="title-section">
        <div class="status-indicator" :class="task.status"></div>
        <span class="task-title" :class="{ 'completed-title': task.status === 'done' }">
          {{ task.title }}
        </span>
      </div>
      <el-tag 
        :type="task.status === 'done' ? 'success' : 'warning'" 
        size="small"
        effect="dark"
        class="status-tag"
      >
        {{ task.status === 'done' ? '已完成' : '进行中' }}
      </el-tag>
    </div>
    
    <div class="task-content">
      <p v-if="task.description"
        ref="descRef"
        class="task-description"
        :class="{ 'is-truncated': isTruncated }"
        @click.stop="isTruncated && (showDesc = true)"
      >
        {{ task.description }}
      </p>

      <div v-if="task.images && task.images.length" class="task-images">
        <div
          v-for="img in task.images.slice(0, 3)"
          :key="img.id"
          class="task-image-thumb"
          @click.stop="openImage(img)"
        >
          <img :src="getImageUrl(img)" :alt="img.filename" />
        </div>
        <div v-if="task.images.length > 3" class="task-image-more"
          @click.stop="showAllThumbs = true">
          +{{ task.images.length - 3 }}
        </div>
      </div>

      <Teleport to="body">
        <div v-if="showAllThumbs" class="thumbs-overlay" @click="showAllThumbs = false">
          <div class="thumbs-panel" @click.stop>
            <div class="thumbs-panel-title">全部图片 ({{ task.images.length }})</div>
            <div class="thumbs-panel-grid">
              <div
                v-for="img in task.images"
                :key="img.id"
                class="thumbs-panel-item"
                @click="openImage(img)"
              >
                <img :src="getImageUrl(img)" :alt="img.filename" />
              </div>
            </div>
          </div>
        </div>

        <div v-if="showViewer" class="image-overlay" @click="showViewer = false">
          <img :src="viewerUrl" class="image-overlay-img" @click.stop />
        </div>
      </Teleport>

      <el-dialog
        v-model="showDesc"
        :title="task.title"
        width="500px"
        class="desc-dialog"
        append-to-body
        destroy-on-close
      >
        <div class="desc-dialog-content">{{ task.description }}</div>
      </el-dialog>

      <div class="task-meta">
        <div v-if="task.due_date" class="meta-item" :class="{ 'text-danger': isOverdue }">
          <el-icon><Calendar /></el-icon>
          <span>{{ formatDate(task.due_date) }}</span>
          <span v-if="isOverdue" class="overdue-badge">!</span>
        </div>
        <div class="meta-item">
          <el-icon><Clock /></el-icon>
          <span>{{ formatDateTime(task.created_at) }}</span>
        </div>
      </div>
    </div>
    
    <div class="task-actions">
      <el-button 
        :type="task.status === 'done' ? 'info' : 'success'"
        size="small"
        circle
        plain
        @click="$emit('toggle-status', task)"
        :title="task.status === 'done' ? '标记未完成' : '标记完成'"
      >
        <el-icon>
          <Check v-if="task.status === 'pending'" />
          <RefreshLeft v-else />
        </el-icon>
      </el-button>
      
      <el-button 
        type="primary" 
        size="small" 
        circle
        plain
        @click="$emit('edit', task)"
        title="编辑"
      >
        <el-icon><Edit /></el-icon>
      </el-button>
      
      <el-button 
        type="danger" 
        size="small" 
        circle
        plain
        @click="$emit('delete', task)"
        title="删除"
      >
        <el-icon><Delete /></el-icon>
      </el-button>
    </div>
  </el-card>
</template>

<script>
import { computed, ref, watch, onBeforeUnmount, nextTick } from 'vue'
import { Calendar, Clock, Check, RefreshLeft, Edit, Delete } from '@element-plus/icons-vue'
import api from '@/api'

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
    const showAllThumbs = ref(false)
    const showViewer = ref(false)
    const viewerUrl = ref('')
    const showDesc = ref(false)
    const descRef = ref(null)
    const isTruncated = ref(false)

    const checkTruncation = () => {
      if (descRef.value) {
        isTruncated.value = descRef.value.scrollHeight > descRef.value.clientHeight
      }
    }

    let resizeObserver = null
    watch(() => props.task.description, () => nextTick(checkTruncation))
    watch(descRef, (el, oldEl) => {
      if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null }
      if (el) {
        resizeObserver = new ResizeObserver(checkTruncation)
        resizeObserver.observe(el)
      }
    }, { immediate: true })
    onBeforeUnmount(() => { if (resizeObserver) resizeObserver.disconnect() })

    const isOverdue = computed(() => {
      if (!props.task.due_date || props.task.status === 'done') return false
      const today = new Date().toISOString().split('T')[0]
      return props.task.due_date < today
    })

    const getImageUrl = (img) => {
      return api.getTaskImageUrl(props.task.id, img.id)
    }

    const openImage = (img) => {
      viewerUrl.value = getImageUrl(img)
      showAllThumbs.value = false
      showViewer.value = true
    }

    const formatDate = (dateString) => {
      const date = new Date(dateString)
      return date.toLocaleDateString('zh-CN')
    }

    const formatDateTime = (dateTimeString) => {
      const date = new Date(dateTimeString)
      return date.toLocaleString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    return {
      isOverdue,
      showAllThumbs,
      showViewer,
      viewerUrl,
      showDesc,
      descRef,
      isTruncated,
      getImageUrl,
      openImage,
      formatDate,
      formatDateTime
    }
  }
}
</script>

<style scoped>
.task-card {
  position: relative;
  background: var(--bg-glass) !important;
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border) !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.task-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg), var(--glow-primary);
  border-color: rgba(6, 182, 212, 0.3) !important;
}

.card-glow {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
  opacity: 0;
  transition: opacity 0.3s ease;
}

.task-card:hover .card-glow {
  opacity: 1;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.title-section {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  flex: 1;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 6px;
  flex-shrink: 0;
}

.status-indicator.pending {
  background-color: var(--accent-warning);
  box-shadow: 0 0 8px var(--accent-warning);
}

.status-indicator.done {
  background-color: var(--accent-success);
  box-shadow: 0 0 8px var(--accent-success);
}

.task-title {
  font-weight: 600;
  font-size: 16px;
  color: var(--text-primary);
  line-height: 1.4;
}

.completed-title {
  color: var(--text-muted);
  text-decoration: line-through;
}

.status-tag {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid var(--border-color);
}

.task-content {
  margin-bottom: 16px;
}

.task-description {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 12px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-description.is-truncated {
  cursor: pointer;
  -webkit-mask-image: linear-gradient(to bottom, #000 60%, transparent 100%);
  mask-image: linear-gradient(to bottom, #000 60%, transparent 100%);
  transition: color 0.2s;
}

.task-description.is-truncated:hover {
  color: var(--text-primary);
}

.task-images {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
}

.task-image-thumb {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--glass-border);
  flex-shrink: 0;
  cursor: pointer;
  transition: border-color 0.2s;
}

.task-image-thumb:hover {
  border-color: var(--primary-color);
}

.task-image-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.task-image-more {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  border: 1px solid var(--glass-border);
  background: rgba(15, 23, 42, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 13px;
  flex-shrink: 0;
  cursor: pointer;
  transition: border-color 0.2s;
}

.task-image-more:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.task-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-muted);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.text-danger {
  color: var(--accent-danger);
}

.overdue-badge {
  background: var(--accent-danger);
  color: white;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 10px;
}

.task-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

:deep(.el-button.is-circle) {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

:deep(.el-button.is-circle:hover) {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
  border-color: var(--text-primary);
}

/* Completed State Overrides */
.task-completed {
  opacity: 0.8;
}

.task-completed:hover {
  opacity: 1;
  border-color: var(--accent-success) !important;
  box-shadow: 0 0 15px rgba(16, 185, 129, 0.2);
}

.task-completed .card-glow {
  background: var(--accent-success);
}

.thumbs-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.thumbs-panel {
  background: var(--bg-glass, rgba(15, 23, 42, 0.9));
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
  border-radius: 12px;
  padding: 20px;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
}

.thumbs-panel-title {
  color: var(--text-primary, #e2e8f0);
  font-size: 14px;
  margin-bottom: 12px;
}

.thumbs-panel-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.thumbs-panel-item {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
  cursor: pointer;
  transition: border-color 0.2s;
}

.thumbs-panel-item:hover {
  border-color: var(--primary-color, #06b6d4);
}

.thumbs-panel-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.image-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  cursor: pointer;
}

.image-overlay-img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 8px;
  cursor: default;
}

.desc-dialog-content {
  color: var(--text-secondary, #94a3b8);
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>