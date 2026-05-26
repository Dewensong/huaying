import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt, { SignOptions } from 'jsonwebtoken'
import NodeCache from 'node-cache'
import { config } from '../../config/index.js'
import db from '../../db/index.js'
import { authenticate, AuthRequest } from '../../middleware/auth.js'
import { sendVerificationCode, checkVerificationCode as verifyCode } from '../../services/sms.service.js'

const router = Router()

// 短信验证码缓存（5分钟有效期）
const codeCache = new NodeCache({ stdTTL: 300 })
// 发送频率缓存（60秒防刷）
const sendFrequencyCache = new NodeCache({ stdTTL: 60 })

// 注册
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, phone } = req.body

    if (!email || !password || !name) {
      return res.status(400).json({ message: '请填写必填字段' })
    }

    // 检查邮箱是否已存在
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
    if (existing) {
      return res.status(400).json({ message: '该邮箱已注册' })
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10)

    // 创建用户
    const result = db.prepare(`
      INSERT INTO users (email, password, name, phone, credits, plan)
      VALUES (?, ?, ?, ?, ?, 'free')
    `).run(email, hashedPassword, name, phone || null, config.business.freeCredits)

    const userId = result.lastInsertRowid as number

    // 创建订阅记录
    db.prepare(`
      INSERT INTO subscriptions (user_id, plan, start_date)
      VALUES (?, 'free', datetime('now'))
    `).run(userId)

    // 生成 Token
    const token = jwt.sign({ userId }, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as SignOptions)

    const user = db.prepare('SELECT id, email, phone, name, avatar, plan, credits FROM users WHERE id = ?').get(userId)

    res.status(201).json({ token, user })
  } catch (error) {
    console.error('注册失败:', error)
    res.status(500).json({ message: '注册失败' })
  }
})

// 登录
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, phone, password, code } = req.body

    // 邮箱登录
    if (email && password) {
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any

      if (!user) {
        return res.status(401).json({ message: '邮箱或密码错误' })
      }

      const validPassword = await bcrypt.compare(password, user.password)
      if (!validPassword) {
        return res.status(401).json({ message: '邮箱或密码错误' })
      }

      const token = jwt.sign({ userId: user.id }, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as SignOptions)

      const { password: _, ...userInfo } = user
      return res.json({ token, user: userInfo })
    }

    // 手机验证码登录
    if (phone && code) {
      // 直接调用阿里云校验验证码
      const verifyResult = await verifyCode(phone, code)

      if (!verifyResult.success) {
        return res.status(401).json({ message: verifyResult.message || '验证码错误' })
      }

      let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone) as any

      // 如果手机号未注册，自动创建账号
      if (!user) {
        const result = db.prepare(`
          INSERT INTO users (phone, name, credits, plan)
          VALUES (?, ?, ?, 'free')
        `).run(phone, `用户${phone.slice(-4)}`, config.business.freeCredits)

        db.prepare(`
          INSERT INTO subscriptions (user_id, plan, start_date)
          VALUES (?, 'free', datetime('now'))
        `).run(result.lastInsertRowid)

        user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid)
      }

      const token = jwt.sign({ userId: user.id }, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as SignOptions)
      const { password: _, ...userInfo } = user

      return res.json({ token, user: userInfo })
    }

    res.status(400).json({ message: '请提供邮箱密码或手机验证码' })
  } catch (error) {
    console.error('登录失败:', error)
    res.status(500).json({ message: '登录失败' })
  }
})

// 发送短信验证码
router.post('/send-sms', async (req: Request, res: Response) => {
  const { phone } = req.body

  if (!phone) {
    return res.status(400).json({ message: '请提供手机号' })
  }

  // 60秒防刷检查
  if (sendFrequencyCache.get(phone)) {
    return res.status(429).json({ message: '发送太频繁，请稍后再试' })
  }

  // 记录发送时间，60秒防刷
  sendFrequencyCache.set(phone, Date.now())

  // 调用阿里云发送短信（阿里云自动生成验证码）
  const result = await sendVerificationCode(phone, '')

  if (result.success) {
    res.json({ success: true, message: '验证码已发送' })
  } else {
    // 发送失败，删除缓存
    codeCache.del(phone)
    res.status(500).json({ success: false, message: result.message })
  }
})

// 获取当前用户信息
router.get('/me', authenticate, (req: AuthRequest, res: Response) => {
  res.json(req.user)
})

// 更新个人资料
router.patch('/profile', authenticate, (req: AuthRequest, res: Response) => {
  const { name, avatar } = req.body

  if (name) {
    db.prepare('UPDATE users SET name = ?, updated_at = datetime("now") WHERE id = ?').run(name, req.user!.id)
  }

  if (avatar) {
    db.prepare('UPDATE users SET avatar = ?, updated_at = datetime("now") WHERE id = ?').run(avatar, req.user!.id)
  }

  const user = db.prepare('SELECT id, email, phone, name, avatar, plan, credits FROM users WHERE id = ?').get(req.user!.id)
  res.json(user)
})

export default router
