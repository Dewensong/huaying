// 用户信息类型
export interface UserInfo {
  id: number
  email: string
  phone?: string
  name: string
  avatar?: string
  createdAt: string
}

// 登录参数
export interface LoginParams {
  email?: string
  phone?: string
  password?: string
  code?: string
}
