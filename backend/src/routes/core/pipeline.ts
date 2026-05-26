import { Router, Response } from 'express'
import path from 'path'
import fs from 'fs'
import db from '../../db/index.js'
import { config } from '../../config/index.js'
import { authenticate, AuthRequest } from '../../middleware/auth.js'
import { checkQuota, consumeQuota } from '../../middleware/quota.js'

const router = Router()

/**
 * 安全转换为固定小数位（避免浮点精度问题）
 */
function safeToFixed(num: number, decimals: number = 2): string {
  const m = Math.pow(10, decimals)
  return (Math.round(num * m) / m).toFixed(decimals)
}

// 确保输出目录存在
const outputDir = path.join(process.cwd(), 'data', 'output')
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

// ============ Mock 模式服务 ============

/**
 * Mock TTS 服务 - 生成占位音频文件
 */
async function mockTTS(script: string, voiceId?: string): Promise<{ audioPath: string; duration: number }> {
  // 模拟 TTS 处理时间 (1-3秒)
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
  
  // 计算模拟时长（按每分钟150字计算）
  const wordsPerMinute = 150
  const duration = (script.length / wordsPerMinute) * 60 // 秒
  
  // 创建占位音频文件 (实际是文本文件，用于演示)
  const audioFileName = `tts_${Date.now()}_${Math.random().toString(36).substr(2, 8)}.txt`
  const audioPath = path.join(outputDir, audioFileName)
  fs.writeFileSync(audioPath, JSON.stringify({
    type: 'mock_tts',
    script,
    voiceId,
    createdAt: new Date().toISOString()
  }))
  
  return { audioPath, duration }
}

/**
 * Mock 口型驱动服务 - 生成模拟视频
 */
async function mockLipSync(avatarUrl: string, audioPath: string, background?: string): Promise<{ videoPath: string; duration: number }> {
  // 模拟口型驱动处理时间 (2-5秒)
  await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000))
  
  // 读取音频信息
  let duration = 5 // 默认5秒
  if (fs.existsSync(audioPath)) {
    try {
      const audioInfo = JSON.parse(fs.readFileSync(audioPath, 'utf-8'))
      duration = Math.max(3, Math.min(300, audioInfo.duration || 5)) // 3-300秒
    } catch {
      // 使用默认时长
    }
  }
  
  // 创建占位视频文件
  const videoFileName = `video_${Date.now()}_${Math.random().toString(36).substr(2, 8)}.txt`
  const videoPath = path.join(outputDir, videoFileName)
  fs.writeFileSync(videoPath, JSON.stringify({
    type: 'mock_video',
    avatarUrl,
    background: background || 'default',
    duration,
    createdAt: new Date().toISOString()
  }))
  
  return { videoPath, duration }
}

/**
 * Mock 上传到 COS（返回本地路径）
 */
async function mockUploadToCOS(filePath: string): Promise<{ url: string }> {
  // 模拟上传延迟
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000))
  
  // 返回本地文件路径作为 mock URL
  const fileName = path.basename(filePath)
  const mockUrl = `https://mock-cos.huaying.com/videos/${fileName}`
  
  return { url: mockUrl }
}

// ============ 实际 TTS 服务（生产环境使用） ============

/**
 * 调用腾讯云 TTS 服务
 */
async function callTencentTTS(text: string, voiceId?: string): Promise<{ audioPath: string; duration: number }> {
  // TODO: 实现腾讯云 TTS 集成
  // 示例: 使用腾讯云 TCTTS 或腾讯云语音合成
  console.log('[TTS] 腾讯云 TTS 调用:', { text: text.substring(0, 50), voiceId })
  throw new Error('腾讯云 TTS 尚未配置，请使用 mock 模式')
}

/**
 * 调用口型驱动服务（生产环境使用）
 */
async function callLipSyncService(avatarUrl: string, audioPath: string, background?: string): Promise<{ videoPath: string; duration: number }> {
  // TODO: 实现口型驱动服务集成
  // 示例: Wav2Lip, SadTalker, 或自研服务
  console.log('[LipSync] 口型驱动调用:', { avatarUrl, background })
  throw new Error('口型驱动服务尚未配置，请使用 mock 模式')
}

/**
 * 上传到腾讯云 COS
 */
async function uploadToCOS(filePath: string): Promise<{ url: string }> {
  if (!config.cos.secretId || !config.cos.bucket) {
    return mockUploadToCOS(filePath)
  }
  
  // TODO: 实现腾讯云 COS 集成
  // 示例: 使用 cos-nodejs-sdk-v5
  console.log('[COS] 上传到腾讯云 COS:', filePath)
  throw new Error('COS 上传尚未实现')
}

// ============ 路由定义 ============

/**
 * POST /api/pipeline/talk
 * 数字人口播视频生产流水线
 */
router.post('/talk', authenticate, checkQuota(1), async (req: AuthRequest, res: Response) => {
  try {
    const { avatarId, script, voiceId, background } = req.body

    // 参数校验
    if (!avatarId) {
      return res.status(400).json({ success: false, message: '缺少必需参数: avatarId' })
    }
    if (!script || script.trim() === '') {
      return res.status(400).json({ success: false, message: '缺少必需参数: script' })
    }

    console.log(`[Pipeline] 开始处理视频: avatarId=${avatarId}, scriptLength=${script.length}`)

    // Step 1: 查询形象库（预置形象 user_id 为 NULL，自定义形象需匹配 user_id）
    const avatar = db.prepare(`
      SELECT id, name, image, model_url 
      FROM avatars 
      WHERE id = ? AND (user_id = ? OR user_id IS NULL)
    `).get(avatarId, req.user!.id) as any

    if (!avatar) {
      return res.status(404).json({ success: false, message: '形象不存在或无权访问' })
    }

    let avatarUrl = avatar.image
    if (!avatarUrl && avatar.model_url) {
      avatarUrl = avatar.model_url
    }
    if (!avatarUrl) {
      avatarUrl = '/default-avatar.png'
    }

    console.log(`[Pipeline] 步骤1完成: 查询形象 ${avatar.name}`)

    // Step 2: 调用 TTS 服务（优先使用 mock 模式）
    let ttsResult: { audioPath: string; duration: number }
    try {
      if (process.env.TTS_PROVIDER === 'tencent') {
        ttsResult = await callTencentTTS(script, voiceId)
      } else {
        ttsResult = await mockTTS(script, voiceId)
      }
    } catch (ttsError) {
      console.log('[Pipeline] TTS 服务不可用，使用 mock 模式')
      ttsResult = await mockTTS(script, voiceId)
    }

    console.log(`[Pipeline] 步骤2完成: TTS 音频生成, 时长=${safeToFixed(ttsResult.duration, 1)}s`)

    // Step 3: 调用口型驱动服务
    let lipSyncResult: { videoPath: string; duration: number }
    try {
      lipSyncResult = await mockLipSync(avatarUrl, ttsResult.audioPath, background)
    } catch (lipError) {
      console.log('[Pipeline] 口型驱动服务不可用，使用 mock 模式')
      lipSyncResult = await mockLipSync(avatarUrl, ttsResult.audioPath, background)
    }

    console.log(`[Pipeline] 步骤3完成: 口型驱动视频合成, 时长=${safeToFixed(lipSyncResult.duration, 1)}s`)

    // Step 4: 上传到 COS
    let uploadResult: { url: string }
    try {
      uploadResult = await mockUploadToCOS(lipSyncResult.videoPath)
    } catch (uploadError) {
      console.log('[Pipeline] COS 上传失败，使用 mock URL')
      uploadResult = await mockUploadToCOS(lipSyncResult.videoPath)
    }

    console.log(`[Pipeline] 步骤4完成: 视频上传, URL=${uploadResult.url}`)

    // Step 5: 创建视频记录并扣减额度
    const result = db.prepare(`
      INSERT INTO videos (
        user_id, title, script, avatar_id, voice_id, background,
        status, progress, url, thumbnail, duration, cost
      ) VALUES (?, ?, ?, ?, ?, ?, 'completed', 100, ?, ?, ?, 1)
    `).run(
      req.user!.id,
      `口播视频_${Date.now()}`,
      script,
      avatarId,
      voiceId || null,
      background || '',
      uploadResult.url,
      avatarUrl, // 用形象图片作为封面
      lipSyncResult.duration
    )

    const videoId = result.lastInsertRowid as number

    console.log(`[Pipeline] 完成: videoId=${videoId}, duration=${safeToFixed(lipSyncResult.duration, 1)}s`)

    // 返回结果
    res.json({
      success: true,
      videoId,
      videoUrl: uploadResult.url,
      duration: Math.round(lipSyncResult.duration),
      message: '视频生成成功'
    })

  } catch (error: any) {
    console.error('[Pipeline] 视频生成失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '视频生成失败'
    })
  }
})

/**
 * GET /api/pipeline/status/:videoId
 * 查询视频生成状态
 */
router.get('/status/:videoId', authenticate, (req: AuthRequest, res: Response) => {
  const { videoId } = req.params

  const video = db.prepare(`
    SELECT id, status, progress, url, thumbnail, duration, error
    FROM videos 
    WHERE id = ? AND user_id = ?
  `).get(videoId, req.user!.id) as any

  if (!video) {
    return res.status(404).json({ success: false, message: '视频不存在' })
  }

  res.json({
    success: true,
    videoId: video.id,
    status: video.status,
    progress: video.progress,
    url: video.url,
    thumbnail: video.thumbnail,
    duration: video.duration,
    error: video.error
  })
})

/**
 * GET /api/pipeline/providers
 * 查看可用的服务提供商（调试用）
 */
router.get('/providers', (req, res) => {
  res.json({
    success: true,
    providers: {
      tts: {
        mode: process.env.TTS_PROVIDER || 'mock',
        available: process.env.TTS_PROVIDER === 'tencent' || !process.env.TTS_PROVIDER
      },
      lipsync: {
        mode: 'mock',
        available: true
      },
      cos: {
        configured: !!(config.cos.secretId && config.cos.bucket),
        available: true
      }
    }
  })
})

export default router