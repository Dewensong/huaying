import api from './request'

// 重新导出 request 实例，供其他模块直接使用（如获取预签名URL）
export { default as request } from './request'

// 认证相关 API
export const authApi = {
  login: (data: { email?: string; phone?: string; password?: string; code?: string }) =>
    api.post<{ token: string; user: any }>('/core/auth/login', data),

  register: (data: { email: string; password: string; name: string }) =>
    api.post<{ token: string; user: any }>('/core/auth/register', data),

  sendCode: (phone: string) =>
    api.post('/core/auth/send-sms', { phone }),

  getUserInfo: () =>
    api.get<any>('/core/auth/me'),

  updateProfile: (data: { name?: string; avatar?: string }) =>
    api.patch<any>('/core/auth/profile', data)
}

// 形象管理 API
export const avatarApi = {
  list: (params?: { type?: string; page?: number; pageSize?: number }) =>
    api.get<{ list: any[]; total: number }>('/core/avatars', { params }),

  create: (data: { name: string; image: string; type: string; config?: object }) =>
    api.post<any>('/core/avatars', data),

  update: (id: number, data: { name?: string; image?: string; enabled?: boolean; config?: object }) =>
    api.patch<any>(`/core/avatars/${id}`, data),

  delete: (id: number) =>
    api.delete(`/core/avatars/${id}`)
}

// 声音管理 API
export const voiceApi = {
  list: (params?: { type?: string; page?: number; pageSize?: number }) =>
    api.get<{ list: any[]; total: number }>('/core/voices', { params }),

  create: (data: { name: string; audio: string; type: string; config?: object }) =>
    api.post<any>('/core/voices', data),

  update: (id: number, data: { name?: string; audio?: string; config?: object }) =>
    api.patch<any>(`/core/voices/${id}`, data),

  delete: (id: number) =>
    api.delete(`/core/voices/${id}`),

  // 试听声音
  preview: (data: { voiceId?: number; voiceType?: string }) =>
    api.post<{
      [x: string]: any; success: boolean; audioUrl: string; duration: number
    }>('/core/voices/preview', data),

  // 克隆声音 - 获取克隆音色列表
  getCloneList: () =>
    api.get<{ list: any[]; total: number }>('/core/voices/clone-list'),

  // 克隆声音 - 提交克隆
  cloneVoice: (data: {
    name: string
    audioUrl: string
    audioFormat: string
    language?: number
  }) =>
    api.post<{ success: boolean; message: string; data?: any }>('/core/voices/clone', data),

  // 克隆声音 - 查询状态
  getCloneStatus: (speakerId: string) =>
    api.get<any>(`/core/voices/clone/${speakerId}/status`),

  // 克隆声音 - 删除
  deleteClone: (speakerId: string) =>
    api.delete(`/core/voices/clone/${speakerId}`)
}

// AI 文案 API
export const scriptApi = {
  generate: (data: { source: string; count: number; style: string; duration: number }) =>
    api.post<{ scripts: string[] }>('/core/scripts/generate', data),

  list: (params?: { page?: number; pageSize?: number }) =>
    api.get<{ list: any[]; total: number }>('/core/scripts', { params }),

  save: (data: { content: string; title?: string }) =>
    api.post<any>('/core/scripts', data),

  update: (id: number, data: { content?: string; title?: string }) =>
    api.patch<any>(`/core/scripts/${id}`, data),

  delete: (id: number) =>
    api.delete(`/core/scripts/${id}`)
}

// 视频任务 API
export const videoApi = {
  list: (params?: { status?: string; page?: number; pageSize?: number }) =>
    api.get<{ list: any[]; total: number }>('/core/videos', { params }),

  create: (data: any) =>
    api.post<any>('/core/videos', data),

  // 视频生产流水线
  createPipeline: (data: {
    avatarId: number
    script: string
    title?: string
    voiceId?: number
    voiceType?: string
    background?: { type: 'color' | 'image'; value: string }
    subtitleConfig?: { fontSize?: number; fontColor?: string }
  }) =>
    api.post<{ success: boolean; videoId: number; status: string; message: string }>('/core/videos/create', data),

  batchCreate: (data: any[]) =>
    api.post<any[]>('/core/videos/batch', data),

  getDetail: (id: number) =>
    api.get<any>(`/core/videos/${id}`),

  update: (id: number, data: any) =>
    api.patch<any>(`/core/videos/${id}`, data),

  delete: (id: number) =>
    api.delete(`/core/videos/${id}`),

  retry: (id: number) =>
    api.post<any>(`/core/videos/${id}/retry`)
}

// 模板 API
export const templateApi = {
  list: (params?: { page?: number; pageSize?: number }) =>
    api.get<{ list: any[]; total: number }>('/core/templates', { params }),

  create: (data: any) =>
    api.post<any>('/core/templates', data),

  update: (id: number, data: any) =>
    api.patch<any>(`/core/templates/${id}`, data),

  delete: (id: number) =>
    api.delete(`/core/templates/${id}`)
}

// 仪表盘 API
export const dashboardApi = {
  getStats: () =>
    api.get<any>('/core/dashboard/stats')
}

// 上传 API
export const uploadApi = {
  getSignature: (params: { filename: string; type: string }) =>
    api.get<{ signature: string; uploadUrl: string; cosKey: string }>('/core/upload/signature', { params }),

  // 获取 COS 文件预览 URL
  getPreviewUrl: (params: { key: string; expires?: number }) =>
    api.get<{ url: string }>('/core/cos/preview-url', { params })
}

// AI 能力 API
export const aiApi = {
  // 生成形象
  generateAvatar: (data: { prompt: string; style?: string; name?: string }) =>
    api.post<{ message: string; avatar: any; imageUrl: string }>('/core/ai/generate-avatar', data),

  // 获取 AI 服务状态
  getStatus: () =>
    api.get<{ seedreamConfigured: boolean; freeQuota: number; features: any }>('/core/ai/status')
}

