/**
 * 额度服务
 * 处理用户额度相关的业务逻辑
 */

import db from '../db/index.js'

export interface QuotaStatus {
  credits: number
  plan: string
  planExpireAt: string | null
  isExpired: boolean
}

/**
 * 获取用户额度状态
 */
export function getUserQuota(userId: number): QuotaStatus {
  const user = db.prepare(`
    SELECT credits, plan, plan_expire_at
    FROM users
    WHERE id = ?
  `).get(userId) as { credits: number; plan: string; plan_expire_at: string | null } | undefined

  if (!user) {
    throw new Error('用户不存在')
  }

  // 检查套餐是否过期
  let isExpired = false
  if (user.plan_expire_at) {
    isExpired = new Date(user.plan_expire_at) < new Date()
  }

  return {
    credits: user.credits || 0,
    plan: user.plan || 'free',
    planExpireAt: user.plan_expire_at,
    isExpired
  }
}

/**
 * 增加用户额度（确认收款后调用）
 */
export function addCredits(userId: number, credits: number, plan: string, durationDays: number): void {
  const expireAt = new Date()
  expireAt.setDate(expireAt.getDate() + durationDays)

  db.prepare(`
    UPDATE users
    SET credits = credits + ?,
        plan = ?,
        plan_expire_at = ?
    WHERE id = ?
  `).run(credits, plan, expireAt.toISOString(), userId)
}

/**
 * 扣减用户额度（视频生成时调用）
 */
export function deductCredits(userId: number, amount: number): boolean {
  const user = db.prepare('SELECT credits FROM users WHERE id = ?').get(userId) as { credits: number } | undefined
  
  if (!user) {
    throw new Error('用户不存在')
  }

  if (user.credits < amount) {
    return false // 额度不足
  }

  db.prepare(`
    UPDATE users
    SET credits = credits - ?
    WHERE id = ?
  `).run(amount, userId)

  return true
}

/**
 * 检查用户额度是否充足
 */
export function hasEnoughCredits(userId: number, amount: number): boolean {
  const user = db.prepare('SELECT credits FROM users WHERE id = ?').get(userId) as { credits: number } | undefined
  
  if (!user) {
    return false
  }

  return user.credits >= amount
}
