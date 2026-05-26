import { Router, Response } from 'express'
import axios from 'axios'
import { config } from '../../config/index.js'
import db from '../../db/index.js'
import { authenticate, AuthRequest } from '../../middleware/auth.js'

const router = Router()

// 生成文案
router.post('/generate', authenticate, async (req: AuthRequest, res: Response) => {
  const { source, count = 3, style = 'professional', duration = 60 } = req.body

  if (!source) {
    return res.status(400).json({ message: '请提供产品描述' })
  }

  try {
    // 调用火山方舟 API
    const styleDescriptions = {
      professional: '专业正式，适合商务场景',
      casual: '轻松活泼，适合日常分享',
      concise: '简洁明了，直击要点',
      emotional: '情感丰富，打动人心'
    }

    const prompt = `你是一位专业的短视频文案撰写师。请根据以下产品描述，生成 ${count} 条口播文案。

产品描述：
${source}

文案风格：${styleDescriptions[style as keyof typeof styleDescriptions] || '专业正式'}
预估时长：约 ${duration} 秒

要求：
1. 每条文案独立成段
2. 开头要有吸引力，能抓住观众
3. 语言口语化，适合朗读
4. 突出产品核心卖点
5. 结尾要有引导性（如"点击下方链接"等）

请直接输出 ${count} 条文案，用"---"分隔，不要加序号：`

    const response = await axios.post(
      config.ark.apiEndpoint,
      {
        model: config.ark.model,
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 2000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.ark.apiKey}`
        },
        timeout: config.thirdPartyTimeout
      }
    )

    const content = response.data.choices?.[0]?.message?.content || ''
    const scripts = content.split('---').map((s: string) => s.trim()).filter((s: string) => s.length > 0)

    res.json({ scripts })
  } catch (error: any) {
    console.error('AI 生成失败:', error.message)
    res.status(500).json({ message: 'AI 生成失败，请稍后重试' })
  }
})

// 获取文案列表
router.get('/', authenticate, (req: AuthRequest, res: Response) => {
  const { page = 1, pageSize = 20 } = req.query
  const offset = (Number(page) - 1) * Number(pageSize)

  const list = db.prepare(`
    SELECT id, title, content, source, style, created_at
    FROM scripts
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(req.user!.id, Number(pageSize), offset)

  const total = db.prepare('SELECT COUNT(*) as count FROM scripts WHERE user_id = ?').get(req.user!.id) as { count: number }

  res.json({ list, total: total.count })
})

// 保存文案
router.post('/', authenticate, (req: AuthRequest, res: Response) => {
  const { content, title, source, style } = req.body

  if (!content) {
    return res.status(400).json({ message: '文案内容不能为空' })
  }

  const result = db.prepare(`
    INSERT INTO scripts (user_id, title, content, source, style)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.user!.id, title || '', content, source || '', style || '')

  const script = db.prepare('SELECT * FROM scripts WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(script)
})

// 更新文案
router.patch('/:id', authenticate, (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { content, title } = req.body

  const script = db.prepare('SELECT * FROM scripts WHERE id = ? AND user_id = ?').get(id, req.user!.id)
  if (!script) {
    return res.status(404).json({ message: '文案不存在' })
  }

  const updates: string[] = []
  const params: any[] = []

  if (content !== undefined) {
    updates.push('content = ?')
    params.push(content)
  }

  if (title !== undefined) {
    updates.push('title = ?')
    params.push(title)
  }

  if (updates.length > 0) {
    updates.push('updated_at = datetime("now")')
    params.push(id)
    db.prepare(`UPDATE scripts SET ${updates.join(', ')} WHERE id = ?`).run(...params)
  }

  res.json(db.prepare('SELECT * FROM scripts WHERE id = ?').get(id))
})

// 删除文案
router.delete('/:id', authenticate, (req: AuthRequest, res: Response) => {
  const { id } = req.params

  const script = db.prepare('SELECT * FROM scripts WHERE id = ? AND user_id = ?').get(id, req.user!.id)
  if (!script) {
    return res.status(404).json({ message: '文案不存在' })
  }

  db.prepare('DELETE FROM scripts WHERE id = ?').run(id)
  res.json({ message: '删除成功' })
})

export default router
