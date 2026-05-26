import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api'
import type { UserInfo, LoginParams } from './types'
import { eventBus } from '@/utils/eventBus'

const USER_INFO_KEY = 'userInfo'

// 从 localStorage 恢复用户信息
function getStoredUserInfo(): UserInfo | null {
  try {
    const stored = localStorage.getItem(USER_INFO_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const userInfo = ref<UserInfo | null>(getStoredUserInfo())
  const token = ref<string>(localStorage.getItem('token') || '')
  const loading = ref(false)

  const isAuthenticated = computed(() => !!token.value)

  async function login(params: LoginParams) {
    loading.value = true
    try {
      const res = await authApi.login(params)
      token.value = res.token
      userInfo.value = res.user
      localStorage.setItem('token', res.token)
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(res.user))
      eventBus.resetExpiredDialog()
      return res
    } finally {
      loading.value = false
    }
  }

  async function register(params: { email: string; password: string; name: string }) {
    loading.value = true
    try {
      const res = await authApi.register(params)
      token.value = res.token
      userInfo.value = res.user
      localStorage.setItem('token', res.token)
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(res.user))
      eventBus.resetExpiredDialog()
      return res
    } finally {
      loading.value = false
    }
  }

  async function fetchUserInfo() {
    try {
      const res = await authApi.getUserInfo()
      userInfo.value = res
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(res))
    } catch (error) {
      throw error
    }
  }

  async function updateProfile(params: { name?: string; avatar?: string }) {
    const res = await authApi.updateProfile(params)
    userInfo.value = { ...userInfo.value, ...res }
    localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo.value))
    return res
  }

  function logout() {
    token.value = ''
    userInfo.value = null
    localStorage.removeItem('token')
    localStorage.removeItem(USER_INFO_KEY)
    eventBus.resetExpiredDialog()
  }

  return {
    userInfo,
    token,
    loading,
    isAuthenticated,
    login,
    register,
    fetchUserInfo,
    updateProfile,
    logout
  }
})
