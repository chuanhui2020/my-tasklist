<template>
  <div class="secure-notes-page">
    <div class="page-header">
      <h2 class="page-title">信息收纳</h2>
      <el-button type="primary" @click="openCreateDialog">新建笔记</el-button>
    </div>

    <div v-if="notes.length" class="notes-grid">
      <div v-for="note in notes" :key="note.id" class="note-card" @click="openUnlockDialog(note)">
        <div class="note-card-header">
          <span class="lock-icon">🔒</span>
          <span class="note-title">{{ note.title }}</span>
        </div>
        <div class="note-card-footer">
          <span class="note-time">{{ note.created_at }}</span>
          <div class="note-actions" @click.stop>
            <el-button size="small" text @click="openEditUnlock(note)">编辑</el-button>
            <el-popconfirm title="确定删除这条笔记？" @confirm="handleDelete(note.id)">
              <template #reference>
                <el-button size="small" text type="danger">删除</el-button>
              </template>
            </el-popconfirm>
          </div>
        </div>
      </div>
    </div>
    <el-empty v-else description="还没有收纳任何信息" />

    <!-- Unlock Dialog -->
    <el-dialog v-model="unlockVisible" title="输入密码查看" width="400px" :close-on-click-modal="false" @closed="resetUnlock">
      <el-form @submit.prevent="handleUnlock">
        <el-form-item label="密码">
          <el-input v-model="unlockPassword" type="password" show-password placeholder="请输入笔记密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="unlockVisible = false">取消</el-button>
        <el-button type="primary" :loading="unlocking" @click="handleUnlock">解锁</el-button>
      </template>
    </el-dialog>

    <!-- Content Viewer Dialog -->
    <el-dialog v-model="viewerVisible" :title="viewingNote?.title" width="600px" @closed="clearViewer">
      <div class="viewer-content">{{ viewerContent }}</div>
      <template #footer>
        <el-button @click="viewerVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- Create / Edit Dialog -->
    <el-dialog v-model="formVisible" :title="isEditing ? '编辑笔记' : '新建笔记'" width="560px" :close-on-click-modal="false" @closed="resetForm">
      <el-form :model="form" label-position="top">
        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="笔记标题" maxlength="100" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="form.content" type="textarea" :rows="6" placeholder="输入要加密保存的内容" />
        </el-form-item>
        <el-form-item v-if="isEditing" label="当前密码">
          <el-input v-model="form.password" type="password" show-password placeholder="输入当前密码以验证身份" />
        </el-form-item>
        <el-form-item v-if="isEditing" label="新密码（不修改留空）">
          <el-input v-model="form.new_password" type="password" show-password placeholder="留空则保持原密码" />
        </el-form-item>
        <el-form-item v-if="!isEditing" label="设置密码">
          <el-input v-model="form.password" type="password" show-password placeholder="至少4位" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ isEditing ? '保存' : '创建' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'

const notes = ref([])
const loading = ref(false)

// Unlock state
const unlockVisible = ref(false)
const unlockPassword = ref('')
const unlocking = ref(false)
const selectedNote = ref(null)
const unlockMode = ref('view') // 'view' or 'edit'

// Viewer state
const viewerVisible = ref(false)
const viewingNote = ref(null)
const viewerContent = ref('')

// Form state
const formVisible = ref(false)
const isEditing = ref(false)
const editingNoteId = ref(null)
const submitting = ref(false)
const form = ref({ title: '', content: '', password: '', new_password: '' })

async function fetchNotes() {
  loading.value = true
  try {
    const { data } = await api.getSecureNotes()
    notes.value = data
  } finally {
    loading.value = false
  }
}

function openUnlockDialog(note) {
  selectedNote.value = note
  unlockMode.value = 'view'
  unlockVisible.value = true
}

function openEditUnlock(note) {
  selectedNote.value = note
  unlockMode.value = 'edit'
  unlockVisible.value = true
}

function resetUnlock() {
  unlockPassword.value = ''
  selectedNote.value = null
}

async function handleUnlock() {
  if (!unlockPassword.value) {
    ElMessage.warning('请输入密码')
    return
  }
  unlocking.value = true
  try {
    const { data } = await api.unlockSecureNote(selectedNote.value.id, unlockPassword.value)
    unlockVisible.value = false
    if (unlockMode.value === 'edit') {
      isEditing.value = true
      editingNoteId.value = selectedNote.value.id
      form.value = {
        title: data.title,
        content: data.content,
        password: unlockPassword.value,
        new_password: '',
      }
      formVisible.value = true
    } else {
      viewingNote.value = selectedNote.value
      viewerContent.value = data.content
      viewerVisible.value = true
    }
  } catch (e) {
    // error handled by interceptor
  } finally {
    unlocking.value = false
  }
}

function clearViewer() {
  viewerContent.value = ''
  viewingNote.value = null
}

function openCreateDialog() {
  isEditing.value = false
  editingNoteId.value = null
  form.value = { title: '', content: '', password: '', new_password: '' }
  formVisible.value = true
}

function resetForm() {
  form.value = { title: '', content: '', password: '', new_password: '' }
}

async function handleSubmit() {
  if (!form.value.title.trim()) {
    ElMessage.warning('请输入标题')
    return
  }
  if (!form.value.content.trim()) {
    ElMessage.warning('请输入内容')
    return
  }
  if (!isEditing.value && (!form.value.password || form.value.password.length < 4)) {
    ElMessage.warning('密码至少4位')
    return
  }
  if (isEditing.value && !form.value.password) {
    ElMessage.warning('请输入当前密码')
    return
  }

  submitting.value = true
  try {
    if (isEditing.value) {
      await api.updateSecureNote(editingNoteId.value, form.value)
      ElMessage.success('已更新')
    } else {
      await api.createSecureNote({
        title: form.value.title,
        content: form.value.content,
        password: form.value.password,
      })
      ElMessage.success('已创建')
    }
    formVisible.value = false
    fetchNotes()
  } catch (e) {
    // handled by interceptor
  } finally {
    submitting.value = false
  }
}

async function handleDelete(id) {
  try {
    await api.deleteSecureNote(id)
    ElMessage.success('已删除')
    fetchNotes()
  } catch (e) {
    // handled by interceptor
  }
}

onMounted(fetchNotes)
</script>

<style scoped>
.secure-notes-page {
  max-width: 960px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  background: linear-gradient(to right, #fff, #94a3b8);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0;
}

.notes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.note-card {
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.note-card:hover {
  border-color: var(--primary-color);
  box-shadow: 0 0 20px rgba(6, 182, 212, 0.15);
  transform: translateY(-2px);
}

.note-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.lock-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.note-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.note-time {
  font-size: 12px;
  color: var(--text-secondary);
}

.note-actions {
  display: flex;
  gap: 4px;
}

.viewer-content {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.7;
  color: var(--text-primary);
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
}
</style>
