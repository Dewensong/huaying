// 用户信息类型
export interface UserInfo {
  id: number
  email: string
  phone?: string
  name: string
  avatar?: string
  plan: 'free' | 'creator' | 'studio' | 'enterprise'
  credits: number
  creditsLimit: number
  creditsResetAt?: string
  createdAt: string
  is_admin?: number
}

// 登录参数
export interface LoginParams {
  email?: string
  phone?: string
  password?: string
  code?: string
}
