<template>
  <div id="app">
    <el-container class="app-container">
      <el-header class="app-header">
        <div class="brand" @click="goHome">任务日程中心</div>
        <div v-if="isAuthenticated" class="nav-area">
          <el-menu :default-active="activeIndex" mode="horizontal" class="nav-menu">
            <el-menu-item index="/">首页</el-menu-item>
            <el-menu-item index="/tasks">任务列表</el-menu-item>
            <el-menu-item v-if="isAdmin" index="/admin/users">用户管理</el-menu-item>
          </el-menu>
          <div class="user-box">
            <span class="user-name">{{ authState.user?.username }}</span>
            <el-button type="primary" plain size="small" @click="handleLogout">退出登录</el-button>
          </div>
        </div>
        <div v-else class="nav-area">
          <el-button type="primary" size="small" @click="goLogin">登录</el-button>
        </div>
      </el-header>
      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const route = useRoute()
const { state: authState, isAuthenticated, isAdmin, clearAuth } = useAuth()

const activeIndex = computed(() => route.path)

const goHome = () => {
  if (isAuthenticated.value) {
    router.push('/')
  } else {
    router.push('/login')
  }
}

const goLogin = () => {
  router.push({ path: '/login', query: { redirect: route.fullPath } })
}

const handleLogout = () => {
  clearAuth()
  router.replace({ path: '/login', query: { redirect: '/' } })
}
</script>

<style scoped>
.app-container {
  min-height: 100vh;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(120deg, #409eff 0%, #66b1ff 100%);
  color: #fff;
  padding: 0 32px;
}

.brand {
  font-size: 20px;
  font-weight: 600;
  cursor: pointer;
}

.nav-area {
  display: flex;
  align-items: center;
  gap: 16px;
}

.nav-menu {
  background: transparent;
  border-bottom: none;
}

.nav-menu :deep(.el-menu-item) {
  color: #fff;
}

.nav-menu :deep(.el-menu-item.is-active) {
  background-color: rgba(255, 255, 255, 0.2);
}

.user-box {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #fff;
}

.user-name {
  font-weight: 500;
}

.app-main {
  background-color: #f5f7fa;
  min-height: calc(100vh - 64px);
  padding: 0;
}
</style>
