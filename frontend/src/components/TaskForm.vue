<template>
  <el-dialog
    :model-value="visible"
    :title="isEdit ? '编辑任务' : '新建任务'"
    width="600px"
    :before-close="done => { if (!submitting) done() }"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :inert="submitting"
      :model="form"
      :rules="rules"
      label-width="80px"
      @submit.prevent="handleSubmit"
    >
      <el-form-item label="任务标题" prop="title">
        <el-input
          v-model="form.title"
          placeholder="请输入任务标题"
          maxlength="255"
          show-word-limit
        />
      </el-form-item>

      <el-form-item label="任务描述" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          placeholder="请输入任务描述（可选）"
          :rows="4"
          maxlength="1000"
          show-word-limit
        />
      </el-form-item>

      <el-form-item label="任务图片">
        <div class="image-upload-area">
          <div class="image-preview-list">
            <div v-for="img in existingImages" :key="'e-' + img.id" class="image-thumb">
              <img :src="getImageUrl(img)" :alt="img.filename" @click="openFormImage(getImageUrl(img))" />
              <button type="button" class="image-remove-btn" @click="removeExistingImage(img)" title="删除">×</button>
            </div>
            <div v-for="(file, idx) in pendingFiles" :key="'p-' + idx" class="image-thumb">
              <img :src="file.preview" :alt="file.raw.name" @click="openFormImage(file.preview)" />
              <button type="button" class="image-remove-btn" @click="removePendingFile(idx)" title="删除">×</button>
            </div>
            <div v-if="totalImageCount < 10" class="image-add-btn" @click="triggerFileInput">
              <span class="image-add-icon">+</span>
              <span class="image-add-text">{{ totalImageCount }}/10</span>
            </div>
          </div>
          <input
            ref="imageInputRef"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            style="display:none"
            @change="handleImageSelect"
          />
        </div>
      </el-form-item>

      <el-form-item label="截止日期" prop="due_date">
        <el-date-picker
          v-model="form.due_date"
          type="date"
          placeholder="选择截止日期（可选）"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button :disabled="submitting" @click="handleClose">取消</el-button>
        <el-button
          type="primary"
          :loading="submitting"
          @click="handleSubmit"
        >
          {{ isEdit ? '更新' : '创建' }}
        </el-button>
      </div>
    </template>
  </el-dialog>

  <Teleport to="body">
    <div v-if="showFormViewer" class="image-overlay" @click="showFormViewer = false">
      <img :src="formViewerUrl" class="image-overlay-img" @click.stop />
    </div>
  </Teleport>
</template>

<script>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'

// crypto.randomUUID 仅在安全上下文（HTTPS / localhost）可用，局域网 HTTP 调试时不存在；
// 回退到任何上下文都可用的 getRandomValues 生成 v4 UUID（格式需符合后端 upload_id 校验）
const newUploadId = () => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export default {
  name: 'TaskForm',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    task: {
      type: Object,
      default: null
    }
  },
  emits: ['close', 'submit'],
  setup(props, { emit }) {
    const formRef = ref()
    const imageInputRef = ref()
    const submitting = ref(false)
    const showFormViewer = ref(false)
    const formViewerUrl = ref('')

    const defaultForm = {
      title: '',
      description: '',
      due_date: null
    }

    const form = ref({ ...defaultForm })
    const savedTaskId = ref(null)
    const existingImages = ref([])
    const pendingFiles = ref([])
    const removedImageIds = ref([])

    const totalImageCount = computed(() => existingImages.value.length + pendingFiles.value.length)

    const rules = {
      title: [
        { required: true, message: '请输入任务标题', trigger: 'blur' },
        { min: 1, max: 255, message: '标题长度应在1到255个字符之间', trigger: 'blur' }
      ]
    }

    const isEdit = computed(() => !!props.task)

    const getImageUrl = img => api.getTaskImageUrl(props.task?.id ?? savedTaskId.value, img.id)

    const triggerFileInput = () => {
      imageInputRef.value?.click()
    }

    const handleImageSelect = (e) => {
      const files = Array.from(e.target.files || [])
      const remaining = 10 - totalImageCount.value
      const toAdd = files.slice(0, remaining)

      for (const file of toAdd) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          ElMessage.warning(`${file.name} 格式不支持，仅支持 JPG/PNG/WebP`)
          continue
        }
        if (file.size > 5 * 1024 * 1024) {
          ElMessage.warning(`${file.name} 超过 5MB 限制`)
          continue
        }
        pendingFiles.value.push({
          raw: file,
          // 同一文件的所有重试共用此标识，服务端据此去重（见后端 upload_id）
          uploadId: newUploadId(),
          preview: URL.createObjectURL(file)
        })
      }

      // Reset input so same file can be selected again
      e.target.value = ''
    }

    const removeExistingImage = (img) => {
      removedImageIds.value.push(img.id)
      existingImages.value = existingImages.value.filter(i => i.id !== img.id)
    }

    const removePendingFile = (idx) => {
      URL.revokeObjectURL(pendingFiles.value[idx].preview)
      pendingFiles.value.splice(idx, 1)
    }

    const openFormImage = (url) => {
      formViewerUrl.value = url
      showFormViewer.value = true
    }

    const cleanupPreviews = () => {
      pendingFiles.value.forEach(f => URL.revokeObjectURL(f.preview))
    }

    const resetForm = () => {
      form.value = { ...defaultForm }
      savedTaskId.value = null
      cleanupPreviews()
      existingImages.value = []
      pendingFiles.value = []
      removedImageIds.value = []
      if (formRef.value) {
        formRef.value.clearValidate()
      }
    }

    const handleClose = () => {
      if (submitting.value) return
      if (savedTaskId.value) emit('submit')
      resetForm()
      emit('close')
    }

    const handleSubmit = async () => {
      if (submitting.value) return
      submitting.value = true
      try {
        if (!await formRef.value.validate().catch(() => false)) return

        const data = {
          title: form.value.title.trim(),
          description: form.value.description.trim(),
          due_date: form.value.due_date
        }

        let taskId = props.task?.id ?? savedTaskId.value
        if (taskId) {
          await api.updateTask(taskId, data)
        } else {
          const res = await api.createTask(data)
          taskId = res.data.id
        }
        savedTaskId.value = taskId
        while (removedImageIds.value.length) {
          try {
            await api.deleteTaskImage(taskId, removedImageIds.value[0])
          } catch (error) {
            if (error.response?.status !== 404) throw error
          }
          removedImageIds.value.shift()
        }
        while (pendingFiles.value.length) {
          const { raw, uploadId } = pendingFiles.value[0]
          const response = await api.uploadTaskImages(taskId, [raw], uploadId)
          existingImages.value.push(...response.data)
          removePendingFile(0)
        }

        // Fetch final task state with images
        const finalRes = await api.getTask(taskId)
        ElMessage.success(isEdit.value ? '任务更新成功' : '任务创建成功')
        savedTaskId.value = null
        emit('submit', { action: isEdit.value ? 'update' : 'create', task: finalRes.data })
        resetForm()
        emit('close')

      } catch (error) {
        if (error.errors) {
          return
        }
        console.error('提交任务失败:', error)
        ElMessage.error(isEdit.value ? '更新任务失败' : '创建任务失败')
      } finally {
        submitting.value = false
      }
    }

    watch([() => props.visible, () => props.task], ([visible, task]) => {
      if (!visible) return
      resetForm()
      if (task) {
        form.value = { title: task.title, description: task.description || '', due_date: task.due_date }
        existingImages.value = [...(task.images || [])]
      }
    }, { immediate: true })

    return {
      formRef,
      imageInputRef,
      form,
      rules,
      submitting,
      isEdit,
      existingImages,
      pendingFiles,
      totalImageCount,
      getImageUrl,
      triggerFileInput,
      handleImageSelect,
      removeExistingImage,
      removePendingFile,
      openFormImage,
      showFormViewer,
      formViewerUrl,
      handleClose,
      handleSubmit
    }
  }
}
</script>

<style scoped>
.dialog-footer {
  text-align: right;
}

.image-upload-area {
  width: 100%;
}

.image-preview-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.image-thumb {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
  background: rgba(15, 23, 42, 0.4);
  flex-shrink: 0;
}

.image-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  cursor: pointer;
}

.image-remove-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.85);
  color: #fff;
  border: none;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.image-thumb:hover .image-remove-btn {
  opacity: 1;
}

.image-add-btn {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  border: 1px dashed var(--glass-border, rgba(255,255,255,0.2));
  background: rgba(15, 23, 42, 0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-muted, #94a3b8);
  transition: all 0.2s;
  flex-shrink: 0;
}

.image-add-btn:hover {
  border-color: var(--primary-color, #06b6d4);
  color: var(--primary-color, #06b6d4);
  background: rgba(6, 182, 212, 0.05);
}

.image-add-icon {
  font-size: 24px;
  line-height: 1;
}

.image-add-text {
  font-size: 11px;
  margin-top: 2px;
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
