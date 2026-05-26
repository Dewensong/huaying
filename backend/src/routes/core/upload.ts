/**
 * 文件上传路由
 * 使用 multer 处理文件上传，然后存储到 COS
 */

import { Router, Response } from 'express'
import multer from 'multer'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { authenticate, type AuthRequest } from '../../middleware/auth.js'
import { uploadBufferToCOS, isCOSConfigured } from '../../config/cos.js'

const router = Router()

// 配置 multer 内存存储
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/ogg',
      'audio/x-m4a', 'audio/mp4', 'audio/m4a', 'audio/aac'
    ]
    const allowedExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac']
    const ext = path.extname(file.originalname).toLowerCase()
    
    const hasValidMime = allowedMimes.some(m => file.mimetype.toLowerCase().includes(m.split('/')[1]))
    const hasValidExt = allowedExts.includes(ext)
    
    if (hasValidMime || hasValidExt) {
      cb(null, true)
    } else {
      cb(new Error('不支持的文件格式'))
    }
  }
})

/**
 * POST /api/core/upload
 * 上传音频文件
 */
router.post('/', authenticate, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '没有上传文件'
      })
    }

    const file = req.file
    const ext = path.extname(file.originalname).toLowerCase()
    const filename = `audio/${uuidv4()}${ext}`

    // 上传到 COS
    if (isCOSConfigured()) {
      const cosUrl = await uploadBufferToCOS(file.buffer, filename, file.mimetype)
      
      return res.json({
        success: true,
        url: cosUrl,
        filename: path.basename(filename),
        size: file.size,
        mimeType: file.mimetype
      })
    }

    // COS 未配置时返回错误
    return res.status(503).json({
      success: false,
      message: '文件存储服务未配置'
    })
  } catch (error: any) {
    console.error('[Upload] 上传失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '上传失败'
    })
  }
})

export default router
