/**
 * API Key 鉴权中间件
 * 用于对外 API (v1) 的身份验证
 */

import { Request, Response, NextFunction } from 'express'
import db from '../db/index.js'

export interface ApiKeyAuthRequest extends Request {
  apiKeyInfo?: {
    id: number
    userId: number
    apiKey: string
    name: string
    quotaLimit: number
    quotaUsed: number
  }
}

/**
 * 验证 API Key
 */
export function verifyApiKey(req: ApiKeyAuthRequest, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string

  if (!apiKey) {
    return res.status(401).json({
      code: 401,
      message: '缺少 API Key，请通过 X-Api-Key Header 传递'
    })
  }

  // 查询 API Key
  const keyInfo = db.prepare(`
    SELECT id, user_id, name, quota_limit, quota_used, status, expires_at
    FROM api_keys
    WHERE api_key = ? AND status = 'active'
  `).get(apiKey) as any

  if (!keyInfo) {
    return res.status(401).json({
      code: 401,
      message: '无效的 API Key'
    })
  }

  // 检查是否过期
  if (keyInfo.expires_at) {
    const expiresAt = new Date(keyInfo.expires_at)
    if (expiresAt < new Date()) {
      return res.status(401).json({
        code: 401,
        message: 'API Key 已过期'
      })
    }
  }

  // 检查额度
  if (keyInfo.quota_limit > 0 && keyInfo.quota_used >= keyInfo.quota_limit) {
    return res.status(429).json({
      code: 429,
      message: 'API Key 额度已用完'
    })
  }

  // 更新最后使用时间
  db.prepare('UPDATE api_keys SET last_used_at = datetime("now") WHERE id = ?').run(keyInfo.id)

  // 附加用户信息到请求
  req.apiKeyInfo = {
    id: keyInfo.id,
    userId: keyInfo.user_id,
    apiKey: apiKey,
    name: keyInfo.name,
    quotaLimit: keyInfo.quota_limit,
    quotaUsed: keyInfo.quota_used
  }

  next()
}

/**
 * 消费 API Key 额度
 */
export function consumeApiKeyQuota(apiKeyId: number) {
  db.prepare('UPDATE api_keys SET quota_used = quota_used + 1 WHERE id = ?').run(apiKeyId)
}

/**
 * 生成新的 API Key
 */
export function generateApiKey(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 15)
  return `zbf_${timestamp}${random}`
}

/**
 * 创建 API Key
 */
export function createApiKey(userId: number, name: string, quotaLimit: number = 100, expiresAt?: Date): string {
  const apiKey = generateApiKey()

  db.prepare(`
    INSERT INTO api_keys (user_id, api_key, name, quota_limit, quota_used, status, expires_at)
    VALUES (?, ?, ?, ?, 0, 'active', ?)
  `).run(userId, apiKey, name, quotaLimit, expiresAt?.toISOString() || null)

  return apiKey
}

/**
 * 禁用 API Key
 */
export function disableApiKey(apiKeyId: number) {
  db.prepare('UPDATE api_keys SET status = ? WHERE id = ?').run('inactive', apiKeyId)
}

/**
 * 获取用户的 API Keys
 */
export function getUserApiKeys(userId: number) {
  return db.prepare(`
    SELECT id, api_key, name, quota_limit, quota_used, status, last_used_at, created_at, expires_at
    FROM api_keys
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId)
}
