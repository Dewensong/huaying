/**
 * 任务进度 WebSocket 服务
 * 
 * 功能：
 * 1. 创建 WebSocket 服务器，与 Express 共享同一 HTTP 端口
 * 2. 主动向客户端推送任务进度信息
 * 3. 支持多客户端同时连接
 * 
 * 使用方式：
 * - 后端在关键步骤调用 pushProgress() 推送进度
 * - 前端通过 WebSocket 连接并监听 'progress' 消息
 */

import { WebSocketServer, WebSocket } from 'ws'
import http from 'http'

// ============ 类型定义 ============

export interface ProgressMessage {
  type: 'progress'
  taskId: string
  videoId: number
  step: string           // 步骤描述，如 "正在生成第2/4个片段"
  percent: number        // 进度百分比 0-100
  timestamp: number       // 时间戳
  data?: any             // 附加数据（可选）
}

// ============ WebSocket 服务 ============

let wss: WebSocketServer | null = null
const clients: Set<WebSocket> = new Set() // 所有连接的客户端

// ============ 伪进度推送（用于耗时步骤） ============

// 步骤区间配置
const STEP_RANGES: Record<string, { start: number; end: number; duration?: number }> = {
  'download_avatar': { start: 0, end: 5 },        // 下载形象图片
  'process_avatar': { start: 5, end: 15 },        // 处理形象图片
  'tts': { start: 15, end: 45 },                  // TTS 合成（耗时最长）
  'video': { start: 45, end: 80 },                 // 视频合成
  'subtitle': { start: 80, end: 95 },              // 字幕烧录
  'upload': { start: 95, end: 100 },               // COS 上传
}

// 存储每个视频的伪进度定时器
const progressTimers: Map<number, NodeJS.Timeout> = new Map()
// 存储每个视频当前的伪进度值
const progressValues: Map<number, number> = new Map()
// 存储每个视频的当前步骤
const stepNames: Map<number, string> = new Map()

/**
 * 启动伪进度推送（用于耗时步骤）
 * 每秒线性递增进度，直到达到该步骤的终点
 */
export function startStepProgress(
  videoId: number,
  stepName: string,
  stepKey?: string  // 可选，用于指定步骤区间，默认用 stepName 匹配
): void {
  // 清除之前的定时器
  stopStepProgress(videoId)

  // 获取步骤区间
  const key = stepKey || stepName
  const range = STEP_RANGES[key] || STEP_RANGES['tts'] // 默认用 TTS 的区间
  const startPercent = range.start
  const endPercent = range.end
  const totalRange = endPercent - startPercent

  // 估算总时长（秒），根据区间大小调整
  const estimatedDuration = Math.max(10, totalRange * 2) // 至少 10 秒
  const intervalMs = 1000 // 每秒更新一次
  const incrementPerTick = totalRange / estimatedDuration

  let currentPercent = startPercent
  progressValues.set(videoId, currentPercent)
  stepNames.set(videoId, stepName)

  console.log(`[WebSocket] 启动伪进度: videoId=${videoId}, step=${stepName}, ${startPercent}% -> ${endPercent}%`)

  const timer = setInterval(() => {
    currentPercent += incrementPerTick

    if (currentPercent >= endPercent) {
      // 达到终点，不再继续递增
      currentPercent = endPercent
      progressValues.set(videoId, currentPercent)
      pushProgress('', videoId, stepName, Math.round(currentPercent))
      // 清除定时器但保持进度值
      clearInterval(timer)
      progressTimers.delete(videoId)
      console.log(`[WebSocket] 伪进度已达终点: videoId=${videoId}, ${endPercent}%`)
    } else {
      progressValues.set(videoId, currentPercent)
      pushProgress('', videoId, stepName, Math.round(currentPercent))
    }
  }, intervalMs)

  progressTimers.set(videoId, timer)
}

/**
 * 停止伪进度推送
 * 推送该步骤的准确终点百分比（如果实际进度已经超过）
 */
export function stopStepProgress(
  videoId: number,
  actualPercent?: number  // 可选，传入实际完成时的百分比
): void {
  const timer = progressTimers.get(videoId)
  if (timer) {
    clearInterval(timer)
    progressTimers.delete(videoId)
  }

  // 获取当前步骤名
  const stepName = stepNames.get(videoId) || '处理中'

  // 推送准确进度
  const percent = actualPercent !== undefined ? actualPercent : progressValues.get(videoId) || 0
  progressValues.delete(videoId)
  stepNames.delete(videoId)

  console.log(`[WebSocket] 停止伪进度: videoId=${videoId}, 推送 ${percent}%`)
  pushProgress('', videoId, stepName, Math.round(percent))
}

/**
 * 获取当前伪进度值
 */
export function getCurrentProgress(videoId: number): number {
  return progressValues.get(videoId) || 0
}

/**
 * 判断指定视频是否有正在运行的伪进度定时器
 */
export function hasActiveProgress(videoId: number): boolean {
  return progressTimers.has(videoId)
}

/**
 * 初始化 WebSocket 服务器
 * @param server HTTP 服务器实例（与 Express 共享）
 */
export function initWebSocketServer(server: http.Server): void {
  if (wss) {
    console.log('[WebSocket] 服务已初始化')
    return
  }

  // 【修复】使用 noServer 模式，手动处理 upgrade 事件以过滤路径
  wss = new WebSocketServer({ noServer: true })

  // 处理 upgrade 请求，只接受 /ws/progress 路径的连接
  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname
    
    console.log(`[WebSocket] upgrade 请求: ${pathname}`)
    
    if (pathname === '/ws/progress') {
      wss!.handleUpgrade(request, socket, head, (ws) => {
        wss!.emit('connection', ws, request)
      })
    } else {
      console.log(`[WebSocket] 拒绝非 /ws/progress 路径的连接: ${pathname}`)
      socket.destroy()
    }
  })

  wss.on('connection', (ws: WebSocket) => {
    console.log(`[WebSocket] 客户端连接`)

    // 将客户端加入集合
    clients.add(ws)

    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString())
        console.log('[WebSocket] 收到消息:', data)
        
        // 处理心跳/ping
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }))
        }
      } catch (error) {
        console.warn('[WebSocket] 解析消息失败:', error)
      }
    })

    ws.on('close', () => {
      console.log(`[WebSocket] 客户端断开连接`)
      
      // 从客户端集合中移除
      clients.delete(ws)
    })

    ws.on('error', (error) => {
      console.error('[WebSocket] 连接错误:', error.message)
    })

    // 发送欢迎消息
    ws.send(JSON.stringify({
      type: 'connected',
      message: '已连接到任务进度服务',
      timestamp: Date.now()
    }))
  })

  wss.on('error', (error) => {
    console.error('[WebSocket] 服务器错误:', error.message)
  })

  console.log('[WebSocket] ✅ WebSocket 服务初始化完成，监听路径: /ws/progress')
}

// ============ 防回退机制 ============

// 记录每个任务最后一次推送的进度值，防止进度回退
const lastPushedPercent: Map<string, number> = new Map()

/**
 * 获取任务的最后一次推送进度
 */
function getLastPushedPercent(videoId: number): number {
  return lastPushedPercent.get(String(videoId)) ?? -1
}

/**
 * 更新任务的最后一次推送进度
 */
function updateLastPushedPercent(videoId: number, percent: number): void {
  lastPushedPercent.set(String(videoId), percent)
}

/**
 * 推送任务进度到所有连接的客户端
 * 
 * @param taskId 任务 ID
 * @param videoId 视频 ID
 * @param step 步骤描述
 * @param percent 进度百分比 0-100
 * @param data 附加数据（可选）
 */
export function pushProgress(
  taskId: string,
  videoId: number,
  step: string,
  percent: number,
  data?: any
): void {
  if (!wss) {
    console.warn('[WebSocket] 服务未初始化，跳过进度推送')
    return
  }

  // 【防回退】检查新进度是否小于上次推送的值，如果是则忽略
  const lastPercent = getLastPushedPercent(videoId)
  if (percent < lastPercent) {
    console.log(`[WebSocket] 跳过进度回退: videoId=${videoId}, 忽略 ${percent}% (上次 ${lastPercent}%)`)
    return
  }

  // 【防回退】更新记录
  updateLastPushedPercent(videoId, percent)

  const clampedPercent = Math.min(100, Math.max(0, percent)) // 限制在 0-100 范围内

  const message: ProgressMessage = {
    type: 'progress',
    taskId,
    videoId,
    step,
    percent: clampedPercent,
    timestamp: Date.now(),
    data
  }

  const messageStr = JSON.stringify(message)

  // 广播给所有连接的客户端（前端会根据 videoId 过滤自己关心的视频）
  let sentCount = 0
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr)
      sentCount++
    }
  }
  if (sentCount > 0) {
    console.log(`[WebSocket] 广播进度到 ${sentCount} 个客户端: ${step} (${clampedPercent}%)`)
  }
}

/**
 * 获取当前连接数
 */
export function getConnectionCount(): number {
  return clients.size
}

/**
 * 关闭 WebSocket 服务器
 */
export function closeWebSocketServer(): void {
  if (wss) {
    wss.close()
    wss = null
    clients.clear()
    console.log('[WebSocket] 服务已关闭')
  }
}

