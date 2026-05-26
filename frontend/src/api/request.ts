import axios, { AxiosError, AxiosInterceptorManager, AxiosRequestConfig, AxiosResponse } from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import { eventBus } from '@/utils/eventBus'

// 自定义 API 接口，与运行时行为（响应拦截器返回 data）一致
export interface ApiClient {
  interceptors: {
    request: AxiosInterceptorManager<InternalAxiosRequestConfig>
    response: AxiosInterceptorManager<AxiosResponse>
  }
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>
  patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>
}

const _api = axios.create({
  baseURL: '/api',
  timeout: 120000, // 2分钟
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
_api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

// 响应拦截器：返回 response.data（而非 AxiosResponse）
// 配合 ApiClient 接口，确保 TypeScript 类型与运行时行为一致
_api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data
  },
  (error: AxiosError<{ message?: string; code?: number }>) => {
    const message = error.response?.data?.message || error.message || '请求失败'

    if (error.response?.status === 401) {
      eventBus.showTokenExpiredOnce()
    } else if (error.response?.status === 402) {
      ElMessage.error(message || '额度不足，请升级套餐')
    } else if (error.response?.status === 403) {
      ElMessage.error(message || '权限不足')
    } else if (error.response?.status === 404) {
      ElMessage.error(message || '资源不存在')
    } else if (error.response?.status === 500) {
      ElMessage.error('服务器错误，请稍后重试')
    } else {
      ElMessage.error(message)
    }

    return Promise.reject(error)
  }
)

// 导出为 ApiClient 类型，所有方法返回 Promise<T> 而非 Promise<AxiosResponse<T>>
export default _api as ApiClient
