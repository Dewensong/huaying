import { Router, Response } from 'express'
import db from '../../db/index.js'
import { authenticate, AuthRequest } from '../../middleware/auth.js'

const router = Router()

// 安全 JSON 解析辅助函数
function safeJsonParse(str: any): any {
  if (!str) return {}
  if (typeof str === 'object') return str
  try {
    return JSON.parse(str)
  } catch {
    return {}
  }
}

// 1. 获取模板列表
router.get('/', authenticate, (req: AuthRequest, res: Response) => {
  const { page = '1', pageSize = '20' } = req.query
  const offset = (Number(page) - 1) * Number(pageSize)
  const userId = req.user!.id

  const list = db.prepare(`
    SELECT t.*, a.name as avatar_name, a.image as avatar_image
    FROM templates t
    LEFT JOIN avatars a ON t.avatar_id = a.id
    WHERE t.user_id = ?
    ORDER BY t.created_at DESC
    LIMIT ? OFFSET ?
  `).all(userId, Number(pageSize), offset)

  const total = db.prepare('SELECT COUNT(*) as count FROM templates WHERE user_id = ?').get(userId) as { count: number }

  // 轻轻做一下 JSON 字段解析，避免前端报错
  const formattedList = (list as any[]).map((item: any) => ({
    ...item,
    subtitle_config: safeJsonParse(item.subtitle_config)
  }))

  res.json({ list: formattedList, total: total.count })
})

// 2. 创建模板
router.post('/', authenticate, (req: AuthRequest, res: Response) => {
  const { name, avatar_id, voice_type, speed_ratio, volume_ratio, background, subtitle_config } = req.body
  const userId = req.user!.id

  if (!name) {
    return res.status(400).json({ message: '请输入模板名称' })
  }

  // 确保所有值为 SQLite 可接受的类型
  const p1 = Number(userId)                    // user_id
  const p2 = String(name)                      // name
  const p3 = avatar_id ? Number(avatar_id) : null  // avatar_id
  const p4 = voice_type ? String(voice_type) : null // voice_type
  const p5 = Number(speed_ratio ?? 1.0)        // speed_ratio
  const p6 = Number(volume_ratio ?? 1.0)       // volume_ratio
  const p7 = String(background ?? '')           // background
  const p8 = String(JSON.stringify(subtitle_config ?? {})) // subtitle_config

  const result = db.prepare(`
    INSERT INTO templates (user_id, name, avatar_id, voice_type, speed_ratio, volume_ratio, background, subtitle_config)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(p1, p2, p3, p4, p5, p6, p7, p8)

  const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(result.lastInsertRowid) as any
  res.status(201).json(template)
})

// 3. 更新模板
router.patch('/:id', authenticate, (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { name, avatar_id, voice_type, speed_ratio, volume_ratio, background, subtitle_config } = req.body
  const userId = req.user!.id

  const template = db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?').get(id, userId)
  if (!template) {
    return res.status(404).json({ message: '模板不存在' })
  }

  // 使用数组参数，避免命名参数问题
  const params: any[] = []
  const sets: string[] = []
  
  if (name !== undefined) { sets.push('name = ?'); params.push(String(name)) }
  if (avatar_id !== undefined) { sets.push('avatar_id = ?'); params.push(avatar_id ? Number(avatar_id) : null) }
  if (voice_type !== undefined) { sets.push('voice_type = ?'); params.push(voice_type ? String(voice_type) : null) }
  if (speed_ratio !== undefined) { sets.push('speed_ratio = ?'); params.push(Number(speed_ratio)) }
  if (volume_ratio !== undefined) { sets.push('volume_ratio = ?'); params.push(Number(volume_ratio)) }
  if (background !== undefined) { sets.push('background = ?'); params.push(String(background)) }
  if (subtitle_config !== undefined) {
    sets.push('subtitle_config = ?')
    params.push(typeof subtitle_config === 'string' ? subtitle_config : JSON.stringify(subtitle_config))
  }

  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')")
    params.push(Number(id))
    db.prepare(`UPDATE templates SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  }

  const updated = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as any
  res.json(updated)
})

// 4. 删除模板
router.delete('/:id', authenticate, (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const userId = req.user!.id

  const template = db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?').get(id, userId)
  if (!template) {
    return res.status(404).json({ message: '模板不存在' })
  }

  db.prepare('DELETE FROM templates WHERE id = ? AND user_id = ?').run(id, userId)
  res.json({ message: '删除成功' })
})

export default router