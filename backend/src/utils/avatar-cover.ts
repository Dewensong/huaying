/**
 * 形象封面图生成工具
 * 用于为缺少 image_url 的预设形象生成封面图
 */

import path from 'path'
import fs from 'fs'
import { exec } from 'child_process'
import db from '../db/index.js'

const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg'
const coverOutputDir = path.join(process.cwd(), 'public', 'images', 'avatars')

// 确保目录存在
if (!fs.existsSync(coverOutputDir)) {
  fs.mkdirSync(coverOutputDir, { recursive: true })
}

/**
 * 为指定形象生成封面图
 * @param avatarId 形象 ID
 * @returns 生成的封面图路径或 null（如果形象不存在）
 */
export async function generateCoverImage(avatarId: number): Promise<string | null> {
  console.log(`[AvatarCover] === 开始生成封面图 avatarId: ${avatarId} ===`)

  // 查询形象数据
  const avatar = db.prepare(`
    SELECT id, user_id, name, image, model_url, type
    FROM avatars
    WHERE id = ?
  `).get(avatarId) as any

  if (!avatar) {
    console.error(`[AvatarCover] 形象不存在: ${avatarId}`)
    return null
  }

  console.log(`[AvatarCover] 形象数据: id=${avatar.id}, name=${avatar.name}, image=${avatar.image ? '有' : '无'}, model_url=${avatar.model_url ? '有' : '无'}`)

  const coverFileName = `avatar_${avatarId}_cover.png`
  const coverPath = path.join(coverOutputDir, coverFileName)
  const coverUrl = `/images/avatars/${coverFileName}`

  // 如果已有 image 且是有效的文件路径（非 base64、非 http），检查文件是否存在
  if (avatar.image && !avatar.image.startsWith('data:') && !avatar.image.startsWith('http')) {
    const imagePath = resolveAvatarImagePath(avatar.image)
    if (imagePath && fs.existsSync(imagePath)) {
      console.log(`[AvatarCover] 形象已有有效图片，跳过生成: ${avatar.image}`)
      return avatar.image
    }
  }

  // 如果 image 是 data URL，提取并保存
  if (avatar.image && avatar.image.startsWith('data:image')) {
    try {
      const matches = avatar.image.match(/^data:image\/(\w+);base64,(.+)$/)
      if (matches && matches.length === 3) {
        const imageType = matches[1]
        const base64Data = matches[2]
        const buffer = Buffer.from(base64Data, 'base64')

        const savePath = path.join(coverOutputDir, `avatar_${avatarId}_cover.${imageType}`)
        const saveUrl = `/images/avatars/avatar_${avatarId}_cover.${imageType}`
        fs.writeFileSync(savePath, buffer)

        // 更新数据库
        updateAvatarImage(avatarId, saveUrl)
        console.log(`[AvatarCover] 已从 base64 生成封面图: ${saveUrl}`)
        return saveUrl
      }
    } catch (err) {
      console.error(`[AvatarCover] 处理 base64 图片失败:`, err)
    }
  }

  // 生成占位封面图（纯色背景 + 形象名称）
  console.log(`[AvatarCover] 开始生成占位封面图...`)
  try {
    await generatePlaceholderCover(coverPath, avatar.name)
    console.log(`[AvatarCover] 生成的封面图路径: ${coverPath}`)

    // 更新数据库
    updateAvatarImage(avatarId, coverUrl)
    console.log(`[AvatarCover] 已更新 avatars 表 image 字段: ${coverUrl}`)

    return coverUrl
  } catch (err) {
    console.error(`[AvatarCover] 生成封面图失败:`, err)
    // 即使生成失败，也更新数据库记录（即使是占位 URL）
    // 但实际上这个封面图如果不存在，video-pipeline 会报错
    throw err
  }
}

/**
 * 解析形象图片路径
 */
function resolveAvatarImagePath(imageUrl: string): string | null {
  if (!imageUrl) return null

  // 处理绝对路径
  if (imageUrl.startsWith('/')) {
    const possiblePaths = [
      path.join(process.cwd(), 'public', imageUrl),
      path.join(process.cwd(), '../frontend/public', imageUrl),
      path.join(process.cwd(), '../frontend/dist', imageUrl),
    ]
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p
      }
    }
  }

  return null
}

/**
 * 生成占位封面图（纯色背景 + 形象名称文字）
 */
async function generatePlaceholderCover(outputPath: string, avatarName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 使用 FFmpeg 生成一张纯色背景 + 文字的图片
    // 深蓝色背景 (#1e293b)，白色文字
    const cmd = `${FFMPEG_PATH} -f lavfi -i "color=color=1e293b:size=512x512" -vf "drawtext=text='${escapeFFmpegText(avatarName)}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:borderw=3:bordercolor=black@0.5" -frames:v 1 -y "${outputPath}"`

    console.log(`[AvatarCover] 执行命令: ${cmd}`)

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`[AvatarCover] FFmpeg 执行失败:`, error.message)
        console.error(`[AvatarCover] stderr:`, stderr.substring(0, 500))
        reject(error)
      } else {
        console.log(`[AvatarCover] FFmpeg 生成成功`)
        resolve()
      }
    })
  })
}

/**
 * 转义 FFmpeg 文本中的特殊字符
 */
function escapeFFmpegText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "'\\''")
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
}

/**
 * 更新形象的 image 字段
 */
export function updateAvatarImage(avatarId: number, imageUrl: string): void {
  db.prepare(`
    UPDATE avatars
    SET image = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(imageUrl, avatarId)
}

/**
 * 批量修复所有缺失 image 的预设形象
 */
export async function fixAllMissingImages(): Promise<{ total: number; fixed: number; failed: number; details: any[] }> {
  console.log(`[AvatarCover] === 开始批量修复缺失的预设形象 ===`)

  // 查询所有 image 为空或 NULL 的预设形象
  const avatars = db.prepare(`
    SELECT id, name, image, model_url, type
    FROM avatars
    WHERE (image IS NULL OR image = '' OR image = '/images/placeholder.svg')
    AND type = 'preset'
    AND enabled = 1
  `).all() as any[]

  console.log(`[AvatarCover] 找到 ${avatars.length} 个需要修复的预设形象`)

  let fixed = 0
  let failed = 0
  const details: any[] = []

  for (const avatar of avatars) {
    console.log(`[AvatarCover] 处理形象: id=${avatar.id}, name=${avatar.name}`)
    try {
      const result = await generateCoverImage(avatar.id)
      if (result) {
        fixed++
        console.log(`[AvatarCover] ✓ 成功修复形象 ${avatar.id}: ${avatar.name} -> ${result}`)
        details.push({ id: avatar.id, name: avatar.name, status: 'success', url: result })
      } else {
        failed++
        console.log(`[AvatarCover] ✗ 修复失败形象 ${avatar.id}: ${avatar.name}`)
        details.push({ id: avatar.id, name: avatar.name, status: 'failed', error: '生成失败' })
      }
    } catch (err) {
      failed++
      console.error(`[AvatarCover] ✗ 修复异常形象 ${avatar.id}:`, err)
      details.push({ id: avatar.id, name: avatar.name, status: 'error', error: (err as Error).message })
    }
  }

  console.log(`[AvatarCover] === 批量修复完成 ===`)
  console.log(`[AvatarCover] 总计: ${avatars.length}, 成功: ${fixed}, 失败: ${failed}`)

  return { total: avatars.length, fixed, failed, details }
}
