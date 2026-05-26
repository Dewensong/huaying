/**
 * COS 预签名 URL 路由
 * 用于获取私有 COS 对象的访问地址
 */

import { Router, Request, Response } from 'express'
import { getPresignedUrl, isCOSConfigured } from '../../config/cos.js'

const router = Router()

/**
 * 从完整 URL 中提取 COS 对象键
 * 例如: https://xxx.cos.ap-beijing.myqcloud.com/subtitles/xxx.vtt -> subtitles/xxx.vtt
 */
function extractCosKey(url: string): string | null {
  if (!url) return null
  if (!url.startsWith('http')) return url  // 已经是 COS key，直接返回

  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    // 移除开头的斜杠
    return pathname.startsWith('/') ? pathname.slice(1) : pathname
  } catch {
    return null
  }
}

/**
 * GET /api/core/cos/preview-url
 * 获取 COS 对象的预签名访问 URL
 *
 * Query 参数:
 * - key: COS 对象键（如 subtitles/subtitle_123.vtt）或完整 URL
 * - expires: 过期时间（秒），默认 3600
 */
router.get('/preview-url', (req: Request, res: Response) => {
  const { key, expires = '3600' } = req.query

  if (!key || typeof key !== 'string') {
    return res.status(400).json({
      success: false,
      message: '缺少 key 参数'
    })
  }

  // 如果是完整 URL，直接返回（不再拼接）
  if (key.startsWith('http://') || key.startsWith('https://')) {
    console.log('[COS] 传入的 key 已是完整 URL，直接返回:', key)
    return res.json({
      success: true,
      url: key
    })
  }

  if (!isCOSConfigured()) {
    // COS 未配置时，返回原始路径
    return res.json({
      success: true,
      url: key
    })
  }

  try {
    const expiresIn = parseInt(expires as string) || 3600
    const url = getPresignedUrl(key, expiresIn)

    res.json({
      success: true,
      url
    })
  } catch (error: any) {
    console.error('[COS] 生成预签名 URL 失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '生成 URL 失败'
    })
  }
})

export default router
