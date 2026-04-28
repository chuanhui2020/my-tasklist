<template>
  <el-card
    class="task-card"
    :class="{ 'task-completed': task.status === 'done' }"
  >
    <!-- 标题 + 操作按钮 -->
    <div class="task-header">
      <span class="task-title" :class="{ 'completed-title': task.status === 'done' }">
        {{ task.title }}
      </span>
      <div class="header-actions">
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
    </div>

    <!-- 描述 -->
    <p v-if="task.description"
      ref="descRef"
      class="task-description"
      :class="{ 'is-truncated': isTruncated }"
      @click.stop="isTruncated && $emit('show-desc', task)"
    >
      {{ task.description }}
    </p>
    <p v-else class="task-description placeholder">{{ placeholder }}</p>

    <!-- 图片 -->
    <div v-if="task.images && task.images.length" class="task-images">
      <div
        v-for="img in task.images.slice(0, 3)"
        :key="img.id"
        class="task-image-thumb"
        @click.stop="openImage(img)"
      >
        <img :src="getImageUrl(img)" :alt="img.filename" loading="lazy" />
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
              <img :src="getImageUrl(img)" :alt="img.filename" loading="lazy" />
            </div>
          </div>
        </div>
      </div>

      <div v-if="showViewer" class="image-overlay" @click="showViewer = false">
        <img :src="viewerUrl" class="image-overlay-img" @click.stop />
      </div>
    </Teleport>
  </el-card>
</template>

<script>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Check, RefreshLeft, Edit, Delete } from '@element-plus/icons-vue'
import api from '@/api'

const PLACEHOLDERS = [
  '此处省略一万字 📖',
  '做就完了，不需要解释 🫡',
  '这个任务神秘到连描述都没有 🕵️',
  '主人太懒了，啥也没写 🦥',
  '留白也是一种艺术 🎨',
  '想象力就是超能力 🧠',
]

export default {
  name: 'TaskCard',
  components: {
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
  emits: ['toggle-status', 'edit', 'delete', 'show-desc'],
  setup(props) {
    const showAllThumbs = ref(false)
    const showViewer = ref(false)
    const viewerUrl = ref('')
    const descRef = ref(null)
    const isTruncated = ref(false)

    const checkTruncation = () => {
      if (descRef.value) {
        isTruncated.value = descRef.value.scrollHeight > descRef.value.clientHeight
      }
    }

    watch(() => props.task.description, () => nextTick(checkTruncation))
    onMounted(() => {
      nextTick(checkTruncation)
      window.addEventListener('resize', onResize)
    })

    let resizeTimer = null
    const onResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(checkTruncation, 200)
    }
    onBeforeUnmount(() => {
      window.removeEventListener('resize', onResize)
      clearTimeout(resizeTimer)
    })

    const placeholder = PLACEHOLDERS[(props.task.id || 0) % PLACEHOLDERS.length]

    const getImageUrl = (img) => {
      return api.getTaskImageUrl(props.task.id, img.id)
    }

    const openImage = (img) => {
      viewerUrl.value = getImageUrl(img)
      showAllThumbs.value = false
      showViewer.value = true
    }

    return {
      showAllThumbs,
      showViewer,
      viewerUrl,
      descRef,
      isTruncated,
      placeholder,
      getImageUrl,
      openImage
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
  border-radius: 16px !important;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  height: 100%;
}

:deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px;
}

.task-card:hover {
  transform: translateY(-2px);
  border-color: rgba(6, 182, 212, 0.25) !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

/* === Header === */
.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.task-title {
  font-weight: 600;
  font-size: 15px;
  color: var(--text-primary);
  line-height: 1.5;
  word-break: break-word;
  flex: 1;
  min-width: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.completed-title {
  color: var(--text-muted);
  text-decoration: line-through;
}

.header-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  opacity: 0.4;
  transition: opacity 0.2s;
}

.task-card:hover .header-actions {
  opacity: 1;
}

:deep(.el-button.is-circle) {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  width: 28px;
  height: 28px;
}

:deep(.el-button.is-circle:hover) {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
  border-color: var(--text-primary);
}

/* === Description === */
.task-description {
  color: var(--text-secondary);
  font-size: 13px;
  margin: 10px 0 0;
  line-height: 1.6;
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

.task-description.placeholder {
  color: var(--text-muted);
  font-style: italic;
}

/* === Images === */
.task-images {
  display: flex;
  gap: 6px;
  margin-top: 12px;
}

.task-image-thumb {
  width: 48px;
  height: 48px;
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
  width: 48px;
  height: 48px;
  border-radius: 8px;
  border: 1px solid var(--glass-border);
  background: rgba(15, 23, 42, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 12px;
  flex-shrink: 0;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}

.task-image-more:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

/* === Completed State === */
.task-completed {
  opacity: 0.6;
}

.task-completed:hover {
  opacity: 0.85;
}

/* === Overlays === */
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
</style>
