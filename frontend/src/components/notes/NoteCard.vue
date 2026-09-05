<template>
  <article class="note-card" :class="{ 'is-pinned': note.pinned }" @click="$emit('open', note)">
    <span class="note-accent" aria-hidden="true"></span>

    <header class="note-head">
      <!-- 标题是真正的按钮：卡片整体可点只是鼠标的便利，键盘用户靠它进入 -->
      <button type="button" class="note-title">{{ note.title }}</button>
      <button
        type="button"
        class="icon-btn pin-btn"
        :class="{ 'is-active': note.pinned }"
        :aria-label="note.pinned ? `取消置顶：${note.title}` : `置顶：${note.title}`"
        :aria-pressed="note.pinned"
        @click.stop="$emit('toggle-pin', note)"
      >
        <el-icon><StarFilled v-if="note.pinned" /><Star v-else /></el-icon>
      </button>
    </header>

    <ul v-if="note.tags.length" class="note-tags">
      <li v-for="tag in note.tags" :key="tag" class="note-tag">#{{ tag }}</li>
    </ul>

    <p v-if="excerpt" class="note-excerpt">{{ excerpt }}</p>
    <p v-else class="note-excerpt is-empty">这条笔记还没有正文，只有附件</p>

    <div v-if="note.attachments.length" class="note-files">
      <span
        v-for="file in note.attachments.slice(0, 3)"
        :key="file.id"
        class="file-chip"
        :title="file.filename"
      >
        <el-icon class="file-chip-icon" :style="{ color: fileMeta(file).color }">
          <component :is="fileMeta(file).icon" />
        </el-icon>
        {{ file.filename }}
      </span>
      <span v-if="note.attachments.length > 3" class="file-chip is-more">
        +{{ note.attachments.length - 3 }}
      </span>
    </div>

    <footer class="note-foot">
      <span class="note-time">
        <el-icon><Clock /></el-icon>{{ formatNoteTime(note.updated_at) }}
      </span>
      <div class="note-actions" @click.stop>
        <button type="button" class="icon-btn" :aria-label="`编辑：${note.title}`" @click="$emit('edit', note)">
          <el-icon><Edit /></el-icon>
        </button>
        <el-popconfirm
          title="删除后附件一并清除，确定？"
          confirm-button-text="删除"
          cancel-button-text="取消"
          confirm-button-type="danger"
          width="220"
          @confirm="$emit('delete', note)"
        >
          <template #reference>
            <button type="button" class="icon-btn is-danger" :aria-label="`删除：${note.title}`">
              <el-icon><Delete /></el-icon>
            </button>
          </template>
        </el-popconfirm>
      </div>
    </footer>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { Star, StarFilled, Clock, Edit, Delete } from '@element-plus/icons-vue'
import { markdownExcerpt } from '@/utils/markdown'
import { getFileMeta, formatNoteTime } from '@/utils/fileType'

const props = defineProps({
  note: { type: Object, required: true }
})

defineEmits(['open', 'edit', 'delete', 'toggle-pin'])

const excerpt = computed(() => markdownExcerpt(props.note.content))
const fileMeta = (file) => getFileMeta(file.mime_type)
</script>

<style scoped>
.note-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 20px 14px;
  border-radius: 16px;
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.22s ease, box-shadow 0.22s ease;
}

.note-card:hover {
  transform: translateY(-3px);
  border-color: rgba(6, 182, 212, 0.28);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.34);
}

/* 键盘聚焦落在内部按钮上，焦点环画在卡片外框才看得见 */
.note-card:focus-within {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.18);
}

.note-accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.55), transparent);
  opacity: 0;
  transition: opacity 0.22s ease;
}

.note-card:hover .note-accent {
  opacity: 1;
}

.note-card.is-pinned {
  border-color: rgba(245, 158, 11, 0.28);
  background: linear-gradient(180deg, rgba(245, 158, 11, 0.06), transparent 120px), var(--bg-glass);
}

.note-card.is-pinned .note-accent {
  opacity: 1;
  background: linear-gradient(90deg, transparent, #f59e0b, transparent);
}

/* === Head === */
.note-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.note-title {
  flex: 1;
  min-width: 0;
  padding: 0;
  border: none;
  background: none;
  text-align: left;
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--text-primary);
  cursor: pointer;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.note-title:focus-visible {
  outline: none;
  color: var(--primary-color);
}

/* === Icon buttons === */
.icon-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-muted);
  font-size: 15px;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease;
}

/* 视觉 32px，实际点击区扩到 44px，满足触摸目标下限 */
.icon-btn::after {
  content: '';
  position: absolute;
  inset: -6px;
}

.icon-btn:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.07);
}

.icon-btn:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 1px;
}

.icon-btn.is-danger:hover {
  color: #f87171;
  background: rgba(220, 38, 38, 0.14);
}

.pin-btn.is-active {
  color: #f59e0b;
}

.pin-btn.is-active:hover {
  color: #fbbf24;
  background: rgba(245, 158, 11, 0.14);
}

/* === Tags === */
.note-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.note-tag {
  font-size: 11px;
  font-weight: 500;
  line-height: 1.6;
  padding: 1px 8px;
  border-radius: 6px;
  color: #a5b4fc;
  background: rgba(139, 92, 246, 0.14);
  border: 1px solid rgba(139, 92, 246, 0.26);
}

/* === Excerpt === */
.note-excerpt {
  margin: 0;
  font-size: 13px;
  line-height: 1.65;
  color: var(--text-secondary);
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.note-excerpt.is-empty {
  color: var(--text-muted);
  font-style: italic;
}

/* === Attachments === */
.note-files {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.file-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  padding: 3px 9px;
  border-radius: 7px;
  font-size: 11px;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--glass-border);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-chip-icon {
  font-size: 13px;
  flex-shrink: 0;
}

.file-chip.is-more {
  color: var(--text-muted);
}

/* === Foot === */
.note-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
  padding-top: 4px;
}

.note-time {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.note-actions {
  display: flex;
  gap: 2px;
  opacity: 0.45;
  transition: opacity 0.2s ease;
}

.note-card:hover .note-actions,
.note-card:focus-within .note-actions {
  opacity: 1;
}

/* 触摸设备没有 hover，操作按钮必须常显 */
@media (hover: none) {
  .note-actions {
    opacity: 1;
  }
}
</style>
