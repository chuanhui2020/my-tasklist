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
  routes
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

export default router
