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

  getFortuneImageUrl(fortuneId) {
    const token = localStorage.getItem(TOKEN_KEY)
    const baseURL = api.defaults.baseURL
    return `${baseURL}/fortune/${fortuneId}/image?token=${token}`
  },

  generateFortuneImage(fortuneId) {
    // 异步：立即返回 202「生成中」，无需长超时
    return api.post(`/fortune/${fortuneId}/generate-image`, null, { timeout: 30000 })
  },

  getFortuneImageStatus(fortuneId) {
    return api.get(`/fortune/${fortuneId}/image-status`, { _silent: true })
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
      },
      timeout: 185000  // 视觉识别（gpt-5.6 OCR）可达 ~170s，留出余量；与后端 170s deadline 对齐，让后端先报真实错误
    })
  },

  updateWeeklyMenu(id, menu) {
    return api.put(`/menu/${id}`, { menu })
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

  getNotes(params = {}, { signal } = {}) {
    return api.get('/notes', { params, signal })
  },

  getNote(id) {
    return api.get(`/notes/${id}`)
  },

  createNote(data) {
    return api.post('/notes', data)
  },

  updateNote(id, data) {
    return api.put(`/notes/${id}`, data)
  },

  pinNote(id, pinned) {
    return api.patch(`/notes/${id}/pin`, { pinned })
  },

  deleteNote(id) {
    return api.delete(`/notes/${id}`)
  },

  uploadNoteAttachments(noteId, files) {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    return api.post(`/notes/${noteId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000  // 单个附件上限 10MB，弱网下 60s 不够
    })
  },

  // _silent：删附件是保存流程的一环，失败与否由调用方汇总提示，
  // 不让拦截器对每个附件单独弹一次错
  deleteNoteAttachment(noteId, attachmentId) {
    return api.delete(`/notes/${noteId}/attachments/${attachmentId}`, { _silent: true })
  },

  // 附件走 ?token=，因为 <img src> 和新标签页带不了 Authorization 头
  getNoteAttachmentUrl(noteId, attachmentId, { download = false } = {}) {
    const token = localStorage.getItem(TOKEN_KEY)
    const baseURL = api.defaults.baseURL
    const suffix = download ? '&download=1' : ''
    return `${baseURL}/notes/${noteId}/attachments/${attachmentId}/file?token=${token}${suffix}`
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
