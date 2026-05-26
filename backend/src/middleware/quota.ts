import { Response, NextFunction } from 'express'
import db from '../db/index.js'
import { AuthRequest } from './auth.js'

export function checkQuota(required: number = 1) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: '请先登录' })
    }

    // 企业版无限制
    if (req.user.plan === 'enterprise') {
      return next()
    }

    // 检查额度
    const user = db.prepare('SELECT credits FROM users WHERE id = ?').get(req.user.id) as { credits: number }

    if (user.credits < required) {
      return res.status(402).json({
        message: '额度不足，请升级套餐',
        credits: user.credits,
        required
      })
    }

    next()
  }
}

export function consumeQuota(userId: number, amount: number, reason: string, videoId?: number) {
  // 扣除额度
  db.prepare('UPDATE users SET credits = credits - ? WHERE id = ?').run(amount, userId)

  // 记录日志
  db.prepare(`
    INSERT INTO quota_logs (user_id, video_id, delta, reason)
    VALUES (?, ?, ?, ?)
  `).run(userId, videoId || null, -amount, reason)
}
