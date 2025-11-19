<template>
  <el-dialog 
    :model-value="visible"
    :title="isEdit ? '编辑任务' : '新建任务'"
    width="500px"
    @close="handleClose"
  >
    <el-form 
      ref="formRef"
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
        <el-button @click="handleClose">取消</el-button>
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
</template>

<script>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'

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
    const submitting = ref(false)
    
    const defaultForm = {
      title: '',
      description: '',
      due_date: null
    }
    
    const form = ref({ ...defaultForm })
    
    const rules = {
      title: [
        { required: true, message: '请输入任务标题', trigger: 'blur' },
        { min: 1, max: 255, message: '标题长度应在1到255个字符之间', trigger: 'blur' }
      ]
    }
    
    const isEdit = computed(() => !!props.task)
    
    const resetForm = () => {
      form.value = { ...defaultForm }
      if (formRef.value) {
        formRef.value.clearValidate()
      }
    }
    
    const handleClose = () => {
      resetForm()
      emit('close')
    }
    
    const handleSubmit = async () => {
      try {
        await formRef.value.validate()
        
        submitting.value = true
        
        const data = {
          title: form.value.title.trim(),
          description: form.value.description.trim(),
          due_date: form.value.due_date
        }
        
        if (isEdit.value) {
          await api.updateTask(props.task.id, data)
          ElMessage.success('任务更新成功')
        } else {
          await api.createTask(data)
          ElMessage.success('任务创建成功')
        }
        
        emit('submit')
        handleClose()
        
      } catch (error) {
        if (error.errors) {
          // 表单验证错误
          return
        }
        console.error('提交任务失败:', error)
        ElMessage.error(isEdit.value ? '更新任务失败' : '创建任务失败')
      } finally {
        submitting.value = false
      }
    }
    
    // 监听props.task的变化来填充表单
    watch(() => props.task, (newTask) => {
      if (newTask) {
        form.value = {
          title: newTask.title,
          description: newTask.description || '',
          due_date: newTask.due_date
        }
      } else {
        resetForm()
      }
    }, { immediate: true })
    
    // 监听visible变化来重置表单
    watch(() => props.visible, (visible) => {
      if (!visible) {
        setTimeout(() => {
          resetForm()
        }, 200) // 等待对话框完全关闭
      }
    })
    
    return {
      formRef,
      form,
      rules,
      submitting,
      isEdit,
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
</style>