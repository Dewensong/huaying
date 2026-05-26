/**
 * 套餐服务
 * 处理套餐相关的业务逻辑
 */

import db from '../db/index.js'

export interface Plan {
  id: number
  name: string
  price: number
  credits: number
  duration_days: number
  is_active: number
  created_at: string
}

/**
 * 获取所有可用套餐
 */
export function getActivePlans(): Plan[] {
  return db.prepare(`
    SELECT id, name, price, credits, duration_days
    FROM plans
    WHERE is_active = 1
    ORDER BY price ASC
  `).all() as Plan[]
}

/**
 * 根据 ID 获取套餐
 */
export function getPlanById(id: number): Plan | undefined {
  return db.prepare('SELECT * FROM plans WHERE id = ? AND is_active = 1').get(id) as Plan | undefined
}
