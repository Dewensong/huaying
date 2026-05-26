/**
 * 对外 API v1 路由
 * 视频生成 API，支持 Webhook 回调
 */

import { Router, Response } from 'express'
import axios from 'axios'
import db from '../../db/index.js'
import { verifyApiKey, consumeApiKeyQuota, ApiKeyAuthRequest } from '../../middleware/apiKeyAuth.js'
import { createVideoRecord, processVideoAsync } from '../../services/video-pipeline.service.js'
import { getPresignedUrl, isCOSConfigured } from '../../config/cos.js'

const router = Router()

// ============ 中间件 ============

// 所有 v1 API 都需要 API Key 鉴权
router.use(verifyApiKey)

// ============ 创建视频任务 ============

/**
 * POST /api/v1/videos/generate
 * 创建视频生成任务
 */
router.post('/videos/generate', async (req: ApiKeyAuthRequest, res: Response) => {
  const {
    title,
    script,
    avatarId,
    voiceType,
    backgroundType,
    backgroundValue,
    subtitleFontSize,
    subtitleFontColor,
    webhookUrl
  } = req.body

  // 参数校验
  if (!script || script.trim() === '') {
    return res.status(400).json({
      code: 400,
      message: 'script 参数不能为空'
    })
  }

  try {
    // 消费额度
    consumeApiKeyQuota(req.apiKeyInfo!.id)

    // 创建视频记录
    const videoId = createVideoRecord({
      userId: req.apiKeyInfo!.userId,
      script: script.trim(),
      title: title || '',
      avatarId,
      voiceId: undefined,
      background: backgroundType && backgroundValue
        ? { type: backgroundType, value: backgroundValue }
        : '',
      status: 'processing',
      webhookUrl: webhookUrl || ''
    } as any)

    // 启动异步处理
    processVideoAsync(videoId, {
      userId: req.apiKeyInfo!.userId,
      videoId,
      avatarId,
      script: script.trim(),
      title: title || '',
      voiceType,
      backgroundType,
      backgroundValue,
      subtitleFontSize,
      subtitleFontColor
    })

    console.log(`[API/v1] 创建视频任务: videoId=${videoId}, userId=${req.apiKeyInfo!.userId}`)

    res.json({
      code: 0,
      message: 'success',
      data: {
        videoId,
        status: 'processing'
      }
    })
  } catch (error: any) {
    console.error('[API/v1] 创建视频失败:', error)
    res.status(500).json({
      code: 500,
      message: error.message || '创建视频失败'
    })
  }
})

// ============ 查询视频状态 ============

/**
 * GET /api/v1/videos/:id/status
 * 查询视频处理状态
 */
router.get('/videos/:id/status', async (req: ApiKeyAuthRequest, res: Response) => {
  const videoId = parseInt(req.params.id)

  if (isNaN(videoId)) {
    return res.status(400).json({
      code: 400,
      message: '无效的视频 ID'
    })
  }

  try {
    const video = db.prepare(`
      SELECT id, title, url, subtitle_url, status, progress, duration, error, created_at, completed_at
      FROM videos
      WHERE id = ? AND user_id = ?
    `).get(videoId, req.apiKeyInfo!.userId) as any

    if (!video) {
      return res.status(404).json({
        code: 404,
        message: '视频不存在'
      })
    }

    // 获取视频 CDN 地址
    let videoUrl = video.url
    if (videoUrl && isCOSConfigured()) {
      // 如果是 COS 对象键，转换为 CDN 地址
      if (!videoUrl.startsWith('http')) {
        videoUrl = `https://${process.env.COS_CDN_DOMAIN || process.env.COS_BUCKET + '.cos.' + process.env.COS_REGION + '.myqcloud.com'}/${videoUrl}`
      }
    }

    // 获取字幕预签名 URL（如果需要认证）
    let subtitleUrl = ''
    if (video.subtitle_url) {
      if (isCOSConfigured()) {
        subtitleUrl = getPresignedUrl(video.subtitle_url)
      } else {
        subtitleUrl = video.subtitle_url
      }
    }

    res.json({
      code: 0,
      message: 'success',
      data: {
        videoId: video.id,
        title: video.title,
        status: video.status,
        progress: video.progress,
        videoUrl,
        subtitleUrl,
        duration: video.duration,
        error: video.error,
        createdAt: video.created_at,
        completedAt: video.completed_at
      }
    })
  } catch (error: any) {
    console.error('[API/v1] 查询视频状态失败:', error)
    res.status(500).json({
      code: 500,
      message: error.message || '查询失败'
    })
  }
})

// ============ Webhook 回调 ============

/**
 * 视频处理完成后调用 Webhook
 * 此函数在 processVideoAsync 中调用
 */
export async function callWebhook(videoId: number, webhookUrl: string) {
  if (!webhookUrl) return

  try {
    // 获取视频信息
    const video = db.prepare(`
      SELECT id, title, url, subtitle_url, status, duration
      FROM videos
      WHERE id = ?
    `).get(videoId) as any

    if (!video) {
      console.error(`[Webhook] 视频 ${videoId} 不存在`)
      return
    }

    // 构建 CDN 地址
    let videoUrl = video.url
    if (videoUrl && isCOSConfigured() && !videoUrl.startsWith('http')) {
      const cdnDomain = process.env.COS_CDN_DOMAIN
      videoUrl = cdnDomain
        ? `https://${cdnDomain}/${videoUrl}`
        : `https://${process.env.COS_BUCKET}.cos.${process.env.COS_REGION}.myqcloud.com/${videoUrl}`
    }

    // 生成字幕预签名 URL
    let subtitleUrl = ''
    if (video.subtitle_url) {
      subtitleUrl = getPresignedUrl(video.subtitle_url, 86400) // 24小时有效期
    }

    const payload = {
      videoId: video.id,
      status: video.status,
      videoUrl,
      subtitleUrl,
      duration: video.duration,
      title: video.title
    }

    console.log(`[Webhook] 回调通知: ${webhookUrl}`)
    console.log(`[Webhook] Payload:`, JSON.stringify(payload, null, 2))

    await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    })

    console.log(`[Webhook] 回调成功: videoId=${videoId}`)
  } catch (error: any) {
    console.error(`[Webhook] 回调失败: videoId=${videoId}, error=${error.message}`)
  }
}

// ============ 额度查询 ============

/**
 * GET /api/v1/quota
 * 查询 API Key 额度使用情况
 */
router.get('/quota', async (req: ApiKeyAuthRequest, res: Response) => {
  res.json({
    code: 0,
    message: 'success',
    data: {
      quotaLimit: req.apiKeyInfo!.quotaLimit,
      quotaUsed: req.apiKeyInfo!.quotaUsed,
      quotaRemaining: req.apiKeyInfo!.quotaLimit > 0
        ? req.apiKeyInfo!.quotaLimit - req.apiKeyInfo!.quotaUsed
        : -1 // -1 表示无限制
    }
  })
})

export default router
