import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config/index.js'
import db from '../db/index.js'

export interface AuthRequest extends Request {
  user?: {
    id: number
    email: string
    phone?: string
    name: string
  }
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: '未授权访问' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as { userId: number }

    const user = db.prepare(`
      SELECT id, email, phone, name
      FROM users
      WHERE id = ?
    `).get(decoded.userId) as any

    if (!user) {
      return res.status(401).json({ message: '用户不存在' })
    }

    req.user = user
    next()
  } catch (error) {
    return res.status(401).json({ message: 'Token 无效或已过期' })
  }
}

// 可选认证（不强制要求登录）
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as { userId: number }
      const user = db.prepare(`
        SELECT id, email, phone, name, plan, credits, is_admin
        FROM users WHERE id = ?
      `).get(decoded.userId) as any

      if (user) {
        req.user = user
      }
    } catch {
      // 忽略错误，继续
    }
  }

  next()
}
