import axios from 'axios'
import { ElMessage } from 'element-plus'

const TOKEN_KEY = 'tasklist_token'
const USER_KEY = 'tasklist_user'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
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
    if (axios.isCancel(error) || error?.code === 'ERR_CANCELED') {
      return Promise.reject(error)
    }
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
    } else if (status === 429) {
      // Let the caller handle rate limiting (e.g. fortune daily limit)
    } else if (!error.config?._silent) {
      const detail = error.response?.data?.detail
      const msg = message || '请求失败'
      ElMessage.error(detail ? `${msg}: ${detail}` : msg)
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

  getUsers() {
    return api.get('/auth/users')
  },

  createUser(data) {
    return api.post('/auth/users', data)
  },

  changePassword(data) {
    return api.post('/auth/change-password', data)
  },

  resetUserPassword(id) {
    return api.put(`/auth/users/${id}/reset-password`)
  },

  getTasks(params = {}, { signal } = {}) {
    return api.get('/tasks', { params, signal })
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

  uploadTaskImages(taskId, files) {
    const formData = new FormData()
    files.forEach(file => formData.append('images', file))
    return api.post(`/tasks/${taskId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  deleteTaskImage(taskId, imageId) {
    return api.delete(`/tasks/${taskId}/images/${imageId}`)
  },

  getTaskImageUrl(taskId, imageId) {
    const token = localStorage.getItem(TOKEN_KEY)
    const baseURL = api.defaults.baseURL
    return `${baseURL}/tasks/${taskId}/images/${imageId}/file?token=${token}`
  },

  generateFortune(fortuneNumber) {
    return api.post('/fortune/generate', { fortuneNumber })
  },

  getTodayFortune() {
    return api.get('/fortune/today')
  },

  getFortuneHistory() {
    return api.get('/fortune/history')
  },

  generateBmiAdvice(payload) {
    return api.post('/bmi/advice', payload)
  },

  getBmiProfile() {
    return api.get('/bmi/profile')
  },

  saveBmiProfile(data) {
    return api.put('/bmi/profile', data)
  },

  recordWeight(data) {
    return api.post('/bmi/weight', data)
  },

  getTodayWeight() {
    return api.get('/bmi/weight/today')
  },

  getWeightHistory(days = 90) {
    return api.get('/bmi/weight/history', { params: { days } })
  },

  analyzeWeight() {
    return api.post('/bmi/weight/analysis')
  },

  getTodayMenu() {
    return api.get('/menu/today')
  },

  getMenuList() {
    return api.get('/menu/list')
  },

  uploadWeeklyMenu(file, weekStart = '') {
    const formData = new FormData()
    formData.append('image', file)
    if (weekStart) {
      formData.append('week_start', weekStart)
    }
    return api.post('/menu/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  getSecureNotes() {
    return api.get('/secure-notes')
  },

  createSecureNote(data) {
    return api.post('/secure-notes', data)
  },

  unlockSecureNote(id, password) {
    return api.post(`/secure-notes/${id}/unlock`, { password })
  },

  updateSecureNote(id, data) {
    return api.put(`/secure-notes/${id}`, data)
  },

  deleteSecureNote(id) {
    return api.delete(`/secure-notes/${id}`)
  },

  getCountdowns() {
    return api.get('/countdowns')
  },

  createCountdown(data) {
    return api.post('/countdowns', data)
  },

  updateCountdown(id, data) {
    return api.put(`/countdowns/${id}`, data)
  },

  deleteCountdown(id) {
    return api.delete(`/countdowns/${id}`)
  },

  getUpcomingCountdowns() {
    return api.get('/countdowns/upcoming', { _silent: true })
  },

  dismissCountdown(id) {
    return api.patch(`/countdowns/${id}/dismiss`)
  }
}
