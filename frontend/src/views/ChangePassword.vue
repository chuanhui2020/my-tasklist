<template>
  <div class="change-password-wrapper">
    <el-card class="change-password-card" shadow="hover">
      <template #header>
        <div class="change-password-header">
          <div>
            <div class="change-password-title">修改密码</div>
            <div class="change-password-subtitle">为了账户安全，请定期更换密码</div>
          </div>
        </div>
      </template>

      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="原密码" prop="oldPassword">
          <el-input 
            v-model="form.oldPassword" 
            type="password" 
            placeholder="请输入原密码" 
            show-password 
            autocomplete="current-password"
          />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input 
            v-model="form.newPassword" 
            type="password" 
            placeholder="请输入新密码" 
            show-password 
            autocomplete="new-password"
          />
        </el-form-item>
        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input 
            v-model="form.confirmPassword" 
            type="password" 
            placeholder="请再次输入新密码" 
            show-password 
            autocomplete="new-password"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleSubmit">修改密码</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import api, { authStorage } from '@/api'

const router = useRouter()
const formRef = ref(null)
const loading = ref(false)

const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const validateConfirmPassword = (rule, value, callback) => {
  if (value === '') {
    callback(new Error('请再次输入新密码'))
  } else if (value !== form.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const rules = {
  oldPassword: [
    { required: true, message: '请输入原密码', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

const handleSubmit = () => {
  formRef.value?.validate(async (valid) => {
    if (!valid) return
    
    loading.value = true
    try {
      await api.changePassword({
        old_password: form.oldPassword,
        new_password: form.newPassword
      })
      
      ElMessage.success('密码修改成功，请重新登录')
      
      // Clear auth and redirect to login after 1.5 seconds
      setTimeout(() => {
        authStorage.clear()
        router.replace('/login')
      }, 1500)
      
    } catch (error) {
      // Error message is handled by interceptor
    } finally {
      loading.value = false
    }
  })
}

const handleReset = () => {
  form.oldPassword = ''
  form.newPassword = ''
  form.confirmPassword = ''
  formRef.value?.clearValidate()
}
</script>

<style scoped>
.change-password-wrapper {
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 20px;
}

.change-password-card {
  border-radius: 20px;
}

.change-password-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.change-password-title {
  font-size: 20px;
  font-weight: 600;
}

.change-password-subtitle {
  font-size: 13px;
  color: #8c8c8c;
  margin-top: 4px;
}
</style>
