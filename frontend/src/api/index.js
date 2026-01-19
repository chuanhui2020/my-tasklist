import axios from 'axios'
import { ElMessage } from 'element-plus'

const TOKEN_KEY = 'tasklist_token'
const USER_KEY = 'tasklist_user'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000  // 增加到 60 秒，因为 AI 生成需要时间
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  response => response,
  error => {
    const status = error.response?.status
    const requestUrl = error.config?.url || ''
    const message = error.response?.data?.error

    if (status === 401) {
      if (requestUrl.includes('/auth/login')) {
        ElMessage.error(message || '用户名或密码错误')
      } else {
        authStorage.clear()
        if (window.location.pathname !== '/login') {
          window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`
        }
        ElMessage.error('登录状态已失效，请重新登录')
      }
    } else {
      ElMessage.error(message || '请求失败')
    }
    return Promise.reject(error)
  }
)

export const authStorage = {
  save(token, user) {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  },
  getToken() {
    return localStorage.getItem(TOKEN_KEY)
  },
  getUser() {
    const stored = localStorage.getItem(USER_KEY)
    return stored ? JSON.parse(stored) : null
  }
}

export default {
  login(credentials) {
    return api.post('/auth/login', credentials)
  },

  getProfile() {
    return api.get('/auth/me')
  },

  createUser(data) {
    return api.post('/auth/users', data)
  },

  changePassword(data) {
    return api.post('/auth/change-password', data)
  },

  getTasks(params = {}) {
    return api.get('/tasks', { params })
  },

  getTask(id) {
    return api.get(`/tasks/${id}`)
  },

  createTask(data) {
    return api.post('/tasks', data)
  },

  updateTask(id, data) {
    return api.put(`/tasks/${id}`, data)
  },

  updateTaskStatus(id, status) {
    return api.patch(`/tasks/${id}/status`, { status })
  },

  deleteTask(id) {
    return api.delete(`/tasks/${id}`)
  },

  generateFortune(fortuneNumber) {
    return api.post('/fortune/generate', { fortuneNumber })
  },

  generateBmiAdvice(payload) {
    return api.post('/bmi/advice', payload)
  }
}
