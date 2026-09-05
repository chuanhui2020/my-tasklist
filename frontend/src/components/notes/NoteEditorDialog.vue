<template>
  <el-dialog
    :model-value="visible"
    :title="isEdit ? '编辑笔记' : '新建笔记'"
    top="6vh"
    class="note-dialog note-editor-dialog"
    modal-class="note-dialog-overlay"
    :close-on-click-modal="false"
    :before-close="handleBeforeClose"
    @close="$emit('close')"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="handleSubmit">
      <el-form-item label="标题" prop="title">
        <el-input
          v-model="form.title"
          placeholder="给这条笔记起个名字"
          maxlength="120"
          show-word-limit
          autocomplete="off"
        />
      </el-form-item>

      <el-form-item label="标签">
        <el-select
          v-model="form.tags"
          multiple
          filterable
          allow-create
          default-first-option
          :reserve-keyword="false"
          :multiple-limit="8"
          placeholder="输入后回车创建标签，最多 8 个"
          class="tag-select"
          popper-class="note-tag-dropdown"
        >
          <el-option v-for="tag in existingTags" :key="tag" :label="tag" :value="tag" />
        </el-select>
        <p class="field-hint">标签用来分组和筛选，例如「证件」「报销」「密码提示」。</p>
      </el-form-item>

      <el-form-item prop="content">
        <template #label>
          <div class="content-label">
            <span>正文</span>
            <div class="mode-switch" role="tablist" aria-label="正文编辑模式">
              <button
                v-for="mode in MODES"
                :key="mode.value"
                type="button"
                role="tab"
                class="mode-btn"
                :class="{ 'is-active': editorMode === mode.value }"
                :aria-selected="editorMode === mode.value"
                @click="editorMode = mode.value"
              >
                <el-icon><component :is="mode.icon" /></el-icon>{{ mode.label }}
              </button>
            </div>
          </div>
        </template>

        <el-input
          v-show="editorMode === 'edit'"
          v-model="form.content"
          class="content-textarea"
          type="textarea"
          :rows="12"
          resize="vertical"
          maxlength="50000"
          placeholder="支持 Markdown：# 标题、**粗体**、- 列表、`代码`、| 表格 |"
        />
        <div v-show="editorMode === 'preview'" class="preview-pane">
          <div v-if="form.content" class="markdown-body" v-html="renderedPreview"></div>
          <p v-else class="preview-empty">还没有内容可以预览。</p>
        </div>
      </el-form-item>

      <el-form-item :label="`附件（${totalFileCount}/10）`">
        <div class="upload-area">
          <div
            class="dropzone"
            :class="{ 'is-over': dragOver, 'is-full': totalFileCount >= 10 }"
            @click="triggerFilePicker"
            @keydown.enter.prevent="triggerFilePicker"
            @keydown.space.prevent="triggerFilePicker"
            @dragover.prevent="dragOver = true"
            @dragleave.prevent="dragOver = false"
            @drop.prevent="handleDrop"
            tabindex="0"
            role="button"
            aria-label="选择或拖入要上传的文件"
          >
            <el-icon class="dropzone-icon"><UploadFilled /></el-icon>
            <span class="dropzone-title">
              {{ totalFileCount >= 10 ? '附件数量已达上限' : '点击选择文件，或拖到这里' }}
            </span>
            <span class="dropzone-hint">图片 / PDF / Word / Excel / PPT / 文本 / ZIP，单个不超过 10MB</span>
          </div>
          <input
            ref="fileInputRef"
            type="file"
            multiple
            :accept="ACCEPT"
            class="visually-hidden"
            @change="handleFileSelect"
          />

          <div v-if="totalFileCount" class="file-rows">
            <NoteAttachmentRow
              v-for="file in existingFiles"
              :key="`e-${file.id}`"
              :filename="file.filename"
              :mime-type="file.mime_type"
              :size="file.size"
            >
              <button
                type="button"
                class="icon-btn is-danger"
                :aria-label="`移除附件 ${file.filename}`"
                @click="removeExistingFile(file)"
              >
                <el-icon><Delete /></el-icon>
              </button>
            </NoteAttachmentRow>

            <NoteAttachmentRow
              v-for="(file, index) in pendingFiles"
              :key="`p-${index}`"
              :filename="file.name"
              :mime-type="file.type"
              :size="file.size"
            >
              <span class="pending-badge">待上传</span>
              <button
                type="button"
                class="icon-btn is-danger"
                :aria-label="`移除待上传文件 ${file.name}`"
                @click="pendingFiles.splice(index, 1)"
              >
                <el-icon><Delete /></el-icon>
              </button>
            </NoteAttachmentRow>
          </div>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ submitLabel }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { UploadFilled, Delete, EditPen, View } from '@element-plus/icons-vue'
import NoteAttachmentRow from './NoteAttachmentRow.vue'
import { renderMarkdown } from '@/utils/markdown'
import api from '@/api'

const MODES = [
  { value: 'edit', label: '编辑', icon: EditPen },
  { value: 'preview', label: '预览', icon: View },
]

// 与后端 ALLOWED_TYPES 一一对应；后端仍会再校验一遍，这里只是提前拦下明显不合规的
const ALLOWED_EXT = [
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'txt', 'md', 'csv', 'json',
  'zip', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
]
const ACCEPT = ALLOWED_EXT.map(ext => `.${ext}`).join(',')
const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_FILES = 10

const props = defineProps({
  visible: { type: Boolean, default: false },
  note: { type: Object, default: null },
  existingTags: { type: Array, default: () => [] }
})

const emit = defineEmits(['close', 'saved'])

const formRef = ref(null)
const fileInputRef = ref(null)
const submitting = ref(false)
const dragOver = ref(false)
const editorMode = ref('edit')

const form = ref({ title: '', content: '', tags: [] })
const existingFiles = ref([])
const removedFileIds = ref([])
const pendingFiles = ref([])
const snapshot = ref('')

const rules = {
  title: [
    { required: true, message: '请输入笔记标题', trigger: 'blur' },
    { max: 120, message: '标题不能超过 120 个字符', trigger: 'blur' }
  ]
}

const isEdit = computed(() => !!props.note)
const totalFileCount = computed(() => existingFiles.value.length + pendingFiles.value.length)
const renderedPreview = computed(() => renderMarkdown(form.value.content))

const submitLabel = computed(() => {
  if (!submitting.value) return isEdit.value ? '保存' : '创建笔记'
  return pendingFiles.value.length ? '上传中…' : '保存中…'
})

// 序列化整个编辑态，用来判断「有没有改动」——包括附件的增删
const serialize = () => JSON.stringify({
  title: form.value.title,
  content: form.value.content,
  tags: [...form.value.tags].sort(),
  files: existingFiles.value.map(f => f.id).sort(),
  pending: pendingFiles.value.map(f => `${f.name}:${f.size}`),
})

const isDirty = computed(() => serialize() !== snapshot.value)

const resetFrom = (note) => {
  form.value = {
    title: note?.title || '',
    content: note?.content || '',
    tags: [...(note?.tags || [])],
  }
  existingFiles.value = [...(note?.attachments || [])]
  removedFileIds.value = []
  pendingFiles.value = []
  editorMode.value = 'edit'
  snapshot.value = serialize()
  nextTick(() => formRef.value?.clearValidate())
}

watch(() => props.visible, (open) => {
  if (open) resetFrom(props.note)
})

const triggerFilePicker = () => {
  if (totalFileCount.value >= MAX_FILES) {
    ElMessage.warning(`每条笔记最多 ${MAX_FILES} 个附件`)
    return
  }
  fileInputRef.value?.click()
}

const addFiles = (files) => {
  const remaining = MAX_FILES - totalFileCount.value
  if (remaining <= 0) {
    ElMessage.warning(`每条笔记最多 ${MAX_FILES} 个附件`)
    return
  }
  if (files.length > remaining) {
    ElMessage.warning(`最多还能再添加 ${remaining} 个附件，多余的已忽略`)
  }
  for (const file of files.slice(0, remaining)) {
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!ALLOWED_EXT.includes(ext)) {
      ElMessage.warning(`${file.name} 的格式不支持`)
      continue
    }
    if (file.size > MAX_FILE_SIZE) {
      ElMessage.warning(`${file.name} 超过 10MB 限制`)
      continue
    }
    pendingFiles.value.push(file)
  }
}

const handleFileSelect = (event) => {
  addFiles(Array.from(event.target.files || []))
  // 清空 input，同一个文件才能被再次选中
  event.target.value = ''
}

const handleDrop = (event) => {
  dragOver.value = false
  addFiles(Array.from(event.dataTransfer?.files || []))
}

const removeExistingFile = (file) => {
  removedFileIds.value.push(file.id)
  existingFiles.value = existingFiles.value.filter(f => f.id !== file.id)
}

// 有未保存改动时拦一道，避免误关弹窗丢内容
const confirmDiscard = async () => {
  if (!isDirty.value) return true
  try {
    await ElMessageBox.confirm('有未保存的修改，关闭后会丢失。', '放弃编辑？', {
      confirmButtonText: '放弃修改',
      cancelButtonText: '继续编辑',
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
    })
    return true
  } catch {
    return false
  }
}

const handleBeforeClose = async (done) => {
  if (await confirmDiscard()) done()
}

const handleCancel = async () => {
  if (await confirmDiscard()) emit('close')
}

// 逐个删，删掉一个就从待删列表移除。整批 Promise.all 的话，
// 重试会对已经删掉的 id 再删一次、拿到 404，把整个保存流程卡死。
// 返回没删成功的数量，交给调用方提示。
const removeMarkedAttachments = async (noteId) => {
  if (!removedFileIds.value.length) return 0
  const stillPending = []
  for (const id of removedFileIds.value) {
    try {
      await api.deleteNoteAttachment(noteId, id)
    } catch (error) {
      // 404 = 服务端已经没有这条记录了，视作删除成功，不再重试
      if (error?.response?.status !== 404) stillPending.push(id)
    }
  }
  removedFileIds.value = stillPending
  return stillPending.length
}

const handleSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const payload = {
      title: form.value.title.trim(),
      content: form.value.content,
      tags: form.value.tags,
    }

    // 顺序不能调换：正文必须先落库。反过来先删附件的话，正文保存失败时
    // 文件已经被永久删掉，用户看到「保存失败」但东西已经没了。
    let noteId
    if (isEdit.value) {
      await api.updateNote(props.note.id, payload)
      noteId = props.note.id
    } else {
      const { data } = await api.createNote(payload)
      noteId = data.id
    }

    // 删除放在上传之前：反过来可能瞬间超出「每条最多 10 个附件」被后端拒掉
    const failedDeletes = await removeMarkedAttachments(noteId)

    if (pendingFiles.value.length) {
      await api.uploadNoteAttachments(noteId, pendingFiles.value)
      pendingFiles.value = []
    }

    // 附件是分开写的，回读一次拿到最终状态，避免列表显示滞后
    const { data: saved } = await api.getNote(noteId)
    if (failedDeletes) {
      ElMessage.warning(`笔记已保存，但有 ${failedDeletes} 个附件没能删除，可以再试一次`)
    } else {
      ElMessage.success(isEdit.value ? '笔记已保存' : '笔记已创建')
    }
    snapshot.value = serialize()
    emit('saved', saved)
    emit('close')
  } catch (error) {
    if (error?.errors) return
    console.error('保存笔记失败:', error)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.field-hint {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-muted);
}

.tag-select {
  width: 100%;
}

/* === Content label + mode switch === */
.content-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.mode-switch {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--glass-border);
}

.mode-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.6;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease;
}

.mode-btn:hover {
  color: var(--text-primary);
}

.mode-btn.is-active {
  color: #fff;
  background: rgba(6, 182, 212, 0.85);
}

.mode-btn:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 1px;
}

/* === Preview === */
.preview-pane {
  width: 100%;
  min-height: 268px;
  max-height: 420px;
  overflow-y: auto;
  padding: 14px 16px;
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.35);
  border: 1px solid var(--border-color);
}

.preview-empty {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  font-style: italic;
}

/* === Upload === */
.upload-area {
  width: 100%;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 20px 16px;
  border-radius: 12px;
  border: 1px dashed rgba(148, 163, 184, 0.32);
  background: rgba(2, 6, 23, 0.25);
  cursor: pointer;
  text-align: center;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.dropzone:hover,
.dropzone.is-over {
  border-color: var(--primary-color);
  background: rgba(6, 182, 212, 0.07);
}

.dropzone:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

.dropzone.is-full {
  cursor: not-allowed;
  opacity: 0.55;
}

.dropzone-icon {
  font-size: 26px;
  color: var(--primary-color);
}

.dropzone-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.6;
}

.dropzone-hint {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.6;
}

.file-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.pending-badge {
  padding: 2px 7px;
  border-radius: 6px;
  font-size: 11px;
  color: #fbbf24;
  background: rgba(245, 158, 11, 0.14);
  border: 1px solid rgba(245, 158, 11, 0.28);
}

/* === Icon buttons === */
.icon-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 15px;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease;
}

.icon-btn::after {
  content: '';
  position: absolute;
  inset: -6px;
}

.icon-btn.is-danger:hover {
  color: #f87171;
  background: rgba(220, 38, 38, 0.14);
}

.icon-btn:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 1px;
}

/* === Rendered markdown (preview) === */
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
  margin: 20px 0 10px;
  font-weight: 700;
  line-height: 1.4;
}

.markdown-body :deep(h1) { font-size: 19px; }
.markdown-body :deep(h2) { font-size: 16px; }
.markdown-body :deep(h3) { font-size: 15px; }
.markdown-body :deep(h4) { font-size: 14px; }

.markdown-body :deep(p) { margin: 0 0 12px; }

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

.markdown-body :deep(img) {
  max-width: 100%;
  border-radius: 10px;
}
</style>
