/**
 * 视频生产流水线服务
 * 核心原则：用户填了的配置用用户的值，没填的配置用默认值
 */

import path from 'path'
import fs from 'fs'
import os from 'os'
import { spawn, ChildProcess } from 'child_process'
import ffmpeg from 'fluent-ffmpeg'
import db from '../db/index.js'
import { synthesizeSpeech } from './tts.service.js'
import { uploadToCOS, getCOSKey, isCOSConfigured } from '../config/cos.js'
import { pushProgress, startStepProgress, stopStepProgress } from './task-progress.ws.js'

// ============ 常量配置 ============

const FFmpeg_TIMEOUT = 300000 // 5分钟

const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg'
const FFPROBE_PATH = process.env.FFPROBE_PATH || 'ffprobe'

// 字体文件路径（根据操作系统动态选择）
// 【修复】字体路径现在由 getChineseFontPath() 函数在运行时确定

// 输出目录
const outputDir = path.join(process.cwd(), 'data', 'output')
const tempDir = path.join(outputDir, 'temp')

// 视频尺寸
const VIDEO_WIDTH = 1280
const VIDEO_HEIGHT = 720

// ============ 默认值配置 ============

const DEFAULT_SUBTITLE_FONT_SIZE = 28
const DEFAULT_SUBTITLE_FONT_COLOR = 'white'
const SEGMENT_DURATION = 2 // 封面、片头、片尾的固定时长

// ============ 任务队列 ============

let videoQueue: Array<{ videoId: number; params: VideoPipelineParams; webhookUrl?: string }> = []
let isProcessing = false

// ============ 类型定义 ============

export interface BackgroundConfig {
  type: 'color' | 'image'
  value: string
}

export interface VideoPipelineParams {
  userId: number
  videoId?: number  // 可选，传入时用于字幕文件命名
  avatarId?: number
  script: string
  title?: string
  voiceType?: string
  resolution?: '480P' | '720P'
  backgroundType?: 'color' | 'image'
  backgroundValue?: string
  subtitleFontSize?: number
  subtitleFontColor?: string
  mode?: string
}

export interface VideoPipelineResult {
  success: boolean
  videoId?: number
  videoUrl?: string
  subtitleUrl?: string  // COS 对象键，前端通过 preview-url 获取访问地址
  thumbnail?: string  // 缩略图 URL
  duration?: number
  message?: string
  error?: string
}

// ============ 工具函数 ============

/**
 * 安全转换为固定小数位（避免浮点精度问题）
 * @param num 数字
 * @param decimals 小数位数
 */
function safeToFixed(num: number, decimals: number = 2): string {
  const m = Math.pow(10, decimals)
  return (Math.round(num * m) / m).toFixed(decimals)
}

/**
 * 使用 spawn 执行命令（替代 exec，避免 maxBuffer 限制）
 * @param cmd 完整命令字符串（会被解析为命令和参数）
 * @param timeout 超时时间（毫秒）
 */
async function execWithTimeout(cmd: string, timeout: number = FFmpeg_TIMEOUT): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    // 解析命令字符串，分离命令和参数
    // 处理带引号的参数，如 "path with spaces"
    const parts: string[] = []
    const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g
    let match
    while ((match = regex.exec(cmd)) !== null) {
      parts.push(match[1] || match[2] || match[0])
    }
    
    const executable = parts[0]
    const args = parts.slice(1)
    
    console.log('[Pipeline] spawn 执行:', executable, args.length > 3 ? `(${args.length} 个参数)` : args.join(' '))
    
    // spawn 不需要 maxBuffer，不会撑爆内存
    const proc = spawn(executable, args)
    
    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    
    proc.stdout?.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk)
    })
    
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk)
    })
    
    // 设置超时
    const timer = setTimeout(() => {
      proc.kill('SIGTERM')
      reject(new Error(`命令执行超时 (${timeout}ms): ${cmd.substring(0, 100)}`))
    }, timeout)
    
    proc.on('error', (error: Error) => {
      clearTimeout(timer)
      reject(error)
    })
    
    proc.on('close', (code: number | null) => {
      clearTimeout(timer)
      const stdout = Buffer.concat(stdoutChunks).toString('utf8')
      const stderr = Buffer.concat(stderrChunks).toString('utf8')
      if (code === 0 || code === null) {
        resolve({ stdout, stderr })
      } else {
        const error = new Error(`命令执行失败，退出码: ${code}`)
        ;(error as any).stdout = stdout
        ;(error as any).stderr = stderr
        reject(error)
      }
    })
  })
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

/**
 * 从图片中提取主色调
 * @param imagePath 本地图片文件路径
 * @returns 十六进制颜色值
 */
async function getDominantColor(imagePath: string): Promise<string> {
  try {
    // 生成调色板用于提取主色
    const tempDir = path.join(process.cwd(), 'data', 'temp')
    ensureDir(tempDir)
    const palettePath = path.join(tempDir, `palette_${Date.now()}.png`)
    
    // 生成调色板（16色）
    await execWithTimeout(
      `"${FFMPEG_PATH}" -y -i "${imagePath}" -vf "scale=100:100:force_original_aspect_ratio=decrease,split[s0][s1];[s0]palettegen=max_colors=16[p];[p][s1]paletteuse=dither=bayer:bayer_scale=5" -frames:v 1 "${palettePath}"`,
      30000
    )
    
    // 如果调色板生成成功，读取第一个非黑色像素作为主色
    if (fs.existsSync(palettePath) && fs.statSync(palettePath).size > 100) {
      // 调色板第一行第一个像素通常是出现最多的颜色
      // 使用 ImageMagick 的 convert 读取第一个像素颜色（如果有的话）
        try {
        await execWithTimeout(
          `"${FFMPEG_PATH}" -y -i "${palettePath}" -vf "trim=start_frame=0:end_frame=1,scale=1:1" -frames:v 1 -f rawvideo - 2>/dev/null | od -An -tx1 -N3`,
          5000
        )
        // 如果读取成功，解析颜色
        fs.unlinkSync(palettePath)
      } catch {
        // ignore
      }
    }
    
    // 无论是否成功提取，都使用默认蓝紫色（与片头片尾一致）
    console.log('[Pipeline] 使用默认背景色 #667eea（与片头片尾一致）')
    return '#667eea'
  } catch (err) {
    console.warn('[Pipeline] 取色失败，使用默认背景色:', err)
    return '#667eea'
  }
}

/**
 * 将 #RRGGBB 格式颜色转为 FFmpeg 可用的 0xRRGGBB 格式
 */
function toFfmpegColor(hexColor: string): string {
  return '0x' + hexColor.replace('#', '')
}

/**
 * 将 #RRGGBB 格式颜色转为 ASS/SSA 字幕颜色格式 &H00BBGGRR
 * ASS 使用 BGR 顺序，不是 RGB
 */
function toAssColor(hexColor: string): string {
  const hex = hexColor.replace('#', '')
  // RGB 转 BGR: #RRGGBB -> &H00BBGGRR
  const r = hex.substring(0, 2)
  const g = hex.substring(2, 4)
  const b = hex.substring(4, 6)
  return '&H00' + b + g + r
}

ensureDir(outputDir)
ensureDir(tempDir)

/**
 * 清理所有临时文件
 */
function cleanupAllTempDirs(): void {
  const dirsToClean = [
    path.join(process.cwd(), 'data', 'output', 'temp'),
    path.join(process.cwd(), 'public', 'tts', 'temp_concat'),
    path.join(process.cwd(), 'data', 'temp')
  ]
  for (const dir of dirsToClean) {
    if (!fs.existsSync(dir)) continue
    try {
      const files = fs.readdirSync(dir)
      for (const file of files) {
        const filePath = path.join(dir, file)
        try { if (fs.statSync(filePath).isFile()) fs.unlinkSync(filePath) } catch {}
      }
      console.log('[Pipeline] 已清理临时目录:', dir)
    } catch (err) {
      console.warn('[Pipeline] 清理临时目录失败:', dir, err)
    }
  }
}

/**
 * 清理 backend/data/temp 目录下的所有临时文件
 */
function cleanupTempDirectory(): void {
  const tempDir = path.join(process.cwd(), 'backend', 'data', 'temp')
  if (!fs.existsSync(tempDir)) {
    return
  }
  try {
    const files = fs.readdirSync(tempDir)
    for (const file of files) {
      const filePath = path.join(tempDir, file)
      const stat = fs.statSync(filePath)
      if (stat.isFile()) {
        try {
          fs.unlinkSync(filePath)
        } catch {}
      }
    }
  } catch {}
}

// ============ 字幕解析 ============

interface SubtitleLine {
  index: number
  start: number  // 秒
  end: number
  text: string
}

/**
 * 将秒数转换为 WebVTT 时间格式 HH:MM:SS.mmm
 */
function formatVTTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const millis = Math.floor((seconds % 1) * 1000)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
}

/**
 * 将秒数转换为 SRT 时间格式 HH:MM:SS,mmm
 */
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const millis = Math.floor((seconds % 1) * 1000)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`
}

/**
 * 转义 SRT 特殊字符（< > & 需要转义）
 */
function escapeForSRT(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * 生成 SRT 字幕文件（用于 FFmpeg subtitles 滤镜烧录）
 * @param segments TTS 分段数据
 * @param offset 时间偏移量（秒）
 * @param videoId 视频 ID（用于文件名）
 * @returns 字幕文件本地路径
 */
async function generateSRT(segments: { text: string; start: number; duration: number }[], offset: number = 0, videoId?: number): Promise<string> {
  console.log(`[Pipeline] === generateSRT 开始 === segments 数量: ${segments?.length || 0}, offset: ${offset}s`)

  if (!segments || segments.length === 0) {
    console.log('[Pipeline] 无字幕数据，跳过生成')
    return ''
  }

  const tempDir = path.join(process.cwd(), 'public', 'tts', 'temp_concat')
  ensureDir(tempDir)

  const srtContent: string[] = []

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const startTime = formatSRTTime(seg.start + offset)
    const endTime = formatSRTTime(seg.start + seg.duration + offset)
    const text = escapeForSRT(seg.text)

    srtContent.push(`${i + 1}`)
    srtContent.push(`${startTime} --> ${endTime}`)
    srtContent.push(text)
    srtContent.push('')
  }

  const srtContentStr = srtContent.join('\n')
  const tempSrtPath = path.join(tempDir, `subtitle_${videoId || Date.now()}.srt`)
  fs.writeFileSync(tempSrtPath, srtContentStr, 'utf-8')
  console.log(`[Pipeline] SRT 字幕已生成: ${tempSrtPath}`)

  return tempSrtPath
}

/**
 * 转义 WebVTT 特殊字符
 */
function escapeForVTT(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 生成 WebVTT 字幕文件
 * @param segments TTS 分段数据
 * @param videoId 视频 ID（用于 COS 对象键）
 * @returns 字幕文件本地路径
 */
async function generateWebVTT(segments: { text: string; start: number; duration: number }[], videoId?: number): Promise<string> {
  console.log(`[Pipeline] === generateWebVTT 开始 === segments 数量: ${segments?.length || 0}`)
  
  if (!segments || segments.length === 0) {
    console.log('[Pipeline] 无字幕数据，跳过生成')
    return ''
  }

  // 计算偏移量：片头(2秒) + 封面(如果有，2秒)
  // 正文从片头结束后开始，字幕时间需要偏移
  const subtitleOffset = SEGMENT_DURATION // 默认片头2秒

  const vttContent = [
    'WEBVTT',
    '',
    // 提示信息cue
    `NOTE`,
    `Generated by HuaYing Video Pipeline`,
    `Total segments: ${segments.length}`,
    ''
  ]

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const startTime = formatVTTTime(seg.start + subtitleOffset)
    const endTime = formatVTTTime(seg.start + seg.duration + subtitleOffset)
    const text = escapeForVTT(seg.text)

    vttContent.push(`${i + 1}`)
    vttContent.push(`${startTime} --> ${endTime}`)
    vttContent.push(text)
    vttContent.push('')
  }

  const vttContentStr = vttContent.join('\n')

  // 保存本地临时文件
  const tempVttPath = path.join(tempDir, `subtitle_${videoId || Date.now()}.vtt`)
  fs.writeFileSync(tempVttPath, vttContentStr, 'utf-8')
  console.log(`[Pipeline] WebVTT 字幕已生成: ${tempVttPath}`)
  console.log(`[Pipeline] VTT 内容前500字符:\n${vttContentStr.substring(0, 500)}`)
  console.log(`[Pipeline] === generateWebVTT 结束 === 返回路径: ${tempVttPath}, 字幕数: ${segments.length}`)

  return tempVttPath
}

/**
 * 上传字幕到 COS 并返回对象键
 * @param localPath 本地字幕文件路径
 * @param videoId 视频 ID
 * @returns COS 对象键
 */
async function uploadSubtitleToCOS(localPath: string, videoId: number): Promise<string> {
  if (!localPath || !fs.existsSync(localPath)) {
    console.log('[Pipeline] 字幕文件不存在，跳过上传')
    return ''
  }

  if (!isCOSConfigured()) {
    console.log('[Pipeline] COS 未配置，字幕留在本地')
    return localPath
  }

  const cosKey = getCOSKey('subtitle', undefined, videoId, 'vtt')
  const cdnUrl = await uploadToCOS(localPath, cosKey)
  console.log(`[Pipeline] 字幕已上传到 COS, COS Key: ${cosKey}, CDN URL: ${cdnUrl}`)
  // 返回 COS 对象键
  return cosKey
}

/**
 * 转义 FFmpeg drawtext 特殊字符
 * 【修复】确保中文字符正确编码：使用 UTF-8 编码并转义特殊字符
 */
function escapeForFFmpegDrawtext(text: string): string {
  // 先进行 FFmpeg 特殊字符转义，然后确保 UTF-8 编码正确
  const escaped = text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/\n/g, '\\n')
  // 返回转义后的文本，FFmpeg drawtext 会自动处理 UTF-8
  return escaped
}

/**
 * 获取支持中文的字体路径
 * 【新增】根据操作系统选择合适的中文字体
 */
function getChineseFontPath(): string {
  // 使用文件顶部导入的 os 和 fs 模块
  const platform = os.platform()
  
  // 【优化】优先使用项目内的字体包（最可靠）
  const projectFont = path.join(process.cwd(), 'src', 'assets', 'fonts', 'HiraginoSansGB.ttc')
  if (fs.existsSync(projectFont)) {
    return projectFont
  }
  
  if (platform === 'darwin') {
    // macOS - 使用系统中存在的中文字体（优先 Hiragino Sans GB，再试 STHeiti）
    const macFonts = [
      '/System/Library/Fonts/Hiragino Sans GB.ttc',
      '/System/Library/Fonts/STHeiti Light.ttc',
      '/System/Library/Fonts/STHeiti Medium.ttc',
    ]
    for (const font of macFonts) {
      if (fs.existsSync(font)) {
        return font
      }
    }
    // 如果都没找到，返回备用路径
    return '/System/Library/Fonts/Hiragino Sans GB.ttc'
  } else if (platform === 'win32') {
    // Windows - 使用微软雅黑
    return 'C:\\Windows\\Fonts\\msyh.ttc'
  } else {
    // Linux - 尝试常见的中文字体路径
    const linuxFonts = [
      '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
      '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
      '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
      '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf',
      '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc',
      '/usr/share/fonts/truetype/arphic/uming.ttc',
    ]
    // 使用文件顶部导入的 fs 模块
    for (const font of linuxFonts) {
      if (fs.existsSync(font)) {
        return font
      }
    }
    // 如果都没找到，返回默认路径（可能会乱码）
    return '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf'
  }
}

// 使用动态获取的字体路径
const FONT_PATH = getChineseFontPath()
console.log('[Pipeline] 使用字体:', FONT_PATH)

// 获取字幕字体名称（用于 FFmpeg subtitles 滤镜）
function getSubtitleFontName(): string {
  const fontPath = FONT_PATH.toLowerCase()
  if (fontPath.includes('wqy')) {
    return 'WenQuanYi Zen Hei'
  } else if (fontPath.includes('noto')) {
    return 'Noto Sans CJK SC'
  } else if (fontPath.includes('hiragino')) {
    return 'Hiragino Sans GB'
  } else if (fontPath.includes('stheit')) {
    return 'STHeiti'
  } else if (fontPath.includes('msyh')) {
    return 'Microsoft YaHei'
  } else if (fontPath.includes('droid')) {
    return 'Droid Sans Fallback'
  }
  // 默认返回空字符串，让 FFmpeg 使用系统默认
  return ''
}

// ============ CSS 渐变处理 ============

/**
 * 检测是否是 CSS 渐变
 */
function isCssGradient(value: string): boolean {
  if (!value) return false
  const lower = value.toLowerCase()
  return lower.includes('linear-gradient') || 
         lower.includes('radial-gradient') || 
         lower.includes('conic-gradient') ||
         lower.includes('gradient(')
}

/**
 * 解析 CSS 渐变，提取颜色列表
 */
function parseGradientColors(gradient: string): string[] {
  const colors: string[] = []
  
  // 直接从字符串中提取所有十六进制颜色
  const hexMatches = gradient.matchAll(/#([0-9a-fA-F]{3,8})/g)
  for (const match of hexMatches) {
    colors.push('#' + match[1])
  }
  
  // 如果没有找到十六进制颜色，尝试提取其他格式
  if (colors.length === 0) {
    const colorMatches = gradient.matchAll(/(rgba?\([^)]+\)|hsla?\([^)]+\))/g)
    for (const match of colorMatches) {
      colors.push(match[1])
    }
  }
  
  return colors
}

/**
 * 将 CSS 渐变转换为 FFmpeg 可用的参数
 * 如果是渐变，生成渐变图片；否则返回颜色值
 */
async function convertCssGradientToFFmpegInput(backgroundValue: string): Promise<{
  type: 'color' | 'image'
  value: string
  tempFile?: string
}> {
  if (!isCssGradient(backgroundValue)) {
    return { type: 'image', value: backgroundValue }
  }
  
  console.log('[Pipeline] 检测到 CSS 渐变，生成渐变图片...')
  
  // 解析渐变颜色
  const colors = parseGradientColors(backgroundValue)
  console.log('[Pipeline] 渐变颜色:', colors)
  
  if (colors.length === 0) {
    // 无法解析，默认使用灰色
    return { type: 'color', value: '#333333' }
  }
  
  // 如果只有1-2个颜色，使用 FFmpeg 渐变滤镜
  if (colors.length >= 1) {
    // 生成渐变图片
    const tempDir = path.join(process.cwd(), 'data', 'temp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    const tempFile = path.join(tempDir, `gradient_${Date.now()}.png`)
    
    // 使用 FFmpeg 生成垂直渐变
    const color1 = colors[0].replace('#', '')
    const color2 = colors[colors.length - 1] || colors[0]
    const color2Hex = color2.replace('#', '')
    
    // FFmpeg 渐变命令
    const gradientCmd = `${FFMPEG_PATH} -y -f lavfi -i "gradients=size=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:c0=0x${color1}:c1=0x${color2Hex}:duration=1:rate=25" -frames:v 1 -update 1 "${tempFile}"`
    
    try {
      await execWithTimeout(gradientCmd, 30000)
      if (fs.existsSync(tempFile)) {
        console.log('[Pipeline] 渐变图片已生成:', tempFile)
        return { type: 'image', value: tempFile, tempFile }
      }
    } catch (err) {
      console.warn('[Pipeline] FFmpeg 渐变生成失败，使用纯色:', err)
    }
  }
  
  // 回退到第一个颜色
  return { type: 'color', value: colors[0] }
}

// ============ 形象处理 ============

/**
 * 将 SVG 转换为 PNG（FFmpeg 不支持 SVG）
 */
async function convertSvgToPng(svgPath: string): Promise<string> {
  const outputPath = svgPath.replace(/\.svg$/i, '.png')
  
  if (fs.existsSync(outputPath)) {
    console.log('[Pipeline] PNG 已存在:', outputPath)
    return outputPath
  }
  
  // 尝试 rsvg-convert
  const rsvgCmd = `rsvg-convert -w ${VIDEO_WIDTH} -h ${VIDEO_HEIGHT} "${svgPath}" -o "${outputPath}"`
  try {
    await execWithTimeout(rsvgCmd, 30000)
    if (fs.existsSync(outputPath)) {
      console.log('[Pipeline] rsvg-convert SVG 转 PNG 成功:', outputPath)
      return outputPath
    }
  } catch {
    console.warn('[Pipeline] rsvg-convert 不可用')
  }
  
  // 尝试 ImageMagick
  const magickCmd = `convert -background none -resize ${VIDEO_WIDTH}x${VIDEO_HEIGHT} "${svgPath}" "${outputPath}"`
  try {
    await execWithTimeout(magickCmd, 30000)
    if (fs.existsSync(outputPath)) {
      console.log('[Pipeline] ImageMagick SVG 转 PNG 成功:', outputPath)
      return outputPath
    }
  } catch {
    console.warn('[Pipeline] ImageMagick 也不可用')
  }
  
  throw new Error('SVG 转换工具都不可用，无法处理 SVG 文件: ' + svgPath)
}

/**
 * 获取默认形象（系统第一张预设形象）
 */
function getDefaultAvatarId(): number {
  const avatar = db.prepare(`
    SELECT id FROM avatars
    WHERE user_id IS NULL
    ORDER BY id ASC
    LIMIT 1
  `).get() as { id: number } | undefined

  if (!avatar) {
    throw new Error('没有找到系统预设形象')
  }
  
  return avatar.id
}

/**
 * 获取形象图片路径
 * 完整抠图流程：下载 -> 上传COS -> 调用抠图API -> 下载抠图结果
 */
async function getAvatarPath(avatarId: number, userId: number): Promise<{ path: string; hasNoBg: boolean; tempFiles: string[] }> {
  const avatar = db.prepare(`
    SELECT id, name, image, model_url
    FROM avatars
    WHERE id = ? AND (user_id = ? OR user_id IS NULL)
  `).get(avatarId, userId) as any

  if (!avatar) {
    throw new Error('形象不存在，avatarId: ' + avatarId)
  }

  const avatarUrl = avatar.image

  if (!avatarUrl) {
    throw new Error(
      `形象没有设置 image_url，avatarId: ${avatarId}, name: ${avatar.name}。` +
      `model_url (${avatar.model_url || '无'}) 不能用于视频合成，请先调用 POST /api/core/avatars/${avatarId}/generate-cover 生成封面图。`
    )
  }

  console.log('[Pipeline] ========== getAvatarPath 开始 ==========')
  console.log('[Pipeline] 形象ID:', avatarId, '名称:', avatar.name)

  // 统一临时目录
  const tempDir = path.join(process.cwd(), 'data', 'temp')
  ensureDir(tempDir)

  // ========== 步骤1：下载远程图片到本地 ==========
  let downloadedLocalPath = ''

  if (avatarUrl.startsWith('http')) {
    console.log('[Pipeline] 步骤1: 下载远程图片到本地...')
    const urlPath = new URL(avatarUrl).pathname
    const fileName = path.basename(urlPath) || `avatar_${avatarId}_${Date.now()}.png`
    downloadedLocalPath = path.join(tempDir, fileName)
    const curlCmd = `curl -s -L -o "${downloadedLocalPath}" "${avatarUrl}"`
    await execWithTimeout(curlCmd, 60000)
    if (!fs.existsSync(downloadedLocalPath) || fs.statSync(downloadedLocalPath).size < 1000) {
      throw new Error(`远程图片下载失败或文件过小: ${avatarUrl}`)
    }
    console.log('[Pipeline] 步骤1完成: 远程图片已下载到', downloadedLocalPath)

  } else if (avatarUrl.startsWith('data:')) {
    console.log('[Pipeline] 步骤1: 解码Base64并保存到本地...')
    const matches = avatarUrl.match(/^data:image\/(\w+);base64,(.+)$/)
    if (!matches || matches.length !== 3) {
      throw new Error('Base64 图片格式解析失败')
    }
    const imageType = matches[1]
    const base64Data = matches[2]
    const buffer = Buffer.from(base64Data, 'base64')
    downloadedLocalPath = path.join(tempDir, `avatar_${avatarId}_${Date.now()}.${imageType}`)
    fs.writeFileSync(downloadedLocalPath, buffer)
    console.log('[Pipeline] 步骤1完成: Base64图片已保存到', downloadedLocalPath)

  } else {
    // 本地路径：尝试多个可能的位置
    console.log('[Pipeline] 步骤1: 查找本地图片路径...')
    const possiblePaths: string[] = []
    if (avatarUrl.startsWith('/')) {
      possiblePaths.push(
        path.join(process.cwd(), 'public', avatarUrl),
        path.join(process.cwd(), '../frontend/public', avatarUrl),
        path.join(process.cwd(), '../frontend/dist', avatarUrl)
      )
    } else {
      possiblePaths.push(path.join(process.cwd(), 'public', avatarUrl))
    }
    
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        downloadedLocalPath = p
        break
      }
    }
    
    if (!downloadedLocalPath) {
      throw new Error('形象图片文件不存在: ' + avatarUrl)
    }
    console.log('[Pipeline] 步骤1完成: 本地图片路径为', downloadedLocalPath)
  }

  const finalLocalPath = downloadedLocalPath
  const finalHasNoBg = false
  const tempFiles: string[] = []

  // ========== 返回最终路径 ==========
  console.log('[Pipeline] ========== getAvatarPath 结束 ==========')
  console.log('[Pipeline] 最终路径:', finalLocalPath, 'hasNoBg:', finalHasNoBg)

  return { path: finalLocalPath, hasNoBg: finalHasNoBg, tempFiles }
}

/**
 * 获取 FFmpeg 兼容的图片路径（自动处理 SVG）
 */
async function getFfprobeCompatiblePath(filePath: string): Promise<string> {
  if (!filePath.toLowerCase().endsWith('.svg')) {
    return filePath
  }
  
  const pngPath = filePath.replace(/\.svg$/i, '.png')
  
  if (fs.existsSync(pngPath)) {
    console.log('[Pipeline] 使用已存在的 PNG:', pngPath)
    return pngPath
  }
  
  return await convertSvgToPng(filePath)
}

// ============ 音频时长获取 ============

/**
 * 获取音频时长（使用 ffprobe，失败时回退到估算）
 */
async function getAudioDuration(audioPath: string): Promise<number> {
  const ffprobePath = FFPROBE_PATH || 'ffprobe'
  
  try {
    const { stdout } = await execWithTimeout(
      `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`,
      30000
    )
    const duration = parseFloat(stdout.trim())
    if (!isNaN(duration) && duration > 0) {
      console.log('[Pipeline] ffprobe 获取音频时长: ' + safeToFixed(duration, 2) + 's')
      return duration
    }
  } catch {
    console.warn('[Pipeline] ffprobe 不可用，尝试使用估算时长')
  }
  
  // 回退方案：估算音频时长（按 8000 字节/秒估算）
  if (fs.existsSync(audioPath)) {
    const stats = fs.statSync(audioPath)
    const estimatedDuration = Math.max(1, stats.size / 8000)
    console.log('[Pipeline] 使用估算音频时长:', safeToFixed(estimatedDuration, 2), '秒')
    return estimatedDuration
  }
  
  // 最终回退：返回默认时长
  console.warn('[Pipeline] 无法获取音频文件，使用默认时长 60 秒')
  return 60
}

// ============ 视频合成 ============

/**
 * 生成正文视频（音频时长）
 * 核心策略：优先使用抠图后的透明背景图，配合纯色或图片背景，
 * 实现自然的视觉效果
 *
 * 字幕方案：使用 FFmpeg subtitles 滤镜烧录 .srt 字幕文件
 */
async function generateVideoOneCommand(
  avatarPath: string,
  audioPath: string,
  subtitles: SubtitleLine[],
  audioDuration: number,
  hasNoBg: boolean,
  config: {
    title: string
    subtitleFontSize: number
    subtitleFontColor: string
    backgroundType?: 'color' | 'image'
    backgroundValue?: string
    dominantColor?: string  // 形象主色调，用于纯色背景
  },
  outputPath: string,
  srtPath?: string  // SRT 字幕文件路径（用于 FFmpeg subtitles 滤镜）
): Promise<void> {
  console.log('\n[Pipeline] ========== 视频合成 ==========')
  console.log('[Pipeline] 标题: ' + config.title)
  console.log('[Pipeline] 字幕字号: ' + config.subtitleFontSize)
  console.log('[Pipeline] 字幕颜色: ' + config.subtitleFontColor)
  console.log('[Pipeline] 背景类型: ' + (config.backgroundType || '(形象图片)'))
  console.log('[Pipeline] 背景值: ' + (config.backgroundValue || '(无)'))
  console.log('[Pipeline] 音频时长: ' + safeToFixed(audioDuration, 2) + 's')
  console.log('[Pipeline] 字幕数量: ' + subtitles.length)
  console.log('[Pipeline] 抠图状态: ' + (hasNoBg ? '已抠图(透明背景)' : '未抠图(原图)'))

  // 处理 CSS 渐变背景
  let effectiveBackgroundType = config.backgroundType
  let effectiveBackgroundValue = config.backgroundValue
  let gradientTempFile: string | undefined

  if (config.backgroundType === 'image' && config.backgroundValue) {
    if (isCssGradient(config.backgroundValue)) {
      console.log('[Pipeline] 检测到 CSS 渐变，准备转换为图片...')
      const result = await convertCssGradientToFFmpegInput(config.backgroundValue)
      effectiveBackgroundType = result.type
      effectiveBackgroundValue = result.value
      gradientTempFile = result.tempFile
      console.log('[Pipeline] 渐变处理完成，类型:', effectiveBackgroundType, '值:', effectiveBackgroundValue)
    }
  }

  // 构建滤镜链
  const filterParts: string[] = []

  // 正文片段（音频时长）- 根据背景类型构建滤镜
  if (effectiveBackgroundType === 'image' && effectiveBackgroundValue) {
    // 用户设了背景图：直接用背景图铺满，叠加形象图
    // 输入顺序：avatar(0), bg_image(1)
    filterParts.push(
      `[0:v]scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=decrease[scaled];` +
      `[1:v]scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=increase,crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT}[bg_img];` +
      `[bg_img][scaled]overlay=(W-w)/2:(H-h)/2[body_base]`
    )
  } else if (effectiveBackgroundType === 'color' && effectiveBackgroundValue) {
    // 用户设置了纯色背景：使用用户选择的颜色
    const bgColor = toFfmpegColor(effectiveBackgroundValue)
    filterParts.push(
      `color=c=${bgColor}:size=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:r=25[bg];` +
      `[0:v]scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=decrease[scaled];` +
      `[bg][scaled]overlay=(W-w)/2:(H-h)/2[body_base]`
    )
  } else {
    // 未设置纯色背景：用形象主色调（未设置则用默认深色）
    const bgColor = toFfmpegColor(config.dominantColor || '#1A1A2E')
    filterParts.push(
      `color=c=${bgColor}:size=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:r=25[bg];` +
      `[0:v]scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=decrease[scaled];` +
      `[bg][scaled]overlay=(W-w)/2:(H-h)/2[body_base]`
    )
  }

  // 如果有 SRT 字幕文件，使用 subtitles 滤镜烧录
  if (srtPath) {
    const escapedSrtPath = srtPath.replace(/'/g, "'\\''").replace(/\\/g, '/')
    const primaryColor = toAssColor(config.subtitleFontColor)
    const fontName = getSubtitleFontName()
    const fontStyle = fontName ? `FontName=${fontName},` : ''
    filterParts.push(
      `[body_base]subtitles='${escapedSrtPath}':force_style='${fontStyle}FontSize=${config.subtitleFontSize},PrimaryColour=${primaryColor},OutlineColour=&H00000000,Outline=2,BorderStyle=1,Alignment=2,MarginV=20'[outv]`
    )
  }

  // 构建完整的滤镜链
  const filterComplex = filterParts.join(';')
  
  // 确定输出流标签
  const outvLabel = srtPath ? '[outv]' : '[body_base]'

  console.log('[Pipeline] 构建 FFmpeg 命令...')

  // 构建 FFmpeg 命令
  // 输入顺序：avatar(0) + bg_image(1可选) + audio(最后)
  const inputArgs: string[] = []
  inputArgs.push(`-loop 1 -i "${avatarPath}"`)
  
  if (effectiveBackgroundType === 'image' && effectiveBackgroundValue) {
    inputArgs.push(`-loop 1 -i "${effectiveBackgroundValue}"`)
  }
  
  inputArgs.push(`-i "${audioPath}"`)

  // 音频输入索引
  const audioInputIndex = (effectiveBackgroundType === 'image' && effectiveBackgroundValue) ? 2 : 1

  // 构建完整命令
  let cmd = `${FFMPEG_PATH} -y -loglevel warning `
    + inputArgs.join(' ')
    + ` -filter_complex "${filterComplex}"`
    + ` -map "${outvLabel}" -map ${audioInputIndex}:a`
    + ` -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p`
    + ` -c:a aac -b:a 128k`
    + ` -movflags +faststart`
    + ` -t ${audioDuration}`
    + ` -max_muxing_queue_size 4096`
    + ` -thread_queue_size 1024`
    + ` "${outputPath}"`

  console.log('[Pipeline] FFmpeg 命令:')
  console.log(cmd.substring(0, 500) + (cmd.length > 500 ? '...' : ''))

  // 计算超时
  const timeoutMs = Math.round(Math.min(Math.max(audioDuration * 5 + 180, 180), 600) * 1000)
  console.log(`[Pipeline] FFmpeg 超时设置: ${Math.round(timeoutMs / 1000)}秒`)

  return new Promise<void>((resolve, reject) => {
    // 构建 spawn 参数数组
    const spawnArgs: string[] = [
      '-y',
      '-loglevel', 'warning',
      '-stream_loop', '-1',
      '-i', avatarPath
    ]

    // 添加背景图输入
    if (effectiveBackgroundType === 'image' && effectiveBackgroundValue) {
      spawnArgs.push('-stream_loop', '-1', '-i', effectiveBackgroundValue)
    }

    // 添加音频输入
    spawnArgs.push('-i', audioPath)

    // 添加滤镜和输出
    spawnArgs.push(
      '-filter_complex', filterComplex,
      '-map', outvLabel,
      '-map', `${audioInputIndex}:a`,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-max_muxing_queue_size', '4096',
      '-thread_queue_size', '1024',
      '-t', audioDuration.toString(),
      outputPath
    )

    const ffmpegCmd: ChildProcess = spawn(FFMPEG_PATH, spawnArgs)

    // 超时处理
    const timer = setTimeout(() => {
      ffmpegCmd.kill('SIGTERM')
      reject(new Error(`FFmpeg 执行超时 (${timeoutMs}ms)`))
    }, timeoutMs)

    ffmpegCmd.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) {
        console.log('[Pipeline] 视频合成完成')
        // 清理渐变背景图
        if (gradientTempFile && fs.existsSync(gradientTempFile)) {
          try {
            fs.unlinkSync(gradientTempFile)
            console.log('[Pipeline] 已清理渐变背景图')
          } catch {}
        }
        resolve()
      } else {
        const errorMsg = `ffmpeg exited with code ${code}`
        console.error('[Pipeline] ' + errorMsg)
        if (errorOutput) {
          console.error('[Pipeline] FFmpeg 错误输出:', errorOutput.substring(0, 2000))
        }
        reject(new Error(errorMsg))
      }
    })

    ffmpegCmd.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })

    // 消费 stderr 防止进程阻塞
    let errorOutput = ''
    ffmpegCmd.stderr?.on('data', (chunk) => {
      errorOutput += chunk.toString()
    })
  })
}

// ============ 存储 ============

/**
 * 上传视频到 COS
 * @param filePath 本地视频文件路径
 * @param videoId 视频 ID（用于 COS 对象键）
 * @returns CDN 访问地址
 */
async function uploadVideoToCOS(filePath: string, videoId: number): Promise<string> {
  if (!isCOSConfigured()) {
    // 回退到本地存储
    const fileName = path.basename(filePath)
    const staticDir = path.join(process.cwd(), 'public', 'videos')
    ensureDir(staticDir)
    const staticPath = path.join(staticDir, fileName)
    fs.copyFileSync(filePath, staticPath)
    const localUrl = '/api/static/videos/' + fileName
    console.log('[Storage] COS 未配置，已保存到本地:', localUrl)
    return localUrl
  }

  const cosKey = getCOSKey('video', undefined, videoId, 'mp4')
  const cdnUrl = await uploadToCOS(filePath, cosKey)
  console.log('[Storage] 视频已上传到 COS:', cdnUrl)
  return cdnUrl
}

/**
 * 提取视频第一帧作为缩略图
 * @param videoPath 视频文件路径
 * @param videoId 视频 ID（用于命名）
 * @returns 缩略图文件路径
 */
async function extractVideoThumbnail(videoPath: string, videoId: number): Promise<string> {
  const thumbnailPath = path.join(tempDir, `thumbnail_${videoId || Date.now()}.jpg`)
  
  return new Promise((resolve, reject) => {
    const args = [
      '-i', videoPath,
      '-ss', '00:00:00.100',  // 取第一帧（稍微延迟一点确保有画面）
      '-vframes', '1',
      '-q:v', '2',  // 较高质量
      '-y',  // 覆盖已有文件
      thumbnailPath
    ]
    
    const cmd = spawn(FFMPEG_PATH, args)
    let errorOutput = ''
    
    cmd.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })
    
    cmd.on('close', (code) => {
      if (code === 0 && fs.existsSync(thumbnailPath)) {
        console.log('[Storage] 缩略图已生成:', thumbnailPath)
        resolve(thumbnailPath)
      } else {
        console.log('[Storage] 缩略图生成失败:', errorOutput.substring(0, 200))
        resolve('')  // 不阻塞主流程
      }
    })
    
    cmd.on('error', (err) => {
      console.error('[Storage] 缩略图生成命令启动失败:', err)
      resolve('')
    })
  })
}

/**
 * 上传缩略图到 COS
 * @param thumbnailPath 本地缩略图路径
 * @param videoId 视频 ID
 * @returns 缩略图 URL
 */
async function uploadThumbnailToCOS(thumbnailPath: string, videoId: number): Promise<string> {
  if (!thumbnailPath || !fs.existsSync(thumbnailPath)) {
    console.log('[Storage] 缩略图文件不存在，跳过上传')
    return ''
  }

  if (!isCOSConfigured()) {
    // 回退到本地存储
    const fileName = path.basename(thumbnailPath)
    const staticDir = path.join(process.cwd(), 'public', 'thumbnails')
    ensureDir(staticDir)
    const staticPath = path.join(staticDir, fileName)
    fs.copyFileSync(thumbnailPath, staticPath)
    const localUrl = '/api/static/thumbnails/' + fileName
    console.log('[Storage] COS 未配置，缩略图保存在本地:', localUrl)
    return localUrl
  }

  const cosKey = getCOSKey('thumbnail', undefined, videoId, 'jpg')
  const cdnUrl = await uploadToCOS(thumbnailPath, cosKey)
  console.log('[Storage] 缩略图已上传到 COS:', cdnUrl)
  return cdnUrl
}

// ============ 主流水线 ============

export async function executeVideoPipeline(params: VideoPipelineParams): Promise<VideoPipelineResult> {
  const {
    userId,
    avatarId,
    script,
    title,
    subtitleFontSize,
    subtitleFontColor,
    backgroundType,
    backgroundValue
  } = params

  console.log('\n========================================')
  console.log('[Pipeline] ========== 执行开始 ==========')
  console.log('[Pipeline] videoId:', params.videoId)
  console.log('========================================')

  // 推送开始进度
  if (params.videoId) {
    console.log('[Pipeline] 推送进度: 开始生成视频... (5%)')
    pushProgress('', params.videoId, '开始生成视频...', 5)
  } else {
    console.warn('[Pipeline] videoId 为空，跳过进度推送')
  }

  // ========== 应用默认值 ==========
  
  // 1. 标题默认值：使用当前时间生成
  const effectiveTitle = title?.trim() || `视频_${new Date().toLocaleString('zh-CN')}`
  console.log('[Pipeline] 标题: ' + effectiveTitle + (title ? ' (用户填写)' : ' (默认生成)'))
  
  // 2. 形象默认值：使用第一张系统预设形象
  const effectiveAvatarId = avatarId || getDefaultAvatarId()
  console.log('[Pipeline] 形象ID: ' + effectiveAvatarId + (avatarId ? ' (用户选择)' : ' (默认系统形象)'))

  // 字幕字号默认值：28
  const effectiveSubtitleFontSize = subtitleFontSize ?? DEFAULT_SUBTITLE_FONT_SIZE
  console.log('[Pipeline] 字幕字号: ' + effectiveSubtitleFontSize + (subtitleFontSize !== undefined ? ' (用户填写)' : ' (默认)'))
  
  // 字幕颜色默认值：white
  const effectiveSubtitleFontColor = subtitleFontColor || DEFAULT_SUBTITLE_FONT_COLOR
  console.log('[Pipeline] 字幕颜色: ' + effectiveSubtitleFontColor + (subtitleFontColor ? ' (用户填写)' : ' (默认)'))
  
  // 背景配置
  const effectiveBackgroundType = backgroundType || undefined
  const effectiveBackgroundValue = backgroundValue || undefined
  console.log('[Pipeline] 背景类型: ' + (effectiveBackgroundType || '(形象图片)'))
  console.log('[Pipeline] 背景值: ' + (effectiveBackgroundValue || '(无)'))
  
  console.log('[Pipeline] 文案长度: ' + script.length + ' 字符')
  console.log('[Pipeline] 音色: ' + (params.voiceType || '(未设置)'))
  console.log('========================================\n')

  let avatarPath = ''
  let audioPath = ''
  const tempFiles: string[] = []

  try {
    // Step 1: 下载形象图片
    console.log('[Pipeline] Step 1: 下载形象图片...')
    if (params.videoId) {
      console.log('[Pipeline] 推送进度: 正在下载形象图片... (5%)')
      pushProgress('', params.videoId, '正在下载形象图片...', 5)
    }
    const avatarResult = await getAvatarPath(effectiveAvatarId, userId)
    // 合并抠图临时文件到保护列表
    if (avatarResult.tempFiles?.length) {
      tempFiles.push(...avatarResult.tempFiles)
    }
    avatarPath = await getFfprobeCompatiblePath(avatarResult.path)
    console.log('[Pipeline] 形象图片: ' + avatarPath)

    // 形象图片处理完成
    if (params.videoId) {
      pushProgress('', params.videoId, '正在处理形象图片...', 15)
    }

    // Step 2: 生成 TTS 音频（耗时步骤，启动伪进度）
    console.log('\n[Pipeline] Step 2: 生成 TTS 音频...')
    if (params.videoId) {
      startStepProgress(params.videoId, '正在生成配音...', 'tts')
    }
    const ttsResult = await synthesizeSpeech({ text: script, voiceType: params.voiceType })

    if (!ttsResult.success || !ttsResult.localPath) {
      if (params.videoId) {
        stopStepProgress(params.videoId, 15)
      }
      throw new Error(ttsResult.error || 'TTS 生成失败')
    }

    audioPath = ttsResult.localPath
    console.log('[Pipeline] 音频路径: ' + audioPath)
    if (params.videoId) {
      stopStepProgress(params.videoId, 40)  // 推送到 TTS 终点
    }

    // Step 3: 获取音频时长（必须精确）
    console.log('\n[Pipeline] Step 3: 获取音频时长...')
    const audioDuration = await getAudioDuration(audioPath)
    console.log('[Pipeline] 音频时长: ' + safeToFixed(audioDuration, 2) + 's')

    // Step 4: 生成字幕数据（从 TTS segments 获取时间轴）
    console.log('\n[Pipeline] Step 4: 生成字幕数据...')
    const subtitles: SubtitleLine[] = []

    if (ttsResult.segments && ttsResult.segments.length > 0) {
      for (let i = 0; i < ttsResult.segments.length; i++) {
        const seg = ttsResult.segments[i]
        subtitles.push({
          index: i + 1,
          start: seg.start || 0,
          end: (seg.start || 0) + seg.duration,
          text: seg.text
        })
      }
      console.log('[Pipeline] 字幕数量: ' + subtitles.length)
    } else {
      // 如果没有 segments，生成整段字幕
      subtitles.push({
        index: 1,
        start: 0,
        end: audioDuration,
        text: script
      })
      console.log('[Pipeline] 无 segments，使用整段字幕')
    }

    // Step 5: 生成 SRT 字幕文件（用于 FFmpeg subtitles 滤镜烧录）
    let srtPath = ''
    console.log('\n[Pipeline] Step 5: 生成 SRT 字幕文件...')
    if (ttsResult.segments && ttsResult.segments.length > 0) {
      srtPath = await generateSRT(ttsResult.segments, 0, params.videoId)
      if (srtPath) {
        tempFiles.push(srtPath)  // 清理时删除
      }
    }

    // Step 6: 生成视频（耗时步骤，启动伪进度）
    console.log('\n[Pipeline] Step 6: 生成视频...')
    if (params.videoId) {
      startStepProgress(params.videoId, '正在合成视频...', 'video')
    }
    
    // 从形象图片提取主色调作为背景色
    const dominantColor = await getDominantColor(avatarPath)
    
    const outputPath = path.join(tempDir, 'video_' + Date.now() + '.mp4')
    tempFiles.push(outputPath)

    try {
      await generateVideoOneCommand(
        avatarPath,
        audioPath,
        subtitles,
        audioDuration,
        avatarResult.hasNoBg,
        {
          title: effectiveTitle,
          subtitleFontSize: effectiveSubtitleFontSize,
          subtitleFontColor: effectiveSubtitleFontColor,
          backgroundType: effectiveBackgroundType,
          backgroundValue: effectiveBackgroundValue,
          dominantColor: dominantColor
        },
        outputPath,
        srtPath
      )
    } finally {
      // 视频生成完成，停止伪进度
      if (params.videoId) {
        stopStepProgress(params.videoId, 80)  // 推送到视频合成终点
      }
    }

    // Step 7: 生成并上传 WebVTT 字幕（仅用于前端预览，不需要烧录到视频）
    let subtitleUrl = ''
    console.log('\n[Pipeline] Step 7: 生成字幕文件...')
    if (params.videoId) {
      pushProgress('', params.videoId, '正在添加字幕...', 80)
    }
    if (ttsResult.segments && ttsResult.segments.length > 0) {
      const vttPath = await generateWebVTT(ttsResult.segments, params.videoId)
      if (vttPath && params.videoId) {
        subtitleUrl = await uploadSubtitleToCOS(vttPath, params.videoId)
        tempFiles.push(vttPath)  // 清理时删除
      }
    }

    // Step 8: 保存视频到 COS
    console.log('\n[Pipeline] Step 8: 保存视频到 COS...')
    if (params.videoId) {
      pushProgress('', params.videoId, '正在上传视频...', 95)
    }
    const videoUrl = await uploadVideoToCOS(outputPath, params.videoId || 0)

    // Step 8.5: 提取视频第一帧作为缩略图
    console.log('\n[Pipeline] Step 8.5: 提取视频缩略图...')
    let thumbnailUrl = ''
    const thumbnailPath = await extractVideoThumbnail(outputPath, params.videoId || 0)
    if (thumbnailPath) {
      thumbnailUrl = await uploadThumbnailToCOS(thumbnailPath, params.videoId || 0)
      tempFiles.push(thumbnailPath)  // 清理时删除
    }

    // Step 9: 清理临时文件
    console.log('\n[Pipeline] Step 9: 清理临时文件...')
    for (const tempFile of tempFiles) {
      if (tempFile && fs.existsSync(tempFile)) {
        try { fs.unlinkSync(tempFile) } catch {}
      }
    }
    if (audioPath && fs.existsSync(audioPath)) {
      try { fs.unlinkSync(audioPath) } catch {}
    }
    // 清理全局临时文件（包括下载的远程图片）
    cleanupAllTempDirs()

    console.log('\n========================================')
    console.log('[Pipeline] ========== 执行完成 ==========')
    console.log('[Pipeline] 视频 URL: ' + videoUrl)
    console.log('[Pipeline] 字幕 URL: ' + subtitleUrl)
    console.log('[Pipeline] 缩略图 URL: ' + thumbnailUrl)
    console.log('[Pipeline] 视频时长: ' + Math.round(audioDuration) + 's')
    console.log('========================================\n')
    
    // 推送完成进度
    if (params.videoId) {
      pushProgress('', params.videoId, '处理完成', 100)
    }

    // 清理 temp 目录
    cleanupTempDirectory()

    return {
      success: true,
      videoUrl,
      subtitleUrl,
      thumbnail: thumbnailUrl,
      duration: audioDuration,
      message: '视频生成成功'
    }

  } catch (error: any) {
    console.error('\n========================================')
    console.error('[Pipeline] ========== 执行失败 ==========')
    console.error('[Pipeline] 错误:', error.message)
    console.error('========================================\n')

    // 推送失败进度
    if (params.videoId) {
      pushProgress('', params.videoId, `生成失败: ${error.message}`, 0, { error: true })
    }

    // 清理
    for (const tempFile of tempFiles) {
      if (tempFile && fs.existsSync(tempFile)) {
        try { fs.unlinkSync(tempFile) } catch {}
      }
    }
    if (audioPath && fs.existsSync(audioPath)) {
      try { fs.unlinkSync(audioPath) } catch {}
    }
    // 清理全局临时文件（包括下载的远程图片）
    cleanupAllTempDirs()

    // 清理 temp 目录
    cleanupTempDirectory()

    return {
      success: false,
      error: error.message || '视频生成失败'
    }
  }
}

// ============ 数据库操作 ============

export function createVideoRecord(params: {
  userId: number
  script: string
  title?: string
  avatarId?: number
  voiceId?: number
  background?: { type: 'color' | 'image'; value: string } | string
  status?: string
}): number {
  const { userId, script, title, avatarId, voiceId, background, status = 'pending' } = params

  const backgroundValue = background
    ? (typeof background === 'string' ? background : JSON.stringify(background))
    : ''

  const videoTitle = title?.trim() || '视频_' + new Date().toLocaleString('zh-CN')

  const result = db.prepare(`
    INSERT INTO videos (user_id, title, script, avatar_id, voice_id, background, status, progress)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    userId,
    videoTitle,
    script,
    avatarId || null,
    voiceId || null,
    backgroundValue,
    status
  )

  return result.lastInsertRowid as number
}

export function updateVideoRecord(
  videoId: number,
  updates: {
    status?: string
    url?: string
    thumbnail?: string
    duration?: number
    progress?: number
    error?: string
    subtitleUrl?: string  // COS 对象键
  }
): void {
  const setClauses: string[] = []
  const values: any[] = []

  if (updates.status !== undefined) {
    setClauses.push('status = ?')
    values.push(updates.status)
    if (updates.status === 'completed') {
      setClauses.push("completed_at = datetime('now')")
    }
  }
  if (updates.url !== undefined) {
    setClauses.push('url = ?')
    values.push(updates.url)
  }
  if (updates.thumbnail !== undefined) {
    setClauses.push('thumbnail = ?')
    values.push(updates.thumbnail)
  }
  if (updates.duration !== undefined) {
    setClauses.push('duration = ?')
    values.push(updates.duration)
  }
  if (updates.progress !== undefined) {
    setClauses.push('progress = ?')
    values.push(updates.progress)
  }
  if (updates.error !== undefined) {
    setClauses.push('error = ?')
    values.push(updates.error)
  }
  if (updates.subtitleUrl !== undefined) {
    setClauses.push('subtitle_url = ?')
    values.push(updates.subtitleUrl)
  }

  if (setClauses.length > 0) {
    values.push(videoId)
    db.prepare('UPDATE videos SET ' + setClauses.join(', ') + ' WHERE id = ?').run(...values)
  }
}

// ============ 队列处理 ============

async function processQueue() {
  if (isProcessing || videoQueue.length === 0) return
  isProcessing = true
  const task = videoQueue.shift()!
  // 队列取出后更新为生成中
  updateVideoRecord(task.videoId, { status: 'processing', progress: 10 })
  try {
    const result = await executeVideoPipeline(task.params)
    if (result.success) {
      updateVideoRecord(task.videoId, {
        status: 'completed',
        progress: 100,
        url: result.videoUrl,
        subtitleUrl: result.subtitleUrl,
        thumbnail: result.thumbnail,
        duration: result.duration
      })
      // 调用 Webhook
      if (task.webhookUrl) {
        import('../routes/v1/index.js').then(module => {
          module.callWebhook(task.videoId, task.webhookUrl!)
        }).catch(err => {
          console.error('[Pipeline] Webhook 导入失败:', err)
        })
      }
    } else {
      updateVideoRecord(task.videoId, { status: 'failed', error: result.error })
      // 失败时也调用 Webhook
      if (task.webhookUrl) {
        import('../routes/v1/index.js').then(module => {
          module.callWebhook(task.videoId, task.webhookUrl!)
        }).catch(err => {
          console.error('[Pipeline] Webhook 导入失败:', err)
        })
      }
    }
  } catch (error: any) {
    updateVideoRecord(task.videoId, { status: 'failed', error: error.message })
    console.error('[Pipeline] 视频 ' + task.videoId + ' 处理异常:', error)
  } finally {
    isProcessing = false
    processQueue()
  }
}

export async function processVideoAsync(videoId: number, params: VideoPipelineParams, webhookUrl?: string): Promise<void> {
  // 确保 params 中有 videoId
  const pipelineParams = { ...params, videoId }

  // 创建任务后，立即把数据库状态设为 pending（排队中）
  updateVideoRecord(videoId, { status: 'pending', progress: 0 })
  console.log('[Pipeline] 视频 ' + videoId + ' 已加入队列')

  // 把任务推到队列
  videoQueue.push({ videoId, params: pipelineParams, webhookUrl })

  // 调用队列处理
  processQueue()
}
