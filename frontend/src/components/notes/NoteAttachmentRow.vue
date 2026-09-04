<template>
  <div class="attachment-row">
    <span class="attachment-icon" :style="{ color: meta.color, background: `${meta.color}1f` }" aria-hidden="true">
      <el-icon><component :is="meta.icon" /></el-icon>
    </span>
    <span class="attachment-info">
      <span class="attachment-name" :title="filename">{{ filename }}</span>
      <span class="attachment-meta">{{ meta.label }} · {{ formatFileSize(size) }}</span>
    </span>
    <span class="attachment-actions">
      <slot />
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { getFileMeta, formatFileSize } from '@/utils/fileType'

const props = defineProps({
  filename: { type: String, required: true },
  mimeType: { type: String, default: '' },
  size: { type: Number, default: 0 }
})

const meta = computed(() => getFileMeta(props.mimeType))
</script>

<style scoped>
.attachment-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--glass-border);
  transition: border-color 0.2s ease, background 0.2s ease;
}

.attachment-row:hover {
  border-color: rgba(6, 182, 212, 0.28);
  background: rgba(255, 255, 255, 0.05);
}

.attachment-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  font-size: 18px;
  flex-shrink: 0;
}

.attachment-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.attachment-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-meta {
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.attachment-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
</style>
