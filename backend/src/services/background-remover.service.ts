/**
 * 智能抠图服务
 * 使用腾讯云数据万象 CI 的 AIPortraitMatting 接口
 * 通过 COS SDK 的 request 方法调用云处理接口
 */

import { uploadBufferToCOS } from '../config/cos.js'
import db from '../db/index.js'

// COS 配置
const COS_CONFIG = {
  secretId: process.env.COS_SECRET_ID,
  secretKey: process.env.COS_SECRET_KEY,
  bucket: process.env.COS_BUCKET,
  region: process.env.COS_REGION || 'ap-beijing'
}

// 抠图后图片 COS 路径前缀
const NO_BG_PATH = 'avatars/no-bg/'

interface RemoveBackgroundResult {
  success: boolean
  imageUrl?: string
  error?: string
}

/**
 * 获取 COS SDK 实例
 */
async function getCOSInstance() {
  const COS = await import('cos-nodejs-sdk-v5')
  return new COS.default({
    SecretId: COS_CONFIG.secretId,
    SecretKey: COS_CONFIG.secretKey
  })
}

/**
 * 从完整 COS URL 中提取对象键
 */
function extractCOSKey(cdnUrl: string): string | null {
  try {
    const url = new URL(cdnUrl)
    let key = url.pathname
    if (key.startsWith('/')) {
      key = key.slice(1)
    }
    return key
  } catch {
    return null
  }
}

/**
 * 使用腾讯云数据万象 CI 的 AIPortraitMatting 接口进行人像抠图
 * 通过 cos.request 方法调用云处理接口
 */
async function removeBackgroundWithCI(imageUrl: string): Promise<RemoveBackgroundResult> {
  console.log('[BackgroundRemover] 开始 CI 人像抠图:', imageUrl)

  if (!COS_CONFIG.secretId || !COS_CONFIG.secretKey || !COS_CONFIG.bucket) {
    console.error('[BackgroundRemover] COS 配置不完整')
    return { success: false, error: 'COS 配置不完整' }
  }

  try {
    // 1. 从 CDN URL 提取 COS 对象键
    const cosKey = extractCOSKey(imageUrl)
    if (!cosKey) {
      console.error('[BackgroundRemover] 无法从 URL 提取 COS 对象键:', imageUrl)
      return { success: false, error: '无效的 COS URL' }
    }
    console.log('[BackgroundRemover] COS 对象键:', cosKey)

    // 2. 使用 cos.request 调用 AIPortraitMatting 接口
    console.log('[BackgroundRemover] 调用 AIPortraitMatting 接口...')
    
    const cos = await getCOSInstance()
    
    const result = await new Promise<{ Body?: Buffer | string | ArrayBuffer }>((resolve, reject) => {
      cos.request(
        {
          Bucket: COS_CONFIG.bucket,
          Region: COS_CONFIG.region,
          Method: 'GET',
          Key: cosKey,
          Query: {
            'ci-process': 'AIPortraitMatting'
          },
          RawBody: true
        },
        (err: any, data: any) => {
          if (err) {
            console.error('[BackgroundRemover] CI 接口调用失败:', err)
            reject(err)
            return
          }
          
          console.log('[BackgroundRemover] CI 接口响应状态:', data?.statusCode)
          console.log('[BackgroundRemover] 响应内容类型:', typeof data?.Body)
          console.log('[BackgroundRemover] 响应体大小:', data?.Body?.length || data?.Body?.byteLength || 'unknown')
          
          // 检查是否是 Buffer
          if (Buffer.isBuffer(data?.Body)) {
            console.log('[BackgroundRemover] 响应体是 Buffer')
            resolve({ Body: data.Body })
            return
          }
          
          // 检查是否是 ArrayBuffer
          if (data?.Body && typeof data?.Body === 'object' && 'byteLength' in data.Body) {
            console.log('[BackgroundRemover] 响应体是 ArrayBuffer')
            resolve({ Body: data.Body })
            return
          }
          
          // 检查是否是字符串（可能是 JSON 错误响应）
          if (typeof data?.Body === 'string') {
            console.log('[BackgroundRemover] 响应体是字符串:', data.Body.substring(0, 200))
            try {
              const parsed = JSON.parse(data.Body)
              if (parsed.error) {
                reject(new Error(`CI API 错误: ${JSON.stringify(parsed)}`))
                return
              }
            } catch {}
          }
          
          if (data?.statusCode === 200 && data?.Body) {
            resolve({ Body: data.Body })
          } else {
            reject(new Error(`无效的响应: statusCode=${data?.statusCode}, body=${typeof data?.Body}`))
          }
        }
      )
    })

    // 3. 获取图片 Buffer
    if (!result.Body) {
      console.error('[BackgroundRemover] 响应体为空')
      return { success: false, error: '响应体为空' }
    }
    
    let buffer: Buffer
    const body = result.Body
    
    console.log('[BackgroundRemover] 开始转换响应体为 Buffer...')
    
    if (Buffer.isBuffer(body)) {
      buffer = body
      console.log('[BackgroundRemover] 直接使用 Buffer')
    } else if (body instanceof ArrayBuffer || (typeof body === 'object' && body !== null && 'byteLength' in body)) {
      // ArrayBuffer or typed array
      const arrayBuffer = body instanceof ArrayBuffer ? body : (body as ArrayBuffer)
      buffer = Buffer.from(new Uint8Array(arrayBuffer))
      console.log('[BackgroundRemover] 从 ArrayBuffer 转换')
    } else if (typeof body === 'string') {
      buffer = Buffer.from(body)
      console.log('[BackgroundRemover] 从字符串转换')
    } else {
      console.error('[BackgroundRemover] 未知响应体类型:', typeof body)
      return { success: false, error: `未知响应体类型: ${typeof body}` }
    }
    
    console.log('[BackgroundRemover] Buffer 转换完成，大小:', buffer.length)
    
    console.log('[BackgroundRemover] 抠图结果大小:', buffer.length, 'bytes')

    if (buffer.length < 1000) {
      console.error('[BackgroundRemover] 抠图结果异常，文件过小')
      return { success: false, error: '抠图结果异常' }
    }

    // 4. 上传到 COS 的 avatars/no-bg/ 目录
    const timestamp = Date.now()
    const filename = cosKey.split('/').pop() || `avatar_${timestamp}`
    const nameWithoutExt = filename.replace(/\.[^.]+$/, '')
    const cosUploadKey = `${NO_BG_PATH}${nameWithoutExt}_nobg_${timestamp}.png`

    console.log('[BackgroundRemover] 上传到 COS:', cosUploadKey)
    const cdnUrl = await uploadBufferToCOS(buffer, cosUploadKey, 'image/png')
    console.log('[BackgroundRemover] 上传成功:', cdnUrl)

    return { success: true, imageUrl: cdnUrl }
  } catch (error: any) {
    console.error('[BackgroundRemover] CI 抠图失败:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * 公共接口：移除图片背景
 * @param imageUrl 原始图片的 CDN URL
 * @returns 抠图后的图片 CDN URL
 */
export async function removeBackground(imageUrl: string): Promise<RemoveBackgroundResult> {
  console.log('[BackgroundRemover] ====== 开始抠图处理 ======')
  console.log('[BackgroundRemover] 输入 URL:', imageUrl)
  
  if (!imageUrl) {
    console.error('[BackgroundRemover] ❌ 图片 URL 为空')
    return { success: false, error: '图片 URL 不能为空' }
  }

  // 检查环境配置
  console.log('[BackgroundRemover] 环境配置检查:')
  console.log('  COS_SECRET_ID:', COS_CONFIG.secretId ? '已设置' : '❌ 未设置')
  console.log('  COS_SECRET_KEY:', COS_CONFIG.secretKey ? '已设置' : '❌ 未设置')
  console.log('  COS_BUCKET:', COS_CONFIG.bucket || '❌ 未设置')
  console.log('  COS_REGION:', COS_CONFIG.region || '❌ 未设置')

  if (!COS_CONFIG.secretId || !COS_CONFIG.secretKey || !COS_CONFIG.bucket) {
    console.error('[BackgroundRemover] ❌ COS 配置不完整，无法进行抠图')
    return { success: false, error: 'COS 配置不完整' }
  }

  // 使用腾讯云 CI AIPortraitMatting
  console.log('[BackgroundRemover] 调用 removeBackgroundWithCI...')
  const result = await removeBackgroundWithCI(imageUrl)
  
  if (!result.success) {
    console.error('[BackgroundRemover] ❌ 抠图失败:', result.error)
  } else {
    console.log('[BackgroundRemover] ✅ 抠图成功:', result.imageUrl)
  }
  
  console.log('[BackgroundRemover] ====== 抠图处理结束 ======')

  return result
}

/**
 * 异步触发抠图并更新数据库
 * @param avatarId 形象 ID
 * @param imageUrl 原始图片 URL
 */
export async function triggerBackgroundRemoval(avatarId: number, imageUrl: string): Promise<RemoveBackgroundResult | void> {
  console.log(`[BackgroundRemover] 异步触发抠图: avatarId=${avatarId}, imageUrl=${imageUrl.substring(0, 80)}...`)

  // 异步执行，不阻塞主流程
  setImmediate(async () => {
    console.log(`[BackgroundRemover] setImmediate 执行中...`)
    try {
      const result = await removeBackground(imageUrl)

      if (result.success && result.imageUrl) {
        // 更新数据库
        const updateResult = db.prepare('UPDATE avatars SET image_url_no_bg = ? WHERE id = ?')
          .run(result.imageUrl, avatarId)
        console.log(`[BackgroundRemover] ✅ 抠图完成，已更新数据库: avatarId=${avatarId}, changes=${updateResult.changes}`)
        console.log(`[BackgroundRemover] image_url_no_bg: ${result.imageUrl}`)
        return result
      } else {
        console.warn(`[BackgroundRemover] ⚠️ 抠图失败: avatarId=${avatarId}, error=${result.error}`)
        return result
      }
    } catch (error: any) {
      console.error(`[BackgroundRemover] ❌ 抠图异常: avatarId=${avatarId}, error=${error.message}`)
      console.error(`[BackgroundRemover] 错误堆栈:`, error.stack)
    }
  })
}

/**
 * 获取形象的透明背景图片 URL
 * @param avatarId 形象 ID
 * @returns image_url_no_bg 或 null
 */
export function getNoBackgroundUrl(avatarId: number): string | null {
  const avatar = db.prepare('SELECT image_url_no_bg FROM avatars WHERE id = ?').get(avatarId) as any
  return avatar?.image_url_no_bg || null
}

/**
 * 检查形象是否有透明背景图
 * @param avatarId 形象 ID
 */
export function hasNoBackgroundImage(avatarId: number): boolean {
  return !!getNoBackgroundUrl(avatarId)
}

export default {
  removeBackground,
  triggerBackgroundRemoval,
  getNoBackgroundUrl,
  hasNoBackgroundImage
}
