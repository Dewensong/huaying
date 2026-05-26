/**
 * 订单服务
 * 处理订单相关的业务逻辑
 */

import db from '../db/index.js'
import { getPlanById } from './plan.service.js'
import { addCredits } from './quota.service.js'

export interface Order {
  id: number
  user_id: number
  plan_id: number
  amount: number
  status: string
  payment_method: string
  created_at: string
  paid_at: string | null
}

/**
 * 创建订单
 */
export function createOrder(userId: number, planId: number): Order {
  const plan = getPlanById(planId)
  if (!plan) {
    throw new Error('套餐不存在或已下架')
  }

  const result = db.prepare(`
    INSERT INTO orders (user_id, plan_id, amount, status, payment_method)
    VALUES (?, ?, ?, 'unpaid', 'offline_transfer')
  `).run(userId, planId, plan.price)

  return db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid) as Order
}

/**
 * 获取用户订单列表
 */
export function getUserOrders(userId: number): Order[] {
  return db.prepare(`
    SELECT o.*, p.name as plan_name, p.credits
    FROM orders o
    LEFT JOIN plans p ON o.plan_id = p.id
    WHERE o.user_id = ?
    ORDER BY o.created_at DESC
  `).all(userId) as Order[]
}

/**
 * 确认订单收款
 */
export function confirmOrder(orderId: number): void {
  // 查询订单
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as (Order & { plan_id: number; user_id: number }) | undefined
  if (!order) {
    throw new Error('订单不存在')
  }

  if (order.status === 'paid') {
    throw new Error('订单已确认，无需重复操作')
  }

  // 查询套餐
  const plan = getPlanById(order.plan_id)
  if (!plan) {
    throw new Error('套餐不存在')
  }

  // 开始事务
  const transaction = db.transaction(() => {
    // 更新订单状态
    db.prepare(`
      UPDATE orders
      SET status = 'paid', paid_at = datetime('now')
      WHERE id = ?
    `).run(orderId)

    // 更新用户额度
    addCredits(order.user_id, plan.credits, plan.name, plan.duration_days)
  })

  transaction()
}

/**
 * 根据 ID 获取订单
 */
export function getOrderById(orderId: number): Order | undefined {
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Order | undefined
}
