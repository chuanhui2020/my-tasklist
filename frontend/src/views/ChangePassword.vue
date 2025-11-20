<template>
  <div class="change-password-wrapper">
    <!-- Background shapes for visual interest -->
    <div class="background-shapes">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
    </div>

    <el-card class="change-password-card" :body-style="{ padding: '40px' }">
      <template #header>
        <div class="change-password-header">
          <div class="header-icon">
            <el-icon>
              <Lock />
            </el-icon>
          </div>
          <div class="header-content">
            <h2 class="change-password-title">修改密码</h2>
            <p class="change-password-subtitle">为了您的账户安全，建议定期更换密码</p>
          </div>
        </div>
      </template>

      <el-form :model="form" :rules="rules" ref="formRef" label-position="top" size="large" class="password-form">
        <el-form-item label="当前密码" prop="oldPassword">
          <el-input v-model="form.oldPassword" type="password" placeholder="请输入当前使用的密码" show-password
            autocomplete="current-password" prefix-icon="Key" />
        </el-form-item>

        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="form.newPassword" type="password" placeholder="请输入新密码" show-password
            autocomplete="new-password" prefix-icon="Lock" @input="checkPasswordStrength" />
          <div class="password-strength" v-if="form.newPassword">
            <div class="strength-bar">
              <div class="strength-fill" :class="strengthClass" :style="{ width: strengthPercent + '%' }"></div>
            </div>
            <span class="strength-text">{{ strengthText }}</span>
          </div>
        </el-form-item>

        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input v-model="form.confirmPassword" type="password" placeholder="请再次输入新密码" show-password
            autocomplete="new-password" prefix-icon="CircleCheck" />
        </el-form-item>

        <el-form-item class="form-actions">
          <el-button type="primary" :loading="loading" @click="handleSubmit" class="submit-btn">
            确认修改
          </el-button>
          <el-button @click="handleReset" class="reset-btn">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { Lock, Key, CircleCheck } from '@element-plus/icons-vue'
import api, { authStorage } from '@/api'

const router = useRouter()
const formRef = ref(null)
const loading = ref(false)
const strengthScore = ref(0)

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
    { required: true, message: '请输入当前密码', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' },
    {
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/,
      message: '密码需包含大小写字母、数字和特殊字符',
      trigger: 'blur'
    }
  ],
  confirmPassword: [
    { required: true, validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

// Password Strength Logic
const checkPasswordStrength = (value) => {
  let score = 0
  if (!value) {
    strengthScore.value = 0
    return
  }
  if (value.length >= 6) score += 1
  if (value.length >= 10) score += 1
  if (/[A-Z]/.test(value)) score += 1
  if (/[0-9]/.test(value)) score += 1
  if (/[^A-Za-z0-9]/.test(value)) score += 1
  strengthScore.value = score
}

const strengthPercent = computed(() => {
  return Math.min(100, (strengthScore.value / 5) * 100)
})

const strengthClass = computed(() => {
  if (strengthScore.value <= 2) return 'weak'
  if (strengthScore.value <= 3) return 'medium'
  return 'strong'
})

const strengthText = computed(() => {
  if (strengthScore.value <= 2) return '弱'
  if (strengthScore.value <= 3) return '中'
  return '强'
})

const handleSubmit = () => {
  formRef.value?.validate(async (valid) => {
    if (!valid) return

    loading.value = true
    try {
      await api.changePassword({
        old_password: form.oldPassword,
        new_password: form.newPassword
      })

      ElMessage.success({
        message: '密码修改成功，请重新登录',
        duration: 2000
      })

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
  strengthScore.value = 0
  formRef.value?.clearValidate()
}
</script>

<style scoped>
.change-password-wrapper {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 20px;
  display: flex;
  justify-content: center;
  position: relative;
}

.background-shapes .shape {
  position: fixed;
  filter: blur(100px);
  z-index: -1;
  opacity: 0.4;
}

.shape-1 {
  top: 20%;
  left: 10%;
  width: 400px;
  height: 400px;
  background: var(--primary-color);
  animation: float 8s ease-in-out infinite;
}

.shape-2 {
  bottom: 20%;
  right: 10%;
  width: 300px;
  height: 300px;
  background: var(--secondary-color);
  animation: float 10s ease-in-out infinite reverse;
}

@keyframes float {

  0%,
  100% {
    transform: translate(0, 0);
  }

  50% {
    transform: translate(20px, -20px);
  }
}

.change-password-card {
  width: 100%;
  max-width: 500px;
  border-radius: 24px;
  border: 1px solid var(--glass-border);
  background: rgba(30, 41, 59, 0.7);
  backdrop-filter: blur(20px);
  box-shadow: var(--shadow-lg);
}

.change-password-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 10px;
}

.header-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(139, 92, 246, 0.1));
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-color);
  font-size: 24px;
  border: 1px solid var(--glass-border);
}

.change-password-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 4px 0;
  background: linear-gradient(to right, #fff, #94a3b8);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.change-password-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

.password-form {
  margin-top: 20px;
}

:deep(.el-form-item__label) {
  color: var(--text-primary);
  font-weight: 500;
}

:deep(.el-input__wrapper) {
  background-color: rgba(15, 23, 42, 0.6);
  border: 1px solid var(--border-color);
  box-shadow: none !important;
  padding: 8px 12px;
  border-radius: 12px;
  transition: all 0.3s ease;
}

:deep(.el-input__wrapper.is-focus) {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 1px var(--primary-color) !important;
  background-color: rgba(15, 23, 42, 0.8);
}

:deep(.el-input__inner) {
  color: var(--text-primary);
}

.password-strength {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.strength-bar {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  transition: all 0.3s ease;
  border-radius: 2px;
}

.strength-fill.weak {
  background-color: var(--accent-danger);
}

.strength-fill.medium {
  background-color: var(--accent-warning);
}

.strength-fill.strong {
  background-color: var(--accent-success);
}

.strength-text {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 20px;
}

.form-actions {
  margin-top: 32px;
  margin-bottom: 0;
}

.submit-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  border-radius: 12px;
  margin-bottom: 12px;
}

.reset-btn {
  width: 100%;
  height: 44px;
  border-radius: 12px;
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  margin-left: 0 !important;
}

.reset-btn:hover {
  color: var(--text-primary);
  border-color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.05);
}
</style>
