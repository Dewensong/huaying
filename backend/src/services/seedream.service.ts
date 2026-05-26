/**
 * 火山方舟 Seedream 图片生成服务
 * 用于生成数字人形象图片
 * 
 * API 文档: https://www.volcengine.com/docs/IM-STT/655534299
 */

import axios from 'axios'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { uploadBufferToCOS, getCDNBaseUrl } from '../config/cos.js'

// ============ 类型定义 ============

export interface SeedreamOptions {
  prompt?: string          // 图片描述提示词（可选，已通过第一个参数传入）
  size?: string            // 图片尺寸，默认 1024x1024
  n?: number               // 生成数量，默认 1
  style?: string           // 风格：写实/卡通/商务
  userId?: number          // 用户ID，用于记录
}

export interface GenerateImageResult {
  success: boolean
  imageUrl?: string        // COS 图片 URL
  avatarRecord?: any       // 创建的形象记录
  message?: string
  error?: string
}

// ============ 配置 ============

const ARK_IMAGE_API_KEY = process.env.ARK_IMAGE_API_KEY
const ARK_IMAGE_API_ENDPOINT = process.env.ARK_IMAGE_API_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/v3/images/generations'

// Seedream 4.0 模型 ID (使用用户提供的正确模型名称)
const SEEDREAM_MODEL = process.env.ARK_IMAGE_MODEL || 'doubao-seedream-4-0-250828'

// 免费额度（新用户）
const FREE_QUOTA = 200

// COS 存储路径
const AI_AVATARS_PATH = 'avatars/ai-generated/'

// ============ 工具函数 ============

/**
 * 检查 API Key 是否配置
 */
export function isSeedreamConfigured(): boolean {
  return !!(ARK_IMAGE_API_KEY && ARK_IMAGE_API_KEY.trim().length > 0)
}

/**
 * 生成带风格优化的提示词
 */
function buildEnhancedPrompt(prompt: string, style?: string): string {
  const styleEnhancements: Record<string, string> = {
    '写实': 'photorealistic, high quality, professional portrait, natural lighting',
    '卡通': 'anime style, cartoon illustration, vibrant colors, clean lines',
    '商务': 'professional business attire, formal setting, corporate portrait, confident expression',
    '亲和': 'friendly smile, approachable, warm and welcoming, casual professional',
    '年轻': 'youthful appearance, energetic, modern style, vibrant',
    '权威': 'authoritative presence, executive appearance, confident, leadership aura'
  }

  let enhancedPrompt = prompt
  
  // 添加通用质量描述
  if (!prompt.toLowerCase().includes('portrait') && !prompt.toLowerCase().includes('photo')) {
    enhancedPrompt = `professional portrait of ${prompt}`
  }

  // 添加风格增强
  if (style && styleEnhancements[style]) {
    enhancedPrompt += `, ${styleEnhancements[style]}`
  }

  // 添加质量标签
  enhancedPrompt += ', high quality, 4K, detailed, sharp focus'

  return enhancedPrompt
}

/**
 * 下载图片到临时目录
 */
async function downloadImage(imageUrl: string, targetPath: string): Promise<Buffer> {
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 30000
  })
  
  const buffer = Buffer.from(response.data)
  
  // 确保目录存在
  const dir = path.dirname(targetPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  
  fs.writeFileSync(targetPath, buffer)
  return buffer
}

// ============ 核心服务 ============

/**
 * 生成 AI 形象图片
 * 
 * @param prompt 形象描述提示词
 * @param options 可选参数
 * @returns 生成结果
 */
export async function generateImage(
  prompt: string,
  options: SeedreamOptions = {}
): Promise<GenerateImageResult> {
  // 检查 API Key 配置
  if (!isSeedreamConfigured()) {
    console.error('[Seedream] API Key 未配置，请设置 ARK_IMAGE_API_KEY 环境变量')
    return {
      success: false,
      error: '火山方舟 API Key 未配置，请联系管理员配置 ARK_IMAGE_API_KEY'
    }
  }

  const {
    size = '1280x720',  // 【修改】默认使用 16:9 比例，与视频尺寸一致
    n = 1,
    style,
    userId
  } = options

  try {
    console.log(`[Seedream] 开始生成图片，提示词: ${prompt}, 尺寸: ${size}, 风格: ${style || '默认'}`)

    // 构建增强提示词
    const enhancedPrompt = buildEnhancedPrompt(prompt, style)

    // 调用火山方舟 Seedream API
    const response = await axios.post(
      ARK_IMAGE_API_ENDPOINT,
      {
        model: SEEDREAM_MODEL,
        prompt: enhancedPrompt,
        size: size,  // 修正：使用 size 而不是 image_size
        n: n,        // 修正：使用 n 而不是 num_images
        response_format: 'url',
        watermark: true
      },
      {
        headers: {
          'Authorization': `Bearer ${ARK_IMAGE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000  // 2分钟超时
      }
    )

    console.log(`[Seedream] API 响应:`, JSON.stringify(response.data, null, 2))

    // 解析响应
    const imageUrls: string[] = []
    
    if (response.data?.data) {
      const dataArray = Array.isArray(response.data.data) 
        ? response.data.data 
        : [response.data.data]
      
      for (const item of dataArray) {
        if (item.url) {
          imageUrls.push(item.url)
        } else if (item.b64_json) {
          // 如果返回的是 base64，直接使用
          imageUrls.push(`data:image/png;base64,${item.b64_json}`)
        }
      }
    }

    if (imageUrls.length === 0) {
      return {
        success: false,
        error: 'API 响应中未找到生成的图片'
      }
    }

    // 下载第一张图片并上传到 COS
    const timestamp = Date.now()
    const fileName = `avatar_${userId || 'anonymous'}_${timestamp}.png`
    const tempPath = path.join(os.tmpdir(), fileName)
    const cosKey = `${AI_AVATARS_PATH}${fileName}`

    console.log(`[Seedream] 下载图片到临时目录: ${tempPath}`)
    await downloadImage(imageUrls[0], tempPath)

    console.log(`[Seedream] 上传图片到 COS: ${cosKey}`)
    const cosUrl = await uploadBufferToCOS(
      fs.readFileSync(tempPath),
      cosKey,
      'image/png'
    )

    // 清理临时文件
    try {
      fs.unlinkSync(tempPath)
    } catch (e) {
      console.warn(`[Seedream] 清理临时文件失败: ${tempPath}`)
    }

    console.log(`[Seedream] 生成成功，图片 URL: ${cosUrl}`)

    return {
      success: true,
      imageUrl: cosUrl,
      message: '图片生成成功'
    }

  } catch (error: any) {
    console.error('[Seedream] 生成图片失败:', error.message)
    
    // 处理常见错误
    if (error.response) {
      const status = error.response.status
      const data = error.response.data
      
      if (status === 401) {
        return {
          success: false,
          error: 'API Key 无效或已过期'
        }
      } else if (status === 429) {
        return {
          success: false,
          error: '请求频率超限，请稍后重试'
        }
      } else if (data?.error?.message) {
        return {
          success: false,
          error: `API 错误: ${data.error.message}`
        }
      }
    }

    return {
      success: false,
      error: error.message || '生成图片失败'
    }
  }
}

/**
 * 获取免费额度信息
 */
export function getFreeQuota(): number {
  return FREE_QUOTA
}

export default {
  generateImage,
  isSeedreamConfigured,
  getFreeQuota
}
