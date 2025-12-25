import { createRouter, createWebHistory } from 'vue-router'

import TaskList from './views/TaskList.vue'
import Login from './views/Login.vue'
import AdminUsers from './views/AdminUsers.vue'
import ChangePassword from './views/ChangePassword.vue'
import Fortune from './views/Fortune.vue'
import BmiManager from './views/BmiManager.vue'

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
    component: TaskList,
    meta: { requiresAuth: true }
  },
  {
    path: '/admin/users',
    name: 'AdminUsers',
    component: AdminUsers,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/fortune',
    name: 'Fortune',
    component: Fortune,
    meta: { requiresAuth: true }
  },
  {
    path: '/bmi',
    name: 'BmiManager',
    component: BmiManager,
    meta: { requiresAuth: true }
  },
  {
    path: '/change-password',
    name: 'ChangePassword',
    component: ChangePassword,
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
