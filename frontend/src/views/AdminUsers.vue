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
            <div class="admin-title">用户管理</div>
            <div class="admin-subtitle">管理员可在此添加和管理账号</div>
          </div>
        </div>
      </template>

      <!-- 用户列表 -->
      <div class="user-list-section">
        <div class="section-title">
          <el-icon class="section-icon"><UserFilled /></el-icon>
          <span>现有用户</span>
          <span class="user-count">{{ users.length }} 人</span>
        </div>
        <div v-if="listLoading" class="user-list-skeleton">
          <div v-for="i in 3" :key="i" class="skeleton skeleton-row"></div>
        </div>
        <div v-else class="user-list">
          <div v-for="u in users" :key="u.id" class="user-item">
            <div class="user-avatar" :class="u.role">
              {{ u.username.charAt(0).toUpperCase() }}
            </div>
            <div class="user-info">
              <span class="user-name">{{ u.username }}</span>
              <span class="user-role-tag" :class="u.role">{{ u.role === 'admin' ? '管理员' : '普通用户' }}</span>
              <span class="user-login-time">最近登录: {{ formatTime(u.last_login_at) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 分割线 -->
      <div class="section-divider"></div>

      <!-- 创建用户表单 -->
      <div class="section-title">
        <el-icon class="section-icon"><Plus /></el-icon>
        <span>创建新用户</span>
      </div>

      <el-form
        :model="form"
        :rules="rules"
        ref="formRef"
        label-position="top"
        size="large"
        class="admin-form"
        autocomplete="off"
      >
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" :prefix-icon="User" autocomplete="new-username" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" placeholder="请输入密码" show-password :prefix-icon="Lock" autocomplete="new-password" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" style="width: 100%;" popper-class="dark-select-dropdown">
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
import { reactive, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { UserFilled, User, Lock, Plus } from '@element-plus/icons-vue'
import api from '@/api'

const formRef = ref(null)
const loading = ref(false)
const users = ref([])
const listLoading = ref(false)

const form = reactive({
  username: '',
  password: '',
  role: 'user'
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const loadUsers = async () => {
  listLoading.value = true
  try {
    const res = await api.getUsers()
    users.value = res.data.users || []
  } catch (e) {
    console.error('加载用户列表失败:', e)
  } finally {
    listLoading.value = false
  }
}

onMounted(loadUsers)

const handleSubmit = () => {
  formRef.value?.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      await api.createUser(form)
      ElMessage.success('用户创建成功')
      handleReset()
      loadUsers()
    } catch (_error) {
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

const formatTime = (t) => {
  if (!t) return '未知'
  const d = new Date(t + 'Z')
  if (isNaN(d.getTime())) return '未知'
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
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
  background: linear-gradient(to right, #fff, var(--text-secondary));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.admin-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

/* 用户列表 */
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.section-icon {
  font-size: 18px;
}

.user-count {
  font-size: 12px;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 10px;
  border-radius: 10px;
  margin-left: 4px;
}

.list-loading {
  text-align: center;
  color: var(--text-secondary);
  padding: 20px;
}

.user-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  transition: all 0.2s ease;
  min-width: 180px;
}

.user-item:hover {
  border-color: var(--primary-color);
  background: rgba(6, 182, 212, 0.05);
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 15px;
  color: #fff;
  flex-shrink: 0;
}

.user-avatar.admin {
  background: linear-gradient(135deg, #f59e0b, #ef4444);
}

.user-avatar.user {
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.user-role-tag {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 6px;
  width: fit-content;
}

.user-role-tag.admin {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.user-role-tag.user {
  background: rgba(6, 182, 212, 0.15);
  color: var(--primary-color);
}

.user-login-time {
  font-size: 11px;
  color: var(--text-secondary);
}

.section-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--glass-border), transparent);
  margin: 24px 0;
}

.user-list-skeleton {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 表单 */
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

:deep(.el-select__wrapper) {
  background-color: rgba(15, 23, 42, 0.6) !important;
  border: 1px solid var(--border-color) !important;
  box-shadow: none !important;
  border-radius: 12px !important;
  padding: 4px 12px;
  transition: all 0.3s ease;
}

:deep(.el-select__wrapper.is-focused) {
  border-color: var(--primary-color) !important;
  box-shadow: 0 0 0 1px var(--primary-color) !important;
  background-color: rgba(15, 23, 42, 0.8) !important;
}

:deep(.el-select__selected-item) {
  color: var(--text-primary) !important;
}

:deep(.el-select__placeholder) {
  color: var(--text-secondary) !important;
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

  .user-list {
    flex-direction: column;
  }

  .user-item {
    min-width: unset;
  }
}
</style>

<style>
/* 全局样式：下拉菜单暗色主题 */
.dark-select-dropdown {
  background: rgba(30, 41, 59, 0.95) !important;
  backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border) !important;
  border-radius: 12px !important;
}

.dark-select-dropdown .el-select-dropdown__item {
  color: var(--text-secondary) !important;
}

.dark-select-dropdown .el-select-dropdown__item.is-hovering {
  background: rgba(6, 182, 212, 0.1) !important;
  color: var(--text-primary) !important;
}

.dark-select-dropdown .el-select-dropdown__item.is-selected {
  color: var(--primary-color) !important;
  font-weight: 600;
}
</style>
