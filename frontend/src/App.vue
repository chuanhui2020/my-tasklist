<template>
  <div id="app">
    <div class="background-glow"></div>
    <el-container class="app-container">
      <el-header class="app-header">
        <div class="brand" @click="goHome">
          <span class="brand-icon">⚡</span>
          任务日程中心
        </div>
        <div v-if="isAuthenticated" class="nav-area">
          <nav class="custom-nav">
            <router-link to="/" class="nav-link" active-class="active">首页</router-link>
            <router-link to="/tasks" class="nav-link" active-class="active">任务列表</router-link>
            <router-link v-if="isAdmin" to="/admin/users" class="nav-link" active-class="active">用户管理</router-link>
          </nav>
          <div class="user-box">
            <span class="user-name">{{ authState.user?.username }}</span>
            <el-button type="primary" plain size="small" class="logout-btn" @click="handleLogout">退出</el-button>
          </div>
        </div>
        <div v-else class="nav-area">
          <el-button type="primary" size="small" @click="goLogin">登录</el-button>
        </div>
      </el-header>
      <el-main class="app-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
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
  position: relative;
  z-index: 1;
}

.background-glow {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: radial-gradient(circle at 50% 0%, rgba(6, 182, 212, 0.15), transparent 50%),
              radial-gradient(circle at 0% 100%, rgba(139, 92, 246, 0.1), transparent 50%);
  z-index: 0;
  pointer-events: none;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--glass-border);
  padding: 0 32px;
  height: 64px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.brand {
  font-size: 20px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(to right, #fff, #94a3b8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -0.5px;
}

.brand-icon {
  -webkit-text-fill-color: initial;
  font-size: 24px;
}

.nav-area {
  display: flex;
  align-items: center;
  gap: 24px;
}

.custom-nav {
  display: flex;
  gap: 4px;
  background: rgba(255, 255, 255, 0.03);
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--glass-border);
}

.nav-link {
  text-decoration: none;
  color: var(--text-secondary);
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.nav-link:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.05);
}

.nav-link.active {
  color: #fff;
  background: var(--primary-color);
  box-shadow: 0 0 15px rgba(6, 182, 212, 0.4);
}

.user-box {
  display: flex;
  align-items: center;
  gap: 16px;
  color: var(--text-primary);
  padding-left: 24px;
  border-left: 1px solid var(--glass-border);
}

.user-name {
  font-weight: 600;
  font-size: 14px;
}

.logout-btn {
  background: transparent !important;
  border: 1px solid var(--glass-border) !important;
  color: var(--text-secondary) !important;
}

.logout-btn:hover {
  border-color: var(--text-secondary) !important;
  color: var(--text-primary) !important;
}

.app-main {
  padding: 24px;
  overflow-x: hidden;
}

/* Page Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
