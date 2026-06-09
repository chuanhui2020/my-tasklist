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
            <el-dropdown trigger="click" class="user-dropdown" popper-class="user-dropdown-menu" @command="handleUserCommand">
              <button class="user-trigger" aria-label="用户菜单">
                <span class="user-avatar"><el-icon><UserFilled /></el-icon></span>
                <span class="user-name">{{ authState.user?.username }}</span>
                <el-icon class="user-caret"><ArrowDown /></el-icon>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="change-password">
                    <el-icon><Lock /></el-icon>修改密码
                  </el-dropdown-item>
                  <el-dropdown-item command="logout" divided class="logout-item">
                    <el-icon><SwitchButton /></el-icon>退出登录
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
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
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useCountdownAlert } from '@/composables/useCountdownAlert'
import CountdownOverlay from '@/components/CountdownOverlay.vue'
import { Promotion, List, AlarmClock, Lock, MagicStick, DataLine, Key, UserFilled, Dish, Wallet, ArrowDown, SwitchButton } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const { state: authState, isAuthenticated, isAdmin, clearAuth } = useAuth()
const { alerts: countdownAlerts, dismiss: dismissCountdown, start: startCountdownPoll, stop: stopCountdownPoll } = useCountdownAlert()

const mobileMenuOpen = ref(false)

const navLinks = [
  { to: '/tasks', label: '任务列表', icon: List },
  { to: '/countdown', label: '疯狂倒计时', icon: AlarmClock },
  { to: '/fortune', label: '灵签占卜', icon: MagicStick },
  { to: '/bmi', label: 'BMI管理', icon: DataLine },
  { to: '/secure-notes', label: '密钥盒子', icon: Key },
]

const adminLinks = [
  { to: '/admin/users', label: '用户管理', icon: UserFilled },
  { to: '/admin/menu', label: '菜单管理', icon: Dish },
  { to: '/admin/finance', label: '财务管理', icon: Wallet },
]

const routeOrder = ['/tasks', '/countdown', '/fortune', '/bmi', '/secure-notes', '/admin/users', '/admin/menu', '/admin/finance']
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

const handleUserCommand = (command) => {
  if (command === 'change-password') {
    router.push('/change-password')
  } else if (command === 'logout') {
    clearAuth()
    router.replace({ path: '/login', query: { redirect: '/' } })
  }
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

.user-dropdown {
  padding-left: 24px;
  border-left: 1px solid var(--glass-border);
}

.user-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
  outline: none;
}

.user-trigger:hover,
.user-trigger:focus-visible {
  background: rgba(6, 182, 212, 0.1);
  border-color: var(--primary-color);
}

.user-trigger:focus-visible {
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.4);
}

.user-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color, #8b5cf6));
  color: #fff;
  font-size: 13px;
  flex-shrink: 0;
}

.user-name {
  font-weight: 600;
  font-size: 14px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-caret {
  font-size: 12px;
  color: var(--text-muted);
  transition: transform 0.2s ease;
}

.user-dropdown.is-opened .user-caret,
.user-trigger[aria-expanded="true"] .user-caret {
  transform: rotate(180deg);
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

  .user-trigger {
    padding: 6px 8px;
  }

  .user-name {
    display: none;
  }

  .user-caret {
    display: none;
  }

  .app-main {
    padding: 16px;
  }
}
</style>

<!-- 用户下拉菜单：el-dropdown 通过 teleport 挂到 body，需用非 scoped 样式 + popper-class 命中 -->
<style>
.user-dropdown-menu.el-popper {
  background: rgba(15, 23, 42, 0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  padding: 6px;
}

.user-dropdown-menu.el-popper .el-popper__arrow::before {
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
}

.user-dropdown-menu .el-dropdown-menu {
  background: transparent;
  padding: 0;
}

.user-dropdown-menu .el-dropdown-menu__item {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-secondary, #94a3b8);
  font-size: 14px;
  padding: 10px 16px;
  border-radius: 8px;
  margin: 2px 0;
  transition: background 0.18s ease, color 0.18s ease;
}

.user-dropdown-menu .el-dropdown-menu__item .el-icon {
  font-size: 16px;
}

.user-dropdown-menu .el-dropdown-menu__item:not(.is-disabled):hover,
.user-dropdown-menu .el-dropdown-menu__item:not(.is-disabled):focus {
  background: rgba(6, 182, 212, 0.12);
  color: var(--primary-color, #06b6d4);
}

.user-dropdown-menu .el-dropdown-menu__item--divided {
  border-top: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
  margin-top: 4px;
  padding-top: 12px;
}

.user-dropdown-menu .el-dropdown-menu__item--divided::before {
  display: none;
}

/* 退出登录用语义化危险色 */
.user-dropdown-menu .el-dropdown-menu__item.logout-item:not(.is-disabled):hover,
.user-dropdown-menu .el-dropdown-menu__item.logout-item:not(.is-disabled):focus {
  background: rgba(220, 38, 38, 0.14);
  color: #f87171;
}

@media (prefers-reduced-motion: reduce) {
  .user-dropdown-menu .el-dropdown-menu__item {
    transition: none;
  }
}
</style>
