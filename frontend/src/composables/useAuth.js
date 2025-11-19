import { reactive, computed } from 'vue'
import { authStorage } from '@/api'

const state = reactive({
  token: authStorage.getToken(),
  user: authStorage.getUser()
})

const isAuthenticated = computed(() => Boolean(state.token))
const isAdmin = computed(() => state.user?.role === 'admin')

export function useAuth() {
  const setAuth = (token, user) => {
    state.token = token
    state.user = user
    authStorage.save(token, user)
  }

  const clearAuth = () => {
    state.token = null
    state.user = null
    authStorage.clear()
  }

  return {
    state,
    isAuthenticated,
    isAdmin,
    setAuth,
    clearAuth
  }
}
