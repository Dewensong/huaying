import { Router, Response } from 'express'
import db from '../../db/index.js'
import { authenticate, AuthRequest } from '../../middleware/auth.js'
import { synthesizeSpeech } from '../../services/tts.service.js'
import { cloneVoice, getVoiceStatus, isVoiceCloneConfigured } from '../../services/voice-clone.service.js'
import { config } from '../../config/index.js'
import { exec } from 'child_process'
import { promisify } from 'util'
import axios from 'axios'
import path from 'path'
import fs from 'fs'
import os from 'os'

const execAsync = promisify(exec)

const router = Router()

// 获取声音列表
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { type, page = 1, pageSize = 20 } = req.query

  let where = 'WHERE (user_id = ? OR type = ?)'
  const params: any[] = [req.user!.id, 'preset']

  if (type && type !== 'all') {
    where = 'WHERE (user_id = ? OR type = ?)'
    params[0] = req.user!.id
    params[1] = 'preset'
    where += ' AND type = ?'
    params.push(String(type))
  }

  const offset = (Number(page) - 1) * Number(pageSize)

  const list = db.prepare(`
    SELECT id, user_id, name, audio, type, config, enabled, created_at
    FROM voices
    ${where}
    ORDER BY type DESC, created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(pageSize), offset)

  const total = db.prepare(`SELECT COUNT(*) as count FROM voices ${where}`).get(...params) as { count: number }

  const formattedList = list.map((item: any) => {
    const config = item.config ? JSON.parse(item.config) : {}
    return {
      id: item.id,
      user_id: item.user_id,
      name: item.name,
      audio: item.audio,
      type: item.type,
      config: config,
      enabled: item.enabled,
      created_at: item.created_at,
      // 提取 voice_type 到顶层，方便前端使用
      voice_type: config.voice_type || null,
      language: config.language || '中文',
      gender: config.gender || '通用'
    }
  })

  // 查询当前用户的克隆音色（状态为可用：2=训练成功, 4=激活成功）
  try {
    const clones = db.prepare(`
      SELECT id, speaker_id as voice_type, name, status, created_at
      FROM user_voice_clones
      WHERE user_id = ? AND (status = 2 OR status = 4)
      ORDER BY created_at DESC
    `).all(req.user!.id) as any[]

    // 将克隆音色转换为统一格式，添加到列表中
    const clonedVoices = clones.map(clone => ({
      id: clone.id,
      user_id: req.user!.id,
      name: clone.name,
      audio: null,
      type: 'cloned',
      config: {},
      enabled: true,
      created_at: clone.created_at,
      voice_type: clone.voice_type,
      language: '中文',
      gender: '克隆',
      source: 'cloned'  // 标记为克隆音色
    }))

    // 合并系统音色和克隆音色
    const allVoices = [...formattedList, ...clonedVoices]
    const totalWithClones = total.count + clonedVoices.length

    res.json({ list: allVoices, total: totalWithClones })
  } catch (error: any) {
    // 如果克隆音色查询失败，仍返回原有列表
    console.error('[Voice] 查询克隆音色失败:', error)
    res.json({ list: formattedList, total: total.count })
  }
})

// 创建声音
router.post('/', authenticate, (req: AuthRequest, res: Response) => {
  const { name, audio, type = 'custom', config = {} } = req.body

  if (!name) {
    return res.status(400).json({ message: '请输入声音名称' })
  }

  const result = db.prepare(`
    INSERT INTO voices (user_id, name, audio, type, config)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.user!.id, name, audio || '', type, JSON.stringify(config))

  const voice = db.prepare('SELECT * FROM voices WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(voice)
})

// 更新声音
router.patch('/:id', authenticate, (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { name, audio, config } = req.body

  const voice = db.prepare('SELECT * FROM voices WHERE id = ? AND user_id = ?').get(id, req.user!.id)
  if (!voice) {
    return res.status(404).json({ message: '声音不存在' })
  }

  const updates: string[] = []
  const params: any[] = []

  if (name !== undefined) {
    updates.push('name = ?')
    params.push(name)
  }

  if (audio !== undefined) {
    updates.push('audio = ?')
    params.push(audio)
  }

  if (config !== undefined) {
    updates.push('config = ?')
    params.push(typeof config === 'string' ? config : JSON.stringify(config))
  }

  if (updates.length > 0) {
    updates.push('updated_at = datetime(\'now\')')
    params.push(id)
    db.prepare(`UPDATE voices SET ${updates.join(', ')} WHERE id = ?`).run(...params)
  }

  res.json(db.prepare('SELECT * FROM voices WHERE id = ?').get(id))
})

// 删除声音
router.delete('/:id', authenticate, (req: AuthRequest, res: Response) => {
  const { id } = req.params

  const voice = db.prepare('SELECT * FROM voices WHERE id = ?').get(id) as any

  if (!voice) {
    return res.status(404).json({ message: '声音不存在' })
  }

  if (voice.type === 'preset') {
    return res.status(403).json({ message: '系统预设声音无法删除' })
  }

  if (voice.user_id !== req.user!.id) {
    return res.status(403).json({ message: '无权删除此声音' })
  }

  db.prepare('DELETE FROM voices WHERE id = ?').run(id)
  res.json({ message: '删除成功' })
})

// ============ 声音克隆接口 ============

// 时长限制（秒）
const MIN_AUDIO_DURATION = 10
const MAX_AUDIO_DURATION = 30

/**
 * 获取音频时长（秒）
 */
async function getAudioDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    )
    return parseFloat(stdout.trim()) || 0
  } catch {
    return 0
  }
}

/**
 * 音频转 base64
 */
function fileToBase64(filePath: string): string {
  return fs.readFileSync(filePath).toString('base64')
}

/**
 * POST /api/core/voices/clone
 * 克隆声音：上传音频文件，提交训练
 */
router.post('/clone', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, speakerId, audioUrl, audioFormat = 'mp3', language = 0 } = req.body
    
    if (!name) {
      return res.status(400).json({ message: '请输入音色名称' })
    }
    
    if (!speakerId) {
      return res.status(400).json({ message: '请输入音色资源 ID (speaker_id)' })
    }

    if (!audioUrl) {
      return res.status(400).json({ message: '请上传音频文件' })
    }

    // 检查服务是否配置
    if (!isVoiceCloneConfigured()) {
      return res.status(503).json({ 
        message: '声音克隆服务未配置，请联系管理员配置 VOLCANO_SPEECH_API_KEY' 
      })
    }

    // 下载音频文件到临时目录
    const tempDir = path.join(os.tmpdir(), 'voice-clone')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    
    const tempFile = path.join(tempDir, `sample_${Date.now()}.${audioFormat}`)
    
    // 处理音频 URL
    let downloadUrl = audioUrl
    if (downloadUrl.startsWith('/api/static/')) {
      // 本地文件
      const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3001}`
      downloadUrl = baseUrl + downloadUrl
    }

    // 下载音频
    try {
      const audioResponse = await axios.get(downloadUrl, { 
        responseType: 'arraybuffer',
        timeout: 30000
      })
      fs.writeFileSync(tempFile, Buffer.from(audioResponse.data))
    } catch (downloadError: any) {
      console.error('[VoiceClone] 音频下载失败:', downloadError.message)
      return res.status(400).json({ 
        message: `音频下载失败，请检查文件是否可访问: ${downloadError.message}` 
      })
    }
    
    console.log('[VoiceClone] 音频已下载:', tempFile)

    // 检查音频时长
    const duration = await getAudioDuration(tempFile)
    console.log('[VoiceClone] 音频时长:', duration, '秒')
    
    // 如果获取时长失败（ffprobe 不可用），假设时长正常
    if (duration > 0 && duration < MIN_AUDIO_DURATION) {
      fs.unlinkSync(tempFile)
      return res.status(400).json({ 
        message: `音频时长不足，最少需要 ${MIN_AUDIO_DURATION} 秒` 
      })
    }
    
    if (duration > MAX_AUDIO_DURATION) {
      fs.unlinkSync(tempFile)
      return res.status(400).json({ 
        message: `音频时长过长，最多支持 ${MAX_AUDIO_DURATION} 秒` 
      })
    }

    // 转换音频为 base64
    const audioBase64 = fileToBase64(tempFile)
    
    // 清理临时文件
    fs.unlinkSync(tempFile)

    // 调用克隆接口
    const result = await cloneVoice({
      speakerId,
      audioBase64,
      audioFormat,
      language
    })

    if (!result.success) {
      return res.status(400).json({ message: result.message })
    }

    // 保存到数据库
    const insertResult = db.prepare(`
      INSERT INTO user_voice_clones (user_id, speaker_id, name, status, sample_duration, language)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.user!.id, speakerId, name, 1, Math.round(duration), language)

    console.log('[VoiceClone] 音色克隆记录已保存:', insertResult.lastInsertRowid)

    res.status(201).json({
      success: true,
      message: '音色训练已提交，请稍后刷新查看训练状态',
      data: {
        id: insertResult.lastInsertRowid,
        speakerId,
        name,
        status: 1,
        statusText: '训练中'
      }
    })
  } catch (error: any) {
    console.error('[VoiceClone] 克隆失败:', error)
    res.status(500).json({ message: error.message || '克隆失败' })
  }
})

/**
 * GET /api/core/voices/clone-list
 * 获取当前用户的所有克隆音色
 */
router.get('/clone-list', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // 从数据库获取用户的所有克隆音色
    const clones = db.prepare(`
      SELECT id, speaker_id, name, status, sample_duration, language, created_at
      FROM user_voice_clones
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(req.user!.id) as any[]

    // 查询每个音色的在线状态
    const result = await Promise.all(clones.map(async (clone) => {
      const voiceStatus = await getVoiceStatus(clone.speaker_id)
      
      // 更新本地数据库状态（如果在线状态不同步）
      if (clone.status !== voiceStatus.status) {
        db.prepare('UPDATE user_voice_clones SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
          .run(voiceStatus.status, clone.id)
      }

      return {
        id: clone.id,
        speakerId: clone.speaker_id,
        name: clone.name,
        status: voiceStatus.status,
        statusText: voiceStatus.statusText,
        isReady: voiceStatus.isReady,
        sampleDuration: clone.sample_duration,
        language: clone.language,
        createdAt: clone.created_at
      }
    }))

    res.json({ list: result, total: result.length })
  } catch (error: any) {
    console.error('[VoiceClone] 获取克隆列表失败:', error)
    res.status(500).json({ message: error.message || '获取列表失败' })
  }
})

/**
 * GET /api/core/voices/clone/:speakerId/status
 * 查询指定音色的训练状态
 */
router.get('/clone/:speakerId/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { speakerId } = req.params

    // 验证音色归属
    const clone = db.prepare(`
      SELECT * FROM user_voice_clones WHERE speaker_id = ? AND user_id = ?
    `).get(speakerId, req.user!.id) as any

    if (!clone) {
      return res.status(404).json({ message: '音色不存在' })
    }

    // 查询在线状态
    const voiceStatus = await getVoiceStatus(speakerId)

    // 更新本地状态
    if (clone.status !== voiceStatus.status) {
      db.prepare('UPDATE user_voice_clones SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run(voiceStatus.status, clone.id)
    }

    res.json({
      speakerId,
      name: clone.name,
      status: voiceStatus.status,
      statusText: voiceStatus.statusText,
      isReady: voiceStatus.isReady
    })
  } catch (error: any) {
    console.error('[VoiceClone] 查询状态失败:', error)
    res.status(500).json({ message: error.message || '查询失败' })
  }
})

/**
 * DELETE /api/core/voices/clone/:speakerId
 * 删除克隆音色关联
 */
router.delete('/clone/:speakerId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { speakerId } = req.params

    // 验证音色归属
    const clone = db.prepare(`
      SELECT * FROM user_voice_clones WHERE speaker_id = ? AND user_id = ?
    `).get(speakerId, req.user!.id) as any

    if (!clone) {
      return res.status(404).json({ message: '音色不存在' })
    }

    // 从数据库删除
    db.prepare('DELETE FROM user_voice_clones WHERE speaker_id = ?').run(speakerId)

    res.json({ message: '删除成功' })
  } catch (error: any) {
    console.error('[VoiceClone] 删除失败:', error)
    res.status(500).json({ message: error.message || '删除失败' })
  }
})

// ============ 声音试听接口 ============

// 试听文本
const PREVIEW_TEXT = '欢迎使用话映数字人配音系统。我是你的专属虚拟主播，拥有清晰流畅的语音合成能力，可以为你录制专业级口播视频，让内容创作更高效、更生动。'

/**
 * POST /api/core/voices/preview
 * 试听声音效果（生成短音频）
 */
router.post('/preview', authenticate, async (req: AuthRequest, res: Response) => {
  const { voiceId, voiceType } = req.body

  // 获取音色类型
  let finalVoiceType = voiceType
  
  if (!finalVoiceType && voiceId) {
    // 先查询 voices 表
    const voice = db.prepare('SELECT config FROM voices WHERE id = ?').get(voiceId) as any
    if (voice && voice.config) {
      const voiceConfig = JSON.parse(voice.config)
      finalVoiceType = voiceConfig.voice_type
    }
    
    // 如果没找到，查询克隆音色表
    if (!finalVoiceType) {
      const clone = db.prepare('SELECT speaker_id FROM user_voice_clones WHERE id = ?').get(voiceId) as any
      if (clone) {
        finalVoiceType = clone.speaker_id
      }
    }
  }

  if (!finalVoiceType) {
    return res.status(400).json({ message: '请提供音色类型 (voice_type)' })
  }

  console.log(`[Voice/Preview] voiceId=${voiceId}, voiceType=${finalVoiceType}`)

  try {
    const result = await synthesizeSpeech({
      text: PREVIEW_TEXT,
      voiceType: finalVoiceType,
      speedRatio: 0.9,
      volumeRatio: 1.0
    })

    if (!result.success) {
      return res.status(500).json({ message: result.error || '音频生成失败' })
    }

    // 构建完整的音频 URL
    let audioUrl = result.audioUrl || ''
    if (audioUrl && !audioUrl.startsWith('http')) {
      // 如果是本地路径（/api/static/tts/xxx.mp3），直接使用静态文件服务路径
      if (audioUrl.startsWith('/api/static/')) {
        const baseUrl = (process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, '')
        audioUrl = `${baseUrl}${audioUrl}`
      } else if (audioUrl.startsWith('/tts/') || audioUrl.startsWith('tts/')) {
        // 如果是 COS 相对路径（tts/xxx.mp3），构造完整的 CDN URL
        const cdnDomain = config.cos.cdnDomain
        const bucket = config.cos.bucket
        const region = config.cos.region
        const cdnBase = cdnDomain 
          ? `https://${cdnDomain}` 
          : `https://${bucket}.cos.${region}.myqcloud.com`
        const cleanPath = audioUrl.startsWith('/') ? audioUrl : `/${audioUrl}`
        audioUrl = `${cdnBase}${cleanPath}`
      } else {
        // 其他情况，使用静态文件服务
        const baseUrl = (process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, '')
        audioUrl = `${baseUrl}/api/static${audioUrl.startsWith('/') ? audioUrl : `/${audioUrl}`}`
      }
    }

    res.json({
      success: true,
      audioUrl,
      duration: result.duration,
      message: '试听音频生成成功'
    })
  } catch (error: any) {
    console.error('[Voice/Preview] 试听失败:', error)
    res.status(500).json({ message: error.message || '试听生成失败' })
  }
})

export default router
