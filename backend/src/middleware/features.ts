import { Request, Response, NextFunction } from 'express'
import { AuthRequest } from './auth.js'

// 套餐功能映射
const featurePlans: Record<string, string[]> = {
  voiceClone: ['studio', 'enterprise'],
  batchMode: ['studio', 'enterprise'],
  hdVideo: ['creator', 'studio', 'enterprise'],
  priority: ['studio', 'enterprise']
}

export function requireFeature(feature: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: '请先登录' })
    }

    const requiredPlans = featurePlans[feature]
    if (!requiredPlans) {
      return next()
    }

    if (!requiredPlans.includes(req.user.plan)) {
      return res.status(403).json({
        message: `此功能需要 ${requiredPlans.join('/')} 套餐`,
        code: 'FEATURE_NOT_AVAILABLE'
      })
    }

    next()
  }
}
