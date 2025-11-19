<template>
  <div class="admin-wrapper">
    <el-card class="admin-card" shadow="hover">
      <template #header>
        <div class="admin-header">
          <div>
            <div class="admin-title">创建新用户</div>
            <div class="admin-subtitle">管理员可在此添加普通或管理员账号</div>
          </div>
        </div>
      </template>

      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" placeholder="请输入密码" show-password />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" style="width: 160px;">
            <el-option label="普通用户" value="user" />
            <el-option label="管理员" value="admin" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleSubmit">创建用户</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
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
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 20px;
}

.admin-card {
  border-radius: 20px;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.admin-title {
  font-size: 20px;
  font-weight: 600;
}

.admin-subtitle {
  font-size: 13px;
  color: #8c8c8c;
  margin-top: 4px;
}
</style>
