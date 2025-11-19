<template>
  <div class="login-wrapper">
    <el-card class="login-card" shadow="hover">
      <div class="login-header">
        <h2>登录任务系统</h2>
        <p>请输入账号密码继续</p>
      </div>

      <el-form :model="form" :rules="rules" ref="formRef" label-width="0">
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            prefix-icon="User"
            placeholder="用户名"
            clearable
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            prefix-icon="Lock"
            placeholder="密码"
            show-password
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" class="login-button" @click="handleSubmit">
            登录
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import api from '@/api'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const route = useRoute()
const { setAuth } = useAuth()

const formRef = ref(null)
const loading = ref(false)

const form = reactive({
  username: '',
  password: ''
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
      const { data } = await api.login(form)
      setAuth(data.token, data.user)
      ElMessage.success('登录成功')
      const redirect = route.query.redirect || '/'
      router.replace(redirect)
    } catch (error) {
      // 错误处理交给拦截器
    } finally {
      loading.value = false
    }
  })
}
</script>

<style scoped>
.login-wrapper {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #e0f7fa 0%, #ffe0b2 50%, #fff3e0 100%);
  padding: 40px 20px;
}

.login-card {
  width: 360px;
  border-radius: 18px;
  padding: 24px;
}

.login-header {
  text-align: center;
  margin-bottom: 24px;
}

.login-header h2 {
  margin: 0;
  font-size: 22px;
  color: #1f1f1f;
}

.login-header p {
  margin: 8px 0 0;
  color: #8c8c8c;
  font-size: 13px;
}

.login-button {
  width: 100%;
}
</style>
