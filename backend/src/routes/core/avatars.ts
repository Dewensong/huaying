import { Router, Response } from 'express'
import db from '../../db/index.js'
import { authenticate, AuthRequest } from '../../middleware/auth.js'
import { generateCoverImage, fixAllMissingImages } from '../../utils/avatar-cover.js'
import { uploadBufferToCOS } from '../../config/cos.js'

const router = Router()

// 获取预设形象列表（无需登录）
// 注意：已废弃，预设形象已全部删除，此接口返回空列表
router.get('/presets', (req: AuthRequest, res: Response) => {
  try {
    // 返回空列表 - 预设形象已全部删除
    res.json({ list: [], total: 0, message: '预设形象已取消，所有形象需用户自行创建' })
  } catch (error) {
    console.error('获取预设形象失败:', error)
    res.status(500).json({ message: '获取预设形象失败' })
  }
})

// 获取形象列表 - 只返回当前用户的形象（不再包含预设形象）
router.get('/', authenticate, (req: AuthRequest, res: Response) => {
  const { type, page = 1, pageSize = 20 } = req.query

  // 只查询当前用户创建的形象（type = 'custom' 且 user_id = 当前用户）
  let where = 'WHERE user_id = ? AND type = ?'
  const params: any[] = [req.user!.id, 'custom']

  if (type && type !== 'all') {
    where += ' AND type = ?'
    params.push(String(type))
  }

  const offset = (Number(page) - 1) * Number(pageSize)

  const list = db.prepare(`
    SELECT id, user_id, name, image, model_url, is_rigged, type, config, enabled, virtualman_key, image_url_no_bg, created_at
    FROM avatars
    ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(pageSize), offset)

  const total = db.prepare(`SELECT COUNT(*) as count FROM avatars ${where}`).get(...params) as { count: number }

  // 解析 JSON 配置
  const formattedList = list.map((item: any) => ({
    id: item.id,
    name: item.name,
    image: item.image,
    image_url: item.image, // 兼容字段
    image_url_no_bg: item.image_url_no_bg, // 抠图后的透明背景图片
    type: item.type,
    model_url: item.model_url,
    is_rigged: item.is_rigged,
    virtualman_key: item.virtualman_key,
    config: item.config ? JSON.parse(item.config) : {},
    enabled: item.enabled === 1, // 转换为布尔值
    created_at: item.created_at
  }))

  console.log(`[Avatars API] 返回形象列表: count=${formattedList.length}, userId=${req.user!.id}, type=${type || 'all'}`)

  res.json({ list: formattedList, total: total.count })
})

// 创建形象
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, image, description, type = 'custom', config = {} } = req.body

    if (!name) {
      return res.status(400).json({ message: '请输入形象名称' })
    }

    if (!image) {
      return res.status(400).json({ message: '请上传形象图片' })
    }

    // 处理图片上传到 COS
    let imageUrl = image
    try {
      // 检查 image 是否是 base64 数据
      if (image.startsWith('data:image')) {
        const base64Data = image.split(',')[1]
        const buffer = Buffer.from(base64Data, 'base64')
        const timestamp = Date.now()
        const fileName = `avatar_${req.user!.id}_${timestamp}.png`
        const cosKey = `avatars/custom/${fileName}`
        
        imageUrl = await uploadBufferToCOS(buffer, cosKey, 'image/png')
        console.log(`[Avatar API] 图片已上传到 COS: ${imageUrl}`)
      } else if (image.startsWith('http')) {
        // 如果已经是完整 URL，直接使用
        imageUrl = image
      }
    } catch (uploadError) {
      console.error('[Avatar API] 图片上传 COS 失败:', uploadError)
      // 图片上传失败时使用原图 URL
    }

    // 合并描述到 config
    const finalConfig = {
      ...config,
      ...(description ? { description } : {})
    }

    const result = db.prepare(`
      INSERT INTO avatars (user_id, name, image, model_url, is_rigged, type, config, virtualman_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user!.id, 
      name, 
      imageUrl, 
      null,  // 不再支持 model_url
      0,     // 不再支持 is_rigged
      type, 
      JSON.stringify(finalConfig), 
      null   // 不再支持 virtualman_key
    )

    const avatarId = result.lastInsertRowid as number
    const avatar = db.prepare('SELECT * FROM avatars WHERE id = ?').get(avatarId) as any

    // 格式化返回
    const formattedAvatar = {
      ...avatar,
      image_url: avatar.image,
      config: avatar.config ? JSON.parse(avatar.config) : {}
    }

    console.log(`[Avatar API] 创建形象成功: ${name}, userId=${req.user!.id}`)

    res.status(201).json(formattedAvatar)
  } catch (error) {
    console.error('[Avatar API] 创建形象失败:', error)
    res.status(500).json({ message: '创建形象失败', error: (error as Error).message })
  }
})

// 更新形象
router.patch('/:id', authenticate, (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { name, image, model_url, is_rigged, config, virtualman_key, enabled, status } = req.body

  // 检查所有权
  const avatar = db.prepare('SELECT * FROM avatars WHERE id = ? AND user_id = ?').get(id, req.user!.id)
  if (!avatar) {
    return res.status(404).json({ message: '形象不存在' })
  }

  const updates: string[] = []
  const params: any[] = []

  if (name !== undefined) {
    updates.push('name = ?')
    params.push(name)
  }

  if (image !== undefined) {
    updates.push('image = ?')
    params.push(image)
  }

  if (model_url !== undefined) {
    updates.push('model_url = ?')
    params.push(model_url)
  }

  if (is_rigged !== undefined) {
    updates.push('is_rigged = ?')
    params.push(is_rigged)
  }

  if (config !== undefined) {
    updates.push('config = ?')
    params.push(typeof config === 'string' ? config : JSON.stringify(config))
  }

  if (virtualman_key !== undefined) {
    updates.push('virtualman_key = ?')
    params.push(virtualman_key || null)
  }

  if (enabled !== undefined) {
    // 接收布尔值或数值，转换为 0/1
    updates.push('enabled = ?')
    params.push(enabled ? 1 : 0)
  }

  if (status !== undefined) {
    updates.push('status = ?')
    params.push(status)
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')")
    params.push(id)
    db.prepare(`UPDATE avatars SET ${updates.join(', ')} WHERE id = ?`).run(...params)
  }

  const updated = db.prepare('SELECT * FROM avatars WHERE id = ?').get(id) as any
  res.json({
    ...updated,
    enabled: updated.enabled === 1, // 转换为布尔值
    image_url: updated.image
  })
})

// 删除形象
router.delete('/:id', authenticate, (req: AuthRequest, res: Response) => {
  const { id } = req.params

  // 检查所有权
  const avatar = db.prepare('SELECT * FROM avatars WHERE id = ?').get(id) as any

  if (!avatar) {
    return res.status(404).json({ message: '形象不存在' })
  }

  // 只能删除自己的形象
  if (avatar.user_id !== req.user!.id) {
    return res.status(403).json({ message: '无权删除此形象' })
  }

  // 不能删除预设形象（虽然预设形象已全部删除，但保留此检查以防万一）
  if (avatar.type === 'preset') {
    return res.status(403).json({ message: '系统预设形象无法删除' })
  }

  db.prepare('DELETE FROM avatars WHERE id = ?').run(id)
  console.log(`[Avatar API] 删除形象: id=${id}, userId=${req.user!.id}`)
  res.json({ message: '删除成功' })
})

// 为指定形象生成封面图
router.post('/:id/generate-cover', authenticate, async (req: AuthRequest, res: Response) => {
  const { id } = req.params

  try {
    const avatar = db.prepare('SELECT * FROM avatars WHERE id = ?').get(id) as any

    if (!avatar) {
      return res.status(404).json({ message: '形象不存在' })
    }

    console.log(`[Avatar API] 开始为形象 ${id} 生成封面图...`)

    const coverUrl = await generateCoverImage(Number(id))

    if (!coverUrl) {
      return res.status(500).json({ message: '生成封面图失败' })
    }

    // 获取更新后的形象记录
    const updatedAvatar = db.prepare('SELECT * FROM avatars WHERE id = ?').get(id)

    res.json({
      message: '封面图生成成功',
      avatar: updatedAvatar,
      coverUrl
    })
  } catch (error) {
    console.error(`[Avatar API] 生成封面图失败:`, error)
    res.status(500).json({ message: '生成封面图失败', error: (error as Error).message })
  }
})

// 批量修复所有缺失 image 的预设形象（管理员接口）
router.post('/fix-all-covers', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    console.log(`[Avatar API] 开始批量修复所有预设形象的封面图...`)

    const result = await fixAllMissingImages()

    res.json({
      message: '批量修复完成',
      ...result
    })
  } catch (error) {
    console.error(`[Avatar API] 批量修复失败:`, error)
    res.status(500).json({ message: '批量修复失败', error: (error as Error).message })
  }
})

export default router
