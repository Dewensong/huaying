import { Router, Response } from 'express'
import db from '../../db/index.js'
import { authenticate, AuthRequest } from '../../middleware/auth.js'

const router = Router()

// 获取看板统计
router.get('/stats', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id

  // 获取统计数据
  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM videos WHERE user_id = ? AND status IN ('pending', 'processing')) as pendingTasks,
      (SELECT COUNT(*) FROM videos WHERE user_id = ? AND status = 'completed' AND DATE(completed_at) = DATE('now')) as completedVideos,
      (SELECT COUNT(*) FROM videos WHERE user_id = ? AND DATE(created_at) = DATE('now')) as todayVideos
  `).get(userId, userId, userId) as any

  // 获取本月完成数
  const monthlyCompleted = db.prepare(`
    SELECT COUNT(*) as count FROM videos
    WHERE user_id = ? AND status = 'completed'
    AND completed_at >= DATE('now', 'start of month')
  `).get(userId) as { count: number }

  // 获取最近视频
  const recentVideos = db.prepare(`
    SELECT id, title, thumbnail, status, progress, created_at
    FROM videos
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 5
  `).all(userId)

  res.json({
    pendingTasks: stats?.pendingTasks || 0,
    monthlyVideos: monthlyCompleted?.count || 0,
    completedVideos: stats?.completedVideos || 0,
    todayVideos: stats?.todayVideos || 0,
    recentVideos
  })
})

export default router
