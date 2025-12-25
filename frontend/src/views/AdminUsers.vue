<template>
  <div class="admin-wrapper">
    <div class="background-shapes">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
    </div>

    <el-card class="admin-card" shadow="hover" :body-style="{ padding: '32px' }">
      <template #header>
        <div class="admin-header">
          <div class="header-icon">
            <el-icon>
              <UserFilled />
            </el-icon>
          </div>
          <div>
            <div class="admin-title">创建新用户</div>
            <div class="admin-subtitle">管理员可在此添加普通或管理员账号</div>
          </div>
        </div>
      </template>

      <el-form
        :model="form"
        :rules="rules"
        ref="formRef"
        label-position="top"
        size="large"
        class="admin-form"
      >
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" prefix-icon="User" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" placeholder="请输入密码" show-password prefix-icon="Lock" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" style="width: 100%;">
            <el-option label="普通用户" value="user" />
            <el-option label="管理员" value="admin" />
          </el-select>
        </el-form-item>
        <el-form-item class="form-actions">
          <el-button type="primary" :loading="loading" class="submit-btn" @click="handleSubmit">创建用户</el-button>
          <el-button class="reset-btn" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { UserFilled } from '@element-plus/icons-vue'
import api from '@/api'

const formRef = ref(null)
const loading = ref(false)

const form = reactive({
  username: '',
  password: '',
  role: 'user'
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const handleSubmit = () => {
  formRef.value?.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      await api.createUser(form)
      ElMessage.success('用户创建成功')
      handleReset()
    } catch (error) {
      // 错误提示由拦截器处理
    } finally {
      loading.value = false
    }
  })
}

const handleReset = () => {
  form.username = ''
  form.password = ''
  form.role = 'user'
  formRef.value?.clearValidate()
}
</script>

<style scoped>
.admin-wrapper {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 24px 60px;
  position: relative;
}

.background-shapes .shape {
  position: fixed;
  filter: blur(100px);
  z-index: 0;
  opacity: 0.35;
  pointer-events: none;
}

.shape-1 {
  top: 20%;
  left: 8%;
  width: 360px;
  height: 360px;
  background: var(--primary-color);
  animation: float 8s ease-in-out infinite;
}

.shape-2 {
  bottom: 18%;
  right: 10%;
  width: 280px;
  height: 280px;
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

.admin-card {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  border-radius: 24px;
  border: 1px solid var(--glass-border);
  background: rgba(30, 41, 59, 0.7);
  backdrop-filter: blur(20px);
  box-shadow: var(--shadow-lg);
  position: relative;
  z-index: 1;
  overflow: hidden;
}

.admin-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--glass-highlight), transparent);
}

.admin-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 4px;
}

.header-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(139, 92, 246, 0.15));
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-color);
  font-size: 24px;
  border: 1px solid var(--glass-border);
}

.admin-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(to right, #fff, #94a3b8);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.admin-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.admin-form {
  margin-top: 16px;
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

.form-actions {
  margin-top: 20px;
  margin-bottom: 0;
  display: flex;
  gap: 12px;
}

.submit-btn,
.reset-btn {
  flex: 1;
  height: 44px;
  border-radius: 12px;
  font-size: 15px;
}

.reset-btn {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.reset-btn:hover {
  color: var(--text-primary);
  border-color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.05);
}

@media (max-width: 720px) {
  .admin-wrapper {
    padding: 24px 16px 40px;
  }

  .form-actions {
    flex-direction: column;
  }
}
</style>
