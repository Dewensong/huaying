import { Router, Response } from 'express'
import db from '../../db/index.js'
import { authenticate, AuthRequest } from '../../middleware/auth.js'
import { 
  createVideoRecord, 
  processVideoAsync 
} from '../../services/video-pipeline.service.js'

const router = Router()

// ============ 视频生产流水线 ============

/**
 * POST /api/core/videos/create
 * 视频生产流水线接口
 * 支持的配置：
 * - avatarId: 形象ID
 * - script: 文案内容
 * - title: 视频标题（用于封面显示）
 * - voiceId: 声音ID
 * - voiceType: 音色类型
 * - background: 背景配置 { type: 'color'|'image', value: string }
 * - subtitleConfig: 字幕配置 { fontSize: number, fontColor: string }
 */
router.post('/create', authenticate, checkQuota(1), async (req: AuthRequest, res: Response) => {
  const {
    avatarId,
    script,
    title,
    voiceId,
    voiceType,
    background,
    subtitleConfig,
    mode = 'static'  // 视频生成模式：static=静态合成, digital_human=数字人口播
  } = req.body

  // 参数校验
  if (!avatarId) {
    return res.status(400).json({ success: false, message: '请选择数字人形象' })
  }
  if (!script || script.trim() === '') {
    return res.status(400).json({ success: false, message: '文案内容不能为空' })
  }

  // 校验 mode 参数
  if (mode && !['static', 'digital_human'].includes(mode)) {
    return res.status(400).json({ success: false, message: '无效的 mode 参数，支持: static, digital_human' })
  }

  try {
    // 如果没有直接传入 voiceType，但有 voiceId，从数据库查询 voice_type
    let finalVoiceType = voiceType
    if (!finalVoiceType && voiceId) {
      const voice = db.prepare('SELECT config FROM voices WHERE id = ?').get(voiceId) as any
      if (voice && voice.config) {
        const voiceConfig = JSON.parse(voice.config)
        finalVoiceType = voiceConfig.voice_type
      }
    }

    console.log(`[Video/Create] mode=${mode}, voiceId=${voiceId}, voiceType=${finalVoiceType}`)
    console.log(`[Video/Create] 背景配置:`, background)
    console.log(`[Video/Create] 字幕配置:`, subtitleConfig)

    // 创建视频记录（状态为 processing）
    const videoId = createVideoRecord({
      userId: req.user!.id,
      script: script.trim(),
      title: title || '',
      avatarId,
      voiceId: voiceId || undefined,
      background: background || '',
      status: 'processing',
      mode
    })

    console.log(`[Video/Create] 创建视频任务: videoId=${videoId}, mode=${mode}`)

    // 异步执行视频合成（后台处理），传递所有配置
    processVideoAsync(videoId, {
      userId: req.user!.id,
      avatarId,
      script: script.trim(),
      title: title || '',
      voiceType: finalVoiceType,
      backgroundType: background?.type,
      backgroundValue: background?.value,
      subtitleFontSize: subtitleConfig?.fontSize,
      subtitleFontColor: subtitleConfig?.fontColor,
      mode
    })

    // 立即返回（不等待合成完成）
    res.json({
      success: true,
      message: mode === 'digital_human' ? '数字人口播视频任务已提交' : '视频生成任务已提交',
      videoId,
      status: 'processing',
      mode
    })

  } catch (error: any) {
    console.error('[Video/Create] 创建失败:', error)
    
    // 如果是数字人模式未配置的错误，返回明确提示
    if (error.message.includes('未配置') && error.message.includes('数字人')) {
      return res.status(503).json({
        success: false,
        message: '动态数字人服务未配置，请联系管理员',
        error: error.message
      })
    }
    
    res.status(500).json({
      success: false,
      message: error.message || '创建视频失败'
    })
  }
})

// ============ 原有路由 ============

// 获取视频列表
router.get('/', authenticate, (req: AuthRequest, res: Response) => {
  const { status, page = 1, pageSize = 20 } = req.query
  const offset = (Number(page) - 1) * Number(pageSize)

  let where = 'WHERE user_id = ?'
  const params: any[] = [req.user!.id]

  if (status) {
    where += ' AND status = ?'
    params.push(status)
  }

  const list = db.prepare(`
    SELECT id, title, script, avatar_id, voice_id, background,
           subtitle_config,
           thumbnail, url, subtitle_url, status, progress, error, created_at, completed_at
    FROM videos
    ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(pageSize), offset)

  const total = db.prepare(`SELECT COUNT(*) as count FROM videos ${where}`).get(...params) as { count: number }

  // 统计各状态数量（用于调试看板分类）
  const statusCounts = {
    pending: (db.prepare(`SELECT COUNT(*) as count FROM videos WHERE user_id = ? AND status = 'pending'`).get(req.user!.id) as { count: number }).count,
    processing: (db.prepare(`SELECT COUNT(*) as count FROM videos WHERE user_id = ? AND status = 'processing'`).get(req.user!.id) as { count: number }).count,
    completed: (db.prepare(`SELECT COUNT(*) as count FROM videos WHERE user_id = ? AND status = 'completed'`).get(req.user!.id) as { count: number }).count,
    failed: (db.prepare(`SELECT COUNT(*) as count FROM videos WHERE user_id = ? AND status = 'failed'`).get(req.user!.id) as { count: number }).count
  }
  console.log(`[Video/List] 用户 ${req.user!.id} 视频统计:`, statusCounts)

  const formattedList = list.map((item: any) => {
    // 构建完整的视频URL
    let videoUrl = item.url || ''
    if (videoUrl && !videoUrl.startsWith('http')) {
      // 拼接 CDN 域名
      const cdnDomain = process.env.COS_CDN_DOMAIN
      const bucket = process.env.COS_BUCKET || 'zhishu-matrix-1408366115'
      const region = process.env.COS_REGION || 'ap-beijing'
      const cdnBase = cdnDomain 
        ? `https://${cdnDomain}` 
        : `https://${bucket}.cos.${region}.myqcloud.com`
      const normalizedKey = videoUrl.startsWith('/') ? videoUrl.slice(1) : videoUrl
      videoUrl = `${cdnBase}/${normalizedKey}`
    }

    // 字幕URL：直接返回 COS 对象键，前端通过 /api/core/cos/preview-url 获取访问地址
    const subtitleUrl = item.subtitle_url || ''

    // 解析配置
    let subtitleConfig = {}
    let background = null

    try {
      if (item.subtitle_config) subtitleConfig = JSON.parse(item.subtitle_config)
      if (item.background) {
        try {
          background = JSON.parse(item.background)
        } catch {
          background = item.background
        }
      }
    } catch (e) {}

    return {
      ...item,
      // 转换 snake_case 为 camelCase，方便前端使用
      createdAt: item.created_at,
      completedAt: item.completed_at,
      avatarId: item.avatar_id,
      voiceId: item.voice_id,
      mode: item.mode || 'static',
      video_source: item.video_source || 'static',
      background,
      video_url: videoUrl, // 添加完整的 video_url
      subtitleUrl, // 添加 subtitle_url
      subtitle_config: subtitleConfig
    }
  })

  res.json({ 
    list: formattedList, 
    total: total.count, 
    statusCounts,
    userPlan: req.user!.plan,
    userCredits: req.user!.credits
  })
})

// 创建视频任务
router.post('/', authenticate, checkQuota(1), (req: AuthRequest, res: Response) => {
  const { title, script, avatarId, voiceId, background, subtitleConfig } = req.body

  if (!script) {
    return res.status(400).json({ message: '文案不能为空' })
  }

  const result = db.prepare(`
    INSERT INTO videos (user_id, title, script, avatar_id, voice_id, background, subtitle_config, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    req.user!.id,
    title || '',
    script,
    avatarId || null,
    voiceId || null,
    background || '',
    JSON.stringify(subtitleConfig || {})
  )

  const videoId = result.lastInsertRowid as number
  consumeQuota(req.user!.id, 1, '创建视频', videoId)

  // 模拟视频生成处理
  simulateVideoProcessing(videoId)

  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(videoId)
  res.status(201).json(video)
})

// 批量创建视频
router.post('/batch', authenticate, checkQuota(100), async (req: AuthRequest, res: Response) => {
  const videos = req.body

  if (!Array.isArray(videos) || videos.length === 0) {
    return res.status(400).json({ message: '请提供视频数据' })
  }

  if (videos.length > 100) {
    return res.status(400).json({ message: '单次最多创建 100 个视频' })
  }

  // 检查额度
  if (req.user!.plan !== 'enterprise' && req.user!.credits < videos.length) {
    return res.status(402).json({ message: '额度不足', credits: req.user!.credits, required: videos.length })
  }

  const insertStmt = db.prepare(`
    INSERT INTO videos (user_id, title, script, avatar_id, voice_id, background, subtitle_config, status, mode, video_source)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `)

  const videoIds: number[] = []

  const transaction = db.transaction(() => {
    for (const video of videos) {
      const mode = video.mode || 'static'
      const result = insertStmt.run(
        req.user!.id,
        video.title || '',
        video.script,
        video.avatarId || null,
        video.voiceId || null,
        video.background || '',
        JSON.stringify(video.subtitleConfig || {}),
        mode,
        mode === 'digital_human' ? 'digital_human' : 'static'
      )
      videoIds.push(result.lastInsertRowid as number)
    }
  })

  transaction()

  // 扣除额度
  consumeQuota(req.user!.id, videos.length, '批量创建视频')

  // 异步执行真正的视频生成流水线
  videoIds.forEach((id, index) => {
    setTimeout(() => {
      const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(id) as any
      if (video) {
        // 解析背景配置
        let bgType: 'color' | 'image' | undefined, bgValue: string | undefined
        if (video.background) {
          try {
            const bg = JSON.parse(video.background)
            bgType = bg.type as 'color' | 'image'
            bgValue = bg.value
          } catch {
            bgValue = video.background
          }
        }
        processVideoAsync(id, {
          userId: req.user!.id,
          avatarId: video.avatar_id,
          script: video.script,
          backgroundType: bgType,
          backgroundValue: bgValue,
          mode: video.mode || 'static'
        })
      }
    }, index * 1000) // 每隔 1 秒处理一个，避开并发 TTS 调用
  })

  const created = videoIds.map(id => db.prepare('SELECT * FROM videos WHERE id = ?').get(id))

  res.status(201).json(created)
})

// 获取视频详情
router.get('/:id', authenticate, (req: AuthRequest, res: Response) => {
  const { id } = req.params

  const video = db.prepare('SELECT * FROM videos WHERE id = ? AND user_id = ?').get(id, req.user!.id) as any

  if (!video) {
    return res.status(404).json({ message: '视频不存在' })
  }

  // 构建完整的视频详情响应
  const videoUrl = video.url || ''
  
  // 构建 COS 完整地址（如果 url 是 COS key，需要拼接 CDN 域名）
  let videoUrlFull = videoUrl
  if (videoUrl && !videoUrl.startsWith('http')) {
    // 拼接 CDN 域名
    const cdnDomain = process.env.COS_CDN_DOMAIN
    const bucket = process.env.COS_BUCKET || 'zhishu-matrix-1408366115'
    const region = process.env.COS_REGION || 'ap-beijing'
    const cdnBase = cdnDomain 
      ? `https://${cdnDomain}` 
      : `https://${bucket}.cos.${region}.myqcloud.com`
    const normalizedKey = videoUrl.startsWith('/') ? videoUrl.slice(1) : videoUrl
    videoUrlFull = `${cdnBase}/${normalizedKey}`
  }

  // 解析配置项
  let subtitleConfig = {}
  let background = null

  try {
    if (video.subtitle_config) subtitleConfig = JSON.parse(video.subtitle_config)
    if (video.background) {
      try {
        background = JSON.parse(video.background)
      } catch {
        background = video.background
      }
    }
  } catch (e) {
    console.error('[Video/Detail] 解析配置失败:', e)
  }

  res.json({
    id: video.id,
    title: video.title,
    script: video.script,
    // 模式
    mode: video.mode || 'static',
    video_source: video.video_source || 'static',
    // 形象和声音
    avatar_id: video.avatar_id,
    avatarId: video.avatar_id,
    voice_id: video.voice_id,
    voiceId: video.voice_id,
    // 配置项
    background,
    subtitle_config: subtitleConfig,
    // 视频状态
    status: video.status,
    video_url: videoUrlFull,
    url: video.url,
    duration: video.duration || 0,
    created_at: video.created_at,
    finished_at: video.completed_at,
    completed_at: video.completed_at,
    progress: video.progress,
    error: video.error,
    thumbnail: video.thumbnail,
    // 字幕
    subtitle_url: video.subtitle_url || '',
    subtitleUrl: video.subtitle_url || '',
    // 数字人任务ID
    digital_human_task_id: video.digital_human_task_id || null,
    // 用户套餐信息
    userPlan: req.user!.plan,
    userCredits: req.user!.credits
  })
})

// 更新视频
router.patch('/:id', authenticate, (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { title, url, thumbnail, status, progress } = req.body

  const video = db.prepare('SELECT * FROM videos WHERE id = ? AND user_id = ?').get(id, req.user!.id)
  if (!video) {
    return res.status(404).json({ message: '视频不存在' })
  }

  const updates: string[] = []
  const params: any[] = []

  if (title !== undefined) { updates.push('title = ?'); params.push(title) }
  if (url !== undefined) { updates.push('url = ?'); params.push(url) }
  if (thumbnail !== undefined) { updates.push('thumbnail = ?'); params.push(thumbnail) }
  if (status !== undefined) {
    updates.push('status = ?')
    params.push(status)
    if (status === 'completed') {
      updates.push("completed_at = datetime('now')")
    }
  }
  if (progress !== undefined) { updates.push('progress = ?'); params.push(progress) }

  if (updates.length > 0) {
    params.push(id)
    db.prepare(`UPDATE videos SET ${updates.join(', ')} WHERE id = ?`).run(...params)
  }

  res.json(db.prepare('SELECT * FROM videos WHERE id = ?').get(id))
})

// 重试失败视频
router.post('/:id/retry', authenticate, (req: AuthRequest, res: Response) => {
  const { id } = req.params

  const video = db.prepare('SELECT * FROM videos WHERE id = ? AND user_id = ?').get(id, req.user!.id) as any

  if (!video) {
    return res.status(404).json({ message: '视频不存在' })
  }

  if (video.status !== 'failed') {
    return res.status(400).json({ message: '只能重试失败的任务' })
  }

  // 获取视频创建时的 mode（static 或 digital_human）
  const mode = video.mode || 'static'
  console.log(`[Video/Retry] videoId=${id}, mode=${mode}`)

  db.prepare(`
    UPDATE videos SET status = 'pending', progress = 0, error = NULL WHERE id = ?
  `).run(id)

  // 执行真正的视频生成流水线
  // 解析背景配置
  let bgType: 'color' | 'image' | undefined, bgValue: string | undefined
  if (video.background) {
    try {
      const bg = JSON.parse(video.background)
      bgType = bg.type as 'color' | 'image'
      bgValue = bg.value
    } catch {
      bgValue = video.background
    }
  }

  // 解析字幕配置
  let subtitleConfig: { fontSize?: number; fontColor?: string } | undefined
  try {
    if (video.subtitle_config) subtitleConfig = JSON.parse(video.subtitle_config)
  } catch {}

  // 传递完整的参数，包括 mode
  processVideoAsync(Number(id), {
    userId: req.user!.id,
    avatarId: video.avatar_id,
    script: video.script,
    backgroundType: bgType,
    backgroundValue: bgValue,
    subtitleFontSize: subtitleConfig?.fontSize,
    subtitleFontColor: subtitleConfig?.fontColor,
    mode: mode as 'static' | 'digital_human'
  })

  res.json({ message: '已重新提交', mode })
})

// 删除视频
router.delete('/:id', authenticate, (req: AuthRequest, res: Response) => {
  const { id } = req.params

  const video = db.prepare('SELECT * FROM videos WHERE id = ? AND user_id = ?').get(id, req.user!.id)
  if (!video) {
    return res.status(404).json({ message: '视频不存在' })
  }

  db.prepare('DELETE FROM videos WHERE id = ?').run(id)
  res.json({ message: '删除成功' })
})

// 模拟视频生成处理
function simulateVideoProcessing(videoId: number) {
  // 更新为处理中
  db.prepare("UPDATE videos SET status = 'processing' WHERE id = ?").run(videoId)

  // 模拟进度更新
  let progress = 0
  const progressInterval = setInterval(() => {
    progress += Math.random() * 30
    if (progress >= 100) {
      progress = 100
      clearInterval(progressInterval)

      // 模拟成功率 95%
      const success = Math.random() < 0.95

      if (success) {
        db.prepare(`
          UPDATE videos SET status = 'completed', progress = 100, completed_at = datetime('now')
          WHERE id = ?
        `).run(videoId)
      } else {
        db.prepare(`
          UPDATE videos SET status = 'failed', progress = ?, error = '生成失败，请重试'
          WHERE id = ?
        `).run(Math.floor(progress), videoId)
      }
    } else {
      db.prepare('UPDATE videos SET progress = ? WHERE id = ?').run(Math.floor(progress), videoId)
    }
  }, 1000)
}

export default router
