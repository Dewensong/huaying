/**
 * 腾讯云 COS 工具模块
 * 提供文件上传、预签名 URL 生成等功能
 */

import path from 'path'
import fs from 'fs'
import { config } from './index.js'

// COS 配置
const COS_CONFIG = {
  secretId: process.env.COS_SECRET_ID || config.cos?.secretId || '',
  secretKey: process.env.COS_SECRET_KEY || config.cos?.secretKey || '',
  bucket: process.env.COS_BUCKET || config.cos?.bucket || '',
  region: process.env.COS_REGION || config.cos?.region || '',
  cdnDomain: process.env.COS_CDN_DOMAIN || '',
  appId: process.env.COS_APP_ID || config.cos?.appId || ''
}

// CDN 基础地址
const CDN_BASE_URL = COS_CONFIG.cdnDomain 
  ? `https://${COS_CONFIG.cdnDomain}`
  : `https://${COS_CONFIG.bucket}.cos.${COS_CONFIG.region}.myqcloud.com`

// COS 对象路径前缀
const COS_PREFIX = ''

// 目录规范
export const COS_PATHS = {
  // 形象相关
  AVATAR_PRESETS: 'avatars/presets/',
  AVATAR_CUSTOM: 'avatars/custom/',
  
  // 声音相关
  VOICE_SAMPLES: 'voices/',
  
  // TTS 音频
  TTS_AUDIO: 'tts/',
  
  // 字幕文件
  SUBTITLES: 'subtitles/',
  
  // 视频
  VIDEOS: 'videos/',

  // 缩略图
  THUMBNAILS: 'thumbnails/'
}

// 是否启用 COS
export function isCOSConfigured(): boolean {
  return !!(COS_CONFIG.secretId && COS_CONFIG.secretKey && COS_CONFIG.bucket && COS_CONFIG.region)
}

// 获取 CDN 基础 URL
export function getCDNBaseUrl(): string {
  return CDN_BASE_URL
}

/**
 * 上传本地文件到 COS
 * @param localPath 本地文件路径
 * @param cosKey COS 对象键（不含桶名）
 * @returns CDN 访问地址
 */
export async function uploadToCOS(localPath: string, cosKey: string): Promise<string> {
  if (!isCOSConfigured()) {
    console.warn('[COS] COS 未配置，跳过上传')
    return localPath
  }

  if (!fs.existsSync(localPath)) {
    throw new Error(`本地文件不存在: ${localPath}`)
  }

  try {
    // 动态导入 COS SDK
    const COS = await import('cos-nodejs-sdk-v5')
    
    const cos = new COS.default({
      SecretId: COS_CONFIG.secretId,
      SecretKey: COS_CONFIG.secretKey
    })

    const fileContent = fs.readFileSync(localPath)
    const fileName = path.basename(localPath)

    // 确保 key 以 / 开头
    const key = cosKey.startsWith('/') ? cosKey.slice(1) : cosKey

    return new Promise((resolve, reject) => {
      cos.putObject(
        {
          Bucket: COS_CONFIG.bucket,
          Region: COS_CONFIG.region,
          Key: key,
          Body: fileContent,
          ContentLength: fileContent.length,
          ACL: 'public-read',
          ContentDisposition: `inline; filename="${fileName}"`
        },
        (err: any) => {
          if (err) {
            console.error('[COS] 上传失败:', err)
            reject(err)
          } else {
            const cdnUrl = `${CDN_BASE_URL}/${key}`
            console.log(`[COS] 上传成功: ${localPath} -> ${cdnUrl}`)
            resolve(cdnUrl)
          }
        }
      )
    })
  } catch (error) {
    console.error('[COS] 上传异常:', error)
    throw error
  }
}

/**
 * 上传 Buffer 数据到 COS
 * @param data Buffer 数据
 * @param cosKey COS 对象键
 * @param contentType 内容类型
 * @returns CDN 访问地址
 */
export async function uploadBufferToCOS(
  data: Buffer, 
  cosKey: string, 
  contentType: string = 'application/octet-stream'
): Promise<string> {
  if (!isCOSConfigured()) {
    console.warn('[COS] COS 未配置，无法上传')
    throw new Error('COS 未配置')
  }

  try {
    const COS = await import('cos-nodejs-sdk-v5')
    
    const cos = new COS.default({
      SecretId: COS_CONFIG.secretId,
      SecretKey: COS_CONFIG.secretKey
    })

    const key = cosKey.startsWith('/') ? cosKey.slice(1) : cosKey

    return new Promise((resolve, reject) => {
      cos.putObject(
        {
          Bucket: COS_CONFIG.bucket,
          Region: COS_CONFIG.region,
          Key: key,
          Body: data,
          ContentLength: data.length,
          ACL: 'public-read',
          ContentType: contentType
        },
        (err: any) => {
          if (err) {
            console.error('[COS] Buffer 上传失败:', err)
            reject(err)
          } else {
            const cdnUrl = `${CDN_BASE_URL}/${key}`
            console.log(`[COS] Buffer 上传成功: ${cdnUrl}`)
            resolve(cdnUrl)
          }
        }
      )
    })
  } catch (error) {
    console.error('[COS] Buffer 上传异常:', error)
    throw error
  }
}

/**
 * 生成预签名 URL（同步版本，返回基础 URL）
 * @param cosKey COS 对象键
 * @param expires 过期时间（秒），默认 3600
 * @returns 预签名 URL 或 CDN 地址
 */
export function getPresignedUrl(cosKey: string, expires: number = 3600): string {
  const key = cosKey.startsWith('/') ? cosKey.slice(1) : cosKey
  
  // 如果配置了 CDN 域名，使用 CDN
  if (COS_CONFIG.cdnDomain) {
    // 返回基础 CDN 地址（实际签名由 getSignedPresignedUrl 生成）
    return `${CDN_BASE_URL}/${key}`
  }
  
  // 使用 COS 默认域名
  return `${CDN_BASE_URL}/${key}?expires=${expires}`
}

/**
 * 生成预签名 URL（异步版本，用于需要签名的场景）
 * @param cosKey COS 对象键
 * @param expires 过期时间（秒），默认 3600
 * @returns 预签名 URL
 */
export async function getSignedPresignedUrl(cosKey: string, expires: number = 3600): Promise<string> {
  const key = cosKey.startsWith('/') ? cosKey.slice(1) : cosKey
  
  if (COS_CONFIG.cdnDomain && isCOSConfigured()) {
    return getSignedCDNUrl(key, expires)
  }
  
  return `${CDN_BASE_URL}/${key}?expires=${expires}`
}

/**
 * 生成带签名的 CDN URL
 * @param key COS 对象键
 * @param expires 过期时间（秒）
 * @returns 带签名的 URL
 */
async function getSignedCDNUrl(key: string, expires: number): Promise<string> {
  try {
    const COS = await import('cos-nodejs-sdk-v5')
    
    const cos = new COS.default({
      SecretId: COS_CONFIG.secretId,
      SecretKey: COS_CONFIG.secretKey
    })

    return new Promise((resolve, reject) => {
      cos.getObjectUrl(
        {
          Bucket: COS_CONFIG.bucket,
          Region: COS_CONFIG.region,
          Key: key,
          Method: 'GET',
          Expires: expires,
          Sign: true
        },
        (err: any, data: any) => {
          if (err) {
            console.error('[COS] 生成预签名 URL 失败:', err)
            // 回退到不带签名的 URL
            resolve(`${CDN_BASE_URL}/${key}`)
          } else {
            resolve(data.Url)
          }
        }
      )
    })
  } catch (error) {
    console.error('[COS] 生成预签名 URL 异常:', error)
    return `${CDN_BASE_URL}/${key}`
  }
}

/**
 * 获取文件 COS 对象键
 * @param type 资源类型
 * @param userId 用户 ID（可选）
 * @param id 资源 ID（可选）
 * @param extension 文件扩展名
 * @returns COS 对象键
 */
export function getCOSKey(
  type: 'avatar_preset' | 'avatar_custom' | 'voice' | 'tts' | 'subtitle' | 'video' | 'thumbnail',
  userId?: number,
  id?: number,
  extension: string = 'mp4'
): string {
  const timestamp = Date.now()
  
  switch (type) {
    case 'avatar_preset':
      return `${COS_PATHS.AVATAR_PRESETS}preset_${String(id || 1).padStart(2, '0')}.png`
    
    case 'avatar_custom':
      return `${COS_PATHS.AVATAR_CUSTOM}user_${userId}/avatar_${id}.png`
    
    case 'voice':
      return `${COS_PATHS.VOICE_SAMPLES}user_${userId}/voice_${id}.mp3`
    
    case 'tts':
      return `${COS_PATHS.TTS_AUDIO}tts_${timestamp}.mp3`
    
    case 'subtitle':
      return `${COS_PATHS.SUBTITLES}subtitle_${id}.vtt`
    
    case 'video':
      return `${COS_PATHS.VIDEOS}video_${id}.mp4`
    
    case 'thumbnail':
      return `${COS_PATHS.THUMBNAILS}thumbnail_${id}.jpg`
    
    default:
      return `${type}_${timestamp}.${extension}`
  }
}

/**
 * 同步上传文件到 COS（使用 exec 执行 cos-cli）
 * 备选方案：当 SDK 不可用时使用
 */
export async function uploadToCOSWithCLI(localPath: string, cosKey: string): Promise<string> {
  const key = cosKey.startsWith('/') ? cosKey.slice(1) : cosKey
  const bucketKey = `${COS_CONFIG.bucket}/${key}`
  
  // 使用 cos-cli 上传
  const cmd = `cos-cli upload ${localPath} cos://${bucketKey} --storage-class STANDARD`
  
  return new Promise((resolve, reject) => {
    const { exec } = require('child_process')
    exec(cmd, (error: any, stdout: string, stderr: string) => {
      if (error) {
        console.error('[COS-CLI] 上传失败:', stderr)
        reject(error)
      } else {
        resolve(`${CDN_BASE_URL}/${key}`)
      }
    })
  })
}

export default {
  isCOSConfigured,
  getCDNBaseUrl,
  uploadToCOS,
  uploadBufferToCOS,
  getPresignedUrl,
  getSignedPresignedUrl,
  getCOSKey,
  COS_PATHS
}
