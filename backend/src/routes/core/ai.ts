/**
 * AI 能力接口
 * 提供 AI 生成形象等功能的 API
 */

import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../../middleware/auth.js'
import db from '../../db/index.js'
import { generateImage, isSeedreamConfigured, getFreeQuota } from '../../services/seedream.service.js'

const router = Router()

/**
 * POST /api/core/ai/generate-avatar
 * 使用 AI 生成数字人形象图片
 */
router.post('/generate-avatar', authenticate, async (req: AuthRequest, res: Response) => {
  const { prompt, style, name } = req.body

  // 参数验证
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ message: '请提供形象描述提示词' })
  }

  if (prompt.length < 5) {
    return res.status(400).json({ message: '形象描述太短，请提供更详细的描述' })
  }

  if (prompt.length > 500) {
    return res.status(400).json({ message: '形象描述太长，请控制在 500 字以内' })
  }

  try {
    console.log(`[AI Avatar] 用户 ${req.user!.id} 请求生成形象，提示词: ${prompt}, 风格: ${style}`)

    // 检查 Seedream API 是否配置
    if (!isSeedreamConfigured()) {
      return res.status(503).json({ 
        message: 'AI 生成服务暂未配置，请联系管理员配置火山方舟 API Key' 
      })
    }

    // 生成图片
    const result = await generateImage(prompt, {
      prompt,
      style,
      size: '1024x1024',
      n: 1,
      userId: req.user!.id
    })

    if (!result.success || !result.imageUrl) {
      return res.status(500).json({ 
        message: result.error || '生成图片失败' 
      })
    }

    // 在 avatars 表中创建记录
    const avatarName = name || `AI形象_${new Date().toLocaleDateString('zh-CN')}`
    const config = {
      source: 'ai_generated',
      prompt,
      style,
      generated_at: new Date().toISOString()
    }

    const insertResult = db.prepare(`
      INSERT INTO avatars (user_id, name, image, type, config)
      VALUES (?, ?, ?, 'custom', ?)
    `).run(
      req.user!.id,
      avatarName,
      result.imageUrl,
      JSON.stringify(config)
    )

    // 获取创建的形象记录
    const avatar = db.prepare('SELECT * FROM avatars WHERE id = ?').get(insertResult.lastInsertRowid)

    console.log(`[AI Avatar] 用户 ${req.user!.id} 形象生成成功，avatar_id: ${insertResult.lastInsertRowid}`)

    res.status(201).json({
      message: '形象生成成功',
      avatar,
      imageUrl: result.imageUrl,
      freeQuota: getFreeQuota()
    })

  } catch (error) {
    console.error('[AI Avatar] 生成形象失败:', error)
    res.status(500).json({ 
      message: '生成形象失败', 
      error: (error as Error).message 
    })
  }
})

/**
 * GET /api/core/ai/status
 * 获取 AI 服务状态
 */
router.get('/status', authenticate, (req: AuthRequest, res: Response) => {
  res.json({
    seedreamConfigured: isSeedreamConfigured(),
    freeQuota: getFreeQuota(),
    features: {
      avatarGeneration: isSeedreamConfigured()
    }
  })
})

export default router
