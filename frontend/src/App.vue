  <template>
    <div id="app">
      <a href="#main-content" class="skip-link">跳到主内容</a>
      <div class="background-glow"></div>
      <el-container class="app-container">
        <el-header class="app-header">
          <div class="brand" @click="goHome">
            <el-icon class="brand-icon"><Promotion /></el-icon>
            任务日程中心
          </div>
          <div v-if="isAuthenticated" class="nav-area">
            <nav class="custom-nav" :class="{ open: mobileMenuOpen }">
              <router-link v-for="link in navLinks" :key="link.to" :to="link.to" class="nav-link" active-class="active" @click="mobileMenuOpen = false">
                <el-icon class="nav-icon"><component :is="link.icon" /></el-icon>{{ link.label }}
              </router-link>
              <template v-if="isAdmin">
                <span class="nav-divider"></span>
                <router-link v-for="link in adminLinks" :key="link.to" :to="link.to" class="nav-link admin-link" active-class="active" @click="mobileMenuOpen = false">
                  <el-icon class="nav-icon"><component :is="link.icon" /></el-icon>{{ link.label }}
                </router-link>
              </template>
            </nav>
            <button class="hamburger" :class="{ open: mobileMenuOpen }" @click="mobileMenuOpen = !mobileMenuOpen" aria-label="菜单">
              <span></span><span></span><span></span>
            </button>
            <div v-if="mobileMenuOpen" class="mobile-backdrop" @click="mobileMenuOpen = false"></div>
            <div class="user-box">
              <span class="user-name">{{ authState.user?.username }}</span>
              <el-button type="primary" plain size="small" class="logout-btn" @click="handleLogout">退出</el-button>
            </div>
          </div>
          <div v-else class="nav-area">
            <el-button type="primary" size="small" @click="goLogin">登录</el-button>
          </div>
        </el-header>
        <el-main id="main-content" class="app-main">
          <router-view v-slot="{ Component, route }">
            <div class="route-stage">
              <transition :name="transitionName">
                <component :is="Component" :key="route.fullPath" class="route-page" />
              </transition>
            </div>
          </router-view>
        </el-main>
      </el-container>
    </div>
    <CountdownOverlay v-if="isAuthenticated" :alerts="countdownAlerts" @dismiss="dismissCountdown" />
  </template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useCountdownAlert } from '@/composables/useCountdownAlert'
import CountdownOverlay from '@/components/CountdownOverlay.vue'
import { Promotion, List, AlarmClock, Lock, MagicStick, DataLine, Key, UserFilled, Dish } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const { state: authState, isAuthenticated, isAdmin, clearAuth } = useAuth()
const { alerts: countdownAlerts, dismiss: dismissCountdown, start: startCountdownPoll, stop: stopCountdownPoll } = useCountdownAlert()

const mobileMenuOpen = ref(false)

const navLinks = [
  { to: '/tasks', label: '任务列表', icon: List },
  { to: '/countdown', label: '疯狂倒计时', icon: AlarmClock },
  { to: '/change-password', label: '修改密码', icon: Lock },
  { to: '/fortune', label: '灵签占卜', icon: MagicStick },
  { to: '/bmi', label: 'BMI管理', icon: DataLine },
  { to: '/secure-notes', label: '密钥盒子', icon: Key },
]

const adminLinks = [
  { to: '/admin/users', label: '用户管理', icon: UserFilled },
  { to: '/admin/menu', label: '菜单管理', icon: Dish },
]

const routeOrder = ['/tasks', '/countdown', '/change-password', '/fortune', '/bmi', '/secure-notes', '/admin/users', '/admin/menu']
const transitionName = ref('fade')

router.afterEach((to, from) => {
  if (!from.name) {
    transitionName.value = 'fade'
    return
  }
  const toIdx = routeOrder.indexOf(to.path)
  const fromIdx = routeOrder.indexOf(from.path)
  if (toIdx === -1 || fromIdx === -1) {
    transitionName.value = 'fade'
  } else {
    transitionName.value = toIdx > fromIdx ? 'slide-left' : 'slide-right'
  }
})

watch(isAuthenticated, (val) => {
  if (val) startCountdownPoll()
  else stopCountdownPoll()
}, { immediate: true })

watch(() => route.path, () => {
  mobileMenuOpen.value = false
})

const goHome = () => {
  if (isAuthenticated.value) {
    router.push('/tasks')
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
#app {
  min-height: 100vh;
  position: relative;
  background: var(--bg-primary);
}

.skip-link {
  position: absolute;
  top: -100px;
  left: 16px;
  background: var(--primary-color);
  color: #fff;
  padding: 8px 16px;
  border-radius: 0 0 8px 8px;
  z-index: 9999;
  font-size: 14px;
  text-decoration: none;
  transition: top 0.2s;
}

.skip-link:focus {
  top: 0;
}

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
  background: linear-gradient(to right, #fff, #a8b8cc);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -0.5px;
  flex-shrink: 0;
}

.brand-icon {
  -webkit-text-fill-color: initial;
  color: var(--primary-color);
  font-size: 22px;
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
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
}

.nav-icon {
  font-size: 15px;
  flex-shrink: 0;
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

.nav-link.active::after {
  content: '';
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 2px;
  background: var(--primary-color);
  border-radius: 1px;
  box-shadow: 0 0 6px rgba(6, 182, 212, 0.6);
}

.nav-divider {
  width: 1px;
  height: 20px;
  background: var(--glass-border);
  margin: 0 2px;
  flex-shrink: 0;
}

.admin-link {
  display: flex;
  align-items: center;
  gap: 3px;
}

.admin-icon {
  font-size: 12px;
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

/* Hamburger button */
.hamburger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 36px;
  height: 36px;
  padding: 6px;
  background: none;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  cursor: pointer;
  z-index: 201;
}

.hamburger span {
  display: block;
  width: 100%;
  height: 2px;
  background: var(--text-secondary);
  border-radius: 1px;
  transition: all 0.25s ease;
}

.hamburger.open span:nth-child(1) {
  transform: rotate(45deg) translate(5px, 5px);
}

.hamburger.open span:nth-child(2) {
  opacity: 0;
}

.hamburger.open span:nth-child(3) {
  transform: rotate(-45deg) translate(5px, -5px);
}

.mobile-backdrop {
  display: none;
}

.app-main {
  padding: 24px;
  overflow-x: hidden;
  position: relative;
}

.route-stage {
  position: relative;
  min-height: calc(100vh - 112px);
}

.route-page {
  position: relative;
  z-index: 1;
}

/* Page Transitions - Fade */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}

.fade-leave-active {
  position: absolute;
  inset: 0;
  width: 100%;
  pointer-events: none;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Page Transitions - Slide Left (forward) */
.slide-left-enter-active,
.slide-left-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.slide-left-leave-active {
  position: absolute;
  inset: 0;
  width: 100%;
  pointer-events: none;
}

.slide-left-enter-from {
  transform: translateX(40px);
  opacity: 0;
}

.slide-left-leave-to {
  transform: translateX(-40px);
  opacity: 0;
}

/* Page Transitions - Slide Right (backward) */
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.slide-right-leave-active {
  position: absolute;
  inset: 0;
  width: 100%;
  pointer-events: none;
}

.slide-right-enter-from {
  transform: translateX(-40px);
  opacity: 0;
}

.slide-right-leave-to {
  transform: translateX(40px);
  opacity: 0;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .app-header {
    padding: 0 16px;
  }

  .hamburger {
    display: flex;
  }

  .custom-nav {
    position: fixed;
    top: 64px;
    right: 0;
    bottom: 0;
    width: 260px;
    flex-direction: column;
    background: rgba(15, 23, 42, 0.97);
    backdrop-filter: blur(20px);
    border-left: 1px solid var(--glass-border);
    border-radius: 0;
    border-top: none;
    padding: 16px 12px;
    gap: 4px;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    z-index: 200;
    overflow-y: auto;
  }

  .custom-nav.open {
    transform: translateX(0);
  }

  .mobile-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    top: 64px;
    background: rgba(0, 0, 0, 0.5);
    z-index: 199;
  }

  .nav-link {
    padding: 12px 16px;
    border-radius: 10px;
    font-size: 15px;
  }

  .nav-link.active::after {
    display: none;
  }

  .nav-divider {
    width: 100%;
    height: 1px;
    margin: 8px 0;
  }

  .user-box {
    padding-left: 0;
    border-left: none;
    gap: 12px;
  }

  .user-name {
    display: none;
  }

  .app-main {
    padding: 16px;
  }
}
</style>
