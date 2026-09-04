<template>
  <el-dialog
    :model-value="visible"
    :show-close="false"
    top="6vh"
    class="note-dialog note-viewer-dialog"
    modal-class="note-dialog-overlay"
    @close="$emit('close')"
  >
    <template #header>
      <div class="viewer-head">
        <div class="viewer-head-main">
          <div class="viewer-badges">
            <span v-if="note?.pinned" class="pin-badge">
              <el-icon><StarFilled /></el-icon>已置顶
            </span>
            <span v-for="tag in note?.tags || []" :key="tag" class="viewer-tag">#{{ tag }}</span>
          </div>
          <h2 class="viewer-title">{{ note?.title }}</h2>
          <p class="viewer-meta">
            <span><el-icon><Clock /></el-icon>更新于 {{ formatNoteTime(note?.updated_at) }}</span>
            <span class="dot" aria-hidden="true">·</span>
            <span>创建于 {{ formatNoteTime(note?.created_at) }}</span>
          </p>
        </div>
        <button type="button" class="icon-btn" aria-label="关闭" @click="$emit('close')">
          <el-icon><Close /></el-icon>
        </button>
      </div>
    </template>

    <div class="viewer-body">
      <div v-if="note?.content" class="markdown-body" v-html="renderedContent"></div>
      <p v-else class="viewer-blank">这条笔记没有正文，内容都在附件里。</p>

      <section v-if="attachments.length" class="viewer-files">
        <h3 class="section-title">
          附件<span class="section-count">{{ attachments.length }}</span>
        </h3>

        <div v-if="imageFiles.length" class="image-grid">
          <button
            v-for="file in imageFiles"
            :key="file.id"
            type="button"
            class="image-thumb"
            :aria-label="`查看大图：${file.filename}`"
            @click="openLightbox(file)"
          >
            <img :src="fileUrl(file)" :alt="file.filename" loading="lazy" />
            <span class="image-thumb-name">{{ file.filename }}</span>
          </button>
        </div>

        <div v-if="otherFiles.length" class="file-rows">
          <NoteAttachmentRow
            v-for="file in otherFiles"
            :key="file.id"
            :filename="file.filename"
            :mime-type="file.mime_type"
            :size="file.size"
          >
            <a
              class="icon-btn"
              :href="fileUrl(file, true)"
              :aria-label="`下载 ${file.filename}`"
              rel="noopener"
            >
              <el-icon><Download /></el-icon>
            </a>
          </NoteAttachmentRow>
        </div>
      </section>
    </div>

    <template #footer>
      <el-button @click="$emit('close')">关闭</el-button>
      <el-button type="primary" @click="$emit('edit', note)">
        <el-icon class="btn-icon"><Edit /></el-icon>编辑笔记
      </el-button>
    </template>
  </el-dialog>

  <Teleport to="body">
    <div
      v-if="lightbox"
      ref="lightboxRef"
      class="lightbox"
      tabindex="-1"
      @click="lightbox = null"
      @keydown.esc="lightbox = null"
    >
      <div class="lightbox-bar" @click.stop>
        <span class="lightbox-name">{{ lightbox.filename }}</span>
        <a class="lightbox-btn" :href="fileUrl(lightbox, true)" aria-label="下载原图" rel="noopener">
          <el-icon><Download /></el-icon>
        </a>
        <button type="button" class="lightbox-btn" aria-label="关闭大图" @click="lightbox = null">
          <el-icon><Close /></el-icon>
        </button>
      </div>
      <img :src="fileUrl(lightbox)" :alt="lightbox.filename" class="lightbox-img" @click.stop />
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, nextTick } from 'vue'
import { StarFilled, Clock, Close, Edit, Download } from '@element-plus/icons-vue'
import NoteAttachmentRow from './NoteAttachmentRow.vue'
import { renderMarkdown } from '@/utils/markdown'
import { formatNoteTime, isImageAttachment } from '@/utils/fileType'
import api from '@/api'

const props = defineProps({
  visible: { type: Boolean, default: false },
  note: { type: Object, default: null }
})

defineEmits(['close', 'edit'])

const lightbox = ref(null)
const lightboxRef = ref(null)

const renderedContent = computed(() => renderMarkdown(props.note?.content))
const attachments = computed(() => props.note?.attachments || [])
const imageFiles = computed(() => attachments.value.filter(f => isImageAttachment(f.mime_type)))
const otherFiles = computed(() => attachments.value.filter(f => !isImageAttachment(f.mime_type)))

const fileUrl = (file, download = false) =>
  api.getNoteAttachmentUrl(props.note.id, file.id, { download })

const openLightbox = (file) => {
  lightbox.value = file
  // 焦点移到遮罩上，Esc 才收得到
  nextTick(() => lightboxRef.value?.focus())
}
</script>

<style scoped>
/* === Header === */
.viewer-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.viewer-head-main {
  flex: 1;
  min-width: 0;
}

.viewer-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.pin-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
  color: #fbbf24;
  background: rgba(245, 158, 11, 0.14);
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.viewer-tag {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 6px;
  color: #a5b4fc;
  background: rgba(139, 92, 246, 0.14);
  border: 1px solid rgba(139, 92, 246, 0.26);
}

.viewer-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--text-primary);
  word-break: break-word;
}

.viewer-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.viewer-meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.viewer-meta .dot {
  opacity: 0.5;
}

/* === Body === */
.viewer-body {
  max-height: 62vh;
  overflow-y: auto;
  padding-right: 4px;
}

.viewer-blank {
  margin: 0;
  padding: 24px 0;
  text-align: center;
  color: var(--text-muted);
  font-style: italic;
  font-size: 13px;
}

/* === Attachments === */
.viewer-files {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--glass-border);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.02em;
}

.section-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 6px;
  border-radius: 9px;
  font-size: 11px;
  color: var(--primary-color);
  background: rgba(6, 182, 212, 0.14);
  font-variant-numeric: tabular-nums;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.image-thumb {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  padding: 0;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--glass-border);
  background: rgba(15, 23, 42, 0.5);
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.image-thumb:hover {
  border-color: var(--primary-color);
  transform: translateY(-2px);
}

.image-thumb:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

.image-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.image-thumb-name {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 12px 8px 5px;
  font-size: 10px;
  color: #e2e8f0;
  text-align: left;
  background: linear-gradient(to top, rgba(2, 6, 23, 0.88), transparent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* === Buttons === */
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
  text-decoration: none;
  transition: color 0.2s ease, background 0.2s ease;
}

.icon-btn::after {
  content: '';
  position: absolute;
  inset: -6px;
}

.icon-btn:hover {
  color: var(--primary-color);
  background: rgba(6, 182, 212, 0.12);
}

.icon-btn:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 1px;
}

.btn-icon {
  margin-right: 5px;
}

/* === Lightbox === */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(2, 6, 23, 0.88);
  backdrop-filter: blur(6px);
  outline: none;
  cursor: zoom-out;
}

.lightbox-bar {
  position: absolute;
  top: 16px;
  right: 16px;
  left: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: default;
}

.lightbox-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: #cbd5e1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lightbox-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(15, 23, 42, 0.65);
  color: #e2e8f0;
  font-size: 16px;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.2s ease;
}

.lightbox-btn:hover {
  background: rgba(255, 255, 255, 0.16);
}

.lightbox-img {
  max-width: 92vw;
  max-height: 82vh;
  object-fit: contain;
  border-radius: 12px;
  cursor: default;
}

/* === Rendered markdown === */
.markdown-body {
  font-size: 14px;
  line-height: 1.75;
  color: var(--text-primary);
  word-break: break-word;
}

.markdown-body :deep(> *:first-child) {
  margin-top: 0;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 22px 0 10px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--text-primary);
}

.markdown-body :deep(h1) { font-size: 20px; }
.markdown-body :deep(h2) { font-size: 17px; }
.markdown-body :deep(h3) { font-size: 15px; }
.markdown-body :deep(h4) { font-size: 14px; }

.markdown-body :deep(p) {
  margin: 0 0 12px;
}

.markdown-body :deep(a) {
  color: var(--primary-color);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0 0 12px;
  padding-left: 22px;
}

.markdown-body :deep(li) {
  margin-bottom: 4px;
}

.markdown-body :deep(blockquote) {
  margin: 0 0 12px;
  padding: 6px 14px;
  border-left: 3px solid rgba(6, 182, 212, 0.5);
  background: rgba(6, 182, 212, 0.06);
  border-radius: 0 8px 8px 0;
  color: var(--text-secondary);
}

.markdown-body :deep(code) {
  padding: 2px 6px;
  border-radius: 5px;
  font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
  font-size: 0.88em;
  color: #7dd3fc;
  background: rgba(2, 6, 23, 0.6);
  border: 1px solid var(--glass-border);
}

.markdown-body :deep(pre) {
  margin: 0 0 12px;
  padding: 14px 16px;
  border-radius: 12px;
  overflow-x: auto;
  background: rgba(2, 6, 23, 0.7);
  border: 1px solid var(--glass-border);
}

.markdown-body :deep(pre code) {
  padding: 0;
  border: none;
  background: none;
  color: #cbd5e1;
}

.markdown-body :deep(table) {
  width: 100%;
  margin: 0 0 12px;
  border-collapse: collapse;
  font-size: 13px;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 7px 12px;
  border: 1px solid var(--glass-border);
  text-align: left;
}

.markdown-body :deep(th) {
  background: rgba(255, 255, 255, 0.04);
  font-weight: 600;
}

.markdown-body :deep(hr) {
  margin: 20px 0;
  border: none;
  border-top: 1px solid var(--glass-border);
}

.markdown-body :deep(img) {
  max-width: 100%;
  border-radius: 10px;
}

@media (max-width: 768px) {
  .viewer-title {
    font-size: 17px;
  }

  .viewer-body {
    max-height: 60vh;
  }
}
</style>
