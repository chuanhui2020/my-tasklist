import { createRouter, createWebHistory } from 'vue-router'

import Login from './views/Login.vue'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/',
    redirect: '/tasks'
  },
  {
    path: '/tasks',
    name: 'TaskList',
    component: () => import('./views/TaskList.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/countdown',
    name: 'CrazyCountdown',
    component: () => import('./views/CrazyCountdown.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/admin/users',
    name: 'AdminUsers',
    component: () => import('./views/AdminUsers.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/admin/menu',
    name: 'MenuManager',
    component: () => import('./views/MenuManager.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/fortune',
    name: 'Fortune',
    component: () => import('./views/Fortune.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/bmi',
    name: 'BmiManager',
    component: () => import('./views/BmiManager.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/notes',
    name: 'Notes',
    component: () => import('./views/Notes.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/secure-notes',
    name: 'SecureNotes',
    component: () => import('./views/SecureNotes.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/change-password',
    name: 'ChangePassword',
    component: () => import('./views/ChangePassword.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0 }
  }
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('tasklist_token')
  if (to.meta.requiresAuth && !token) {
    return next({ path: '/login', query: { redirect: to.fullPath } })
  }
  if (to.meta.requiresAdmin) {
    const stored = localStorage.getItem('tasklist_user')
    const user = stored ? JSON.parse(stored) : null
    if (!user || user.role !== 'admin') {
      return next('/')
    }
  }
  return next()
})

// 前端重新部署后，已打开的旧页面引用的按需加载文件（文件名带 hash）已不存在；
// 线上 SPA 回退会把缺失的 .js 返回成 index.html（200 + text/html），动态 import 失败、
// 路由跳转被静默中止——表现为「点了没反应」。捕获这类加载失败，整页跳转到目标地址加载新版本。
// 同一目标 10 秒内只自动重载一次：新版本也加载失败时不陷入刷新死循环。
const CHUNK_LOAD_ERROR = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i

router.onError((error, to) => {
  if (!CHUNK_LOAD_ERROR.test(String(error?.message || error))) return
  const key = `chunk-reload:${to.fullPath}`
  const last = Number(sessionStorage.getItem(key) || 0)
  if (Date.now() - last < 10000) return
  sessionStorage.setItem(key, String(Date.now()))
  window.location.assign(to.fullPath)
})

export default router
