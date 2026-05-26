/**
 * WebSocket 进度推送 Hook
 *
 * 功能：
 * 1. 管理 WebSocket 连接生命周期
 * 2. 监听进度更新消息
 * 3. 提供降级机制（WebSocket 失败时回退到轮询）
 */

import { ref, onUnmounted } from 'vue'
import { videoApi } from '@/api'

interface ProgressMessage {
  type: 'progress' | 'connected' | 'pong' | 'quota_update'
  taskId?: string
  videoId?: number
  step?: string
  percent?: number
  timestamp?: number
  data?: any
  userId?: number
  credits?: number
}

interface VideoProgress {
  videoId: number
  step: string
  percent: number
  timestamp: number
  data?: any
}

export function useWebSocketProgress() {
  const ws = ref<WebSocket | null>(null)
  const connected = ref(false)
  const connecting = ref(false)
  const progressMap = ref<Map<number, VideoProgress>>(new Map())
  const wsError = ref<string | null>(null)

  // 轮询相关（降级方案）
  let pollingTimer: number | null = null
  const pollingInterval = 5000 // 5秒轮询一次
  const subscribedVideoIds = ref<Set<number>>(new Set())

  // 获取 WebSocket URL
  function getWsUrl(): string {
    const wsPath = '/ws/progress'
    // 使用当前页面的协议和主机，避免生产环境连接 localhost
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const url = `${protocol}//${host}${wsPath}`
    console.log('[WebSocket] 连接到:', url)
    return url
  }

  // 连接 WebSocket
  function connect(videoIds?: number[]) {
    if (ws.value?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] 已连接')
      return
    }

    if (connecting.value) {
      console.log('[WebSocket] 正在连接...')
      return
    }

    connecting.value = true
    wsError.value = null

    try {
      const url = getWsUrl()
      console.log('[WebSocket] 正在连接:', url)
      ws.value = new WebSocket(url)

      ws.value.onopen = () => {
        console.log('[WebSocket] 连接成功')
        connected.value = true
        connecting.value = false

        // 订阅指定视频的进度
        if (videoIds && videoIds.length > 0) {
          videoIds.forEach(id => subscribedVideoIds.value.add(id))
        }

        // 启动心跳
        startHeartbeat()
      }

      ws.value.onmessage = (event) => {
        try {
          const message: ProgressMessage = JSON.parse(event.data)
          handleMessage(message)
        } catch (error) {
          console.warn('[WebSocket] 解析消息失败:', error)
        }
      }

      ws.value.onclose = () => {
        console.log('[WebSocket] 连接已关闭')
        connected.value = false
        connecting.value = false
        stopHeartbeat()

        // 如果还有订阅的视频，5秒后自动重连
        if (subscribedVideoIds.value.size > 0) {
          console.log('[WebSocket] 尝试重连...')
          setTimeout(() => {
            if (subscribedVideoIds.value.size > 0) {
              connect(Array.from(subscribedVideoIds.value))
            }
          }, 5000)
        }
      }

      ws.value.onerror = (error) => {
        console.error('[WebSocket] 连接错误:', error)
        wsError.value = 'WebSocket 连接失败'
        connected.value = false
        connecting.value = false

        // 降级到轮询
        if (videoIds && videoIds.length > 0) {
          console.log('[WebSocket] 降级到轮询模式')
          startPollingFallback(Array.from(videoIds))
        }
      }
    } catch (error) {
      console.error('[WebSocket] 创建连接失败:', error)
      wsError.value = 'WebSocket 连接失败'
      connecting.value = false

      // 降级到轮询
      if (videoIds && videoIds.length > 0) {
        startPollingFallback(videoIds)
      }
    }
  }

  // 进度更新回调（支持多个组件同时注册）
  const onProgressCallbacks: ((videoId: number, percent: number, step?: string, data?: any) => void)[] = []
  const onQuotaUpdateCallbacks: ((userId: number, credits: number) => void)[] = []

  // 注册进度更新回调
  function onProgress(callback: (videoId: number, percent: number, step?: string, data?: any) => void) {
    if (!onProgressCallbacks.includes(callback)) {
      onProgressCallbacks.push(callback)
    }
    // 返回取消注册函数
    return () => {
      const index = onProgressCallbacks.indexOf(callback)
      if (index > -1) {
        onProgressCallbacks.splice(index, 1)
      }
    }
  }

  // 注册额度更新回调
  function onQuotaUpdate(callback: (userId: number, credits: number) => void) {
    if (!onQuotaUpdateCallbacks.includes(callback)) {
      onQuotaUpdateCallbacks.push(callback)
    }
    // 返回取消注册函数
    return () => {
      const index = onQuotaUpdateCallbacks.indexOf(callback)
      if (index > -1) {
        onQuotaUpdateCallbacks.splice(index, 1)
      }
    }
  }

  // 处理消息
  function handleMessage(message: ProgressMessage) {
    if (message.type === 'progress' && message.videoId && message.percent !== undefined) {
      progressMap.value.set(message.videoId, {
        videoId: message.videoId,
        step: message.step || '',
        percent: message.percent,
        timestamp: message.timestamp || Date.now(),
        data: message.data
      })

      // 触发所有已注册的回调
      onProgressCallbacks.forEach(cb => {
        try {
          cb(message.videoId!, message.percent!, message.step, message.data)
        } catch (err) {
          console.error('[WebSocket] onProgress 回调执行失败:', err)
        }
      })
    } else if (message.type === 'quota_update' && message.userId !== undefined && message.credits !== undefined) {
      // 触发所有已注册的额度更新回调
      onQuotaUpdateCallbacks.forEach(cb => {
        try {
          cb(message.userId!, message.credits!)
        } catch (err) {
          console.error('[WebSocket] onQuotaUpdate 回调执行失败:', err)
        }
      })
    }
  }

  // 启动心跳
  function startHeartbeat() {
    stopHeartbeat()
    pollingTimer = window.setInterval(() => {
      if (ws.value?.readyState === WebSocket.OPEN) {
        ws.value.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000) // 每30秒发送一次心跳
  }

  // 停止心跳
  function stopHeartbeat() {
    if (pollingTimer) {
      clearInterval(pollingTimer)
      pollingTimer = null
    }
  }

  // 降级轮询（当 WebSocket 不可用时）
  let fallbackPollingTimer: number | null = null

  // 轮询获取视频状态
  async function pollVideoStatus(videoId: number) {
    try {
      const res = await videoApi.getDetail(videoId) as any
      const video = res?.data || res

      if (video) {
        const percent = video.progress || 0
        const step = video.step || video.status_message || '处理中...'

        progressMap.value.set(videoId, {
          videoId,
          step,
          percent,
          timestamp: Date.now(),
          data: video.status === 'failed' ? { error: true } : undefined
        })

        // 触发所有回调
        onProgressCallbacks.forEach(cb => {
          try {
            cb(videoId, percent, step, { error: video.status === 'failed' })
          } catch (err) {
            console.error('[WebSocket] onProgress 回调执行失败:', err)
          }
        })
      }
    } catch (error) {
      console.warn(`[WebSocket] 轮询失败 videoId=${videoId}:`, error)
    }
  }

  function startPollingFallback(videoIds: number[]) {
    stopPollingFallback()

    // 立即获取一次状态
    videoIds.forEach(id => {
      subscribedVideoIds.value.add(id)
      pollVideoStatus(id)
    })

    fallbackPollingTimer = window.setInterval(() => {
      subscribedVideoIds.value.forEach(id => {
        pollVideoStatus(id)
      })
    }, pollingInterval)
  }

  function stopPollingFallback() {
    if (fallbackPollingTimer) {
      clearInterval(fallbackPollingTimer)
      fallbackPollingTimer = null
    }
  }

  // 断开连接
  function disconnect() {
    stopHeartbeat()
    stopPollingFallback()

    if (ws.value) {
      ws.value.close()
      ws.value = null
    }

    connected.value = false
    connecting.value = false
    progressMap.value.clear()
  }

  // 获取指定视频的进度
  function getProgress(videoId: number): VideoProgress | undefined {
    return progressMap.value.get(videoId)
  }

  // 订阅视频进度 — 将 videoId 加入过滤集合并建立连接
  function subscribe(videoIds: number[]) {
    videoIds.forEach(id => subscribedVideoIds.value.add(id))

    // 始终尝试连接（无论是否已有连接），确保能接收最新订阅视频的进度
    connect(videoIds)

    // 即使连接已存在（ws 处于 OPEN 状态），也要确保新订阅的 videoId 被加入过滤集合
    if (ws.value?.readyState === WebSocket.OPEN) {
      videoIds.forEach(id => subscribedVideoIds.value.add(id))
    }
  }

  // 取消订阅（仅移除本地记录，不断开连接）
  function unsubscribe(videoId: number) {
    subscribedVideoIds.value.delete(videoId)

    // 如果没有更多订阅，关闭连接
    if (subscribedVideoIds.value.size === 0) {
      disconnect()
    }
  }

  // 组件卸载时清理
  onUnmounted(() => {
    disconnect()
  })

  return {
    connected,
    connecting,
    wsError,
    progressMap,
    onProgress,
    onQuotaUpdate,
    connect,
    disconnect,
    getProgress,
    subscribe,
    unsubscribe
  }
}
