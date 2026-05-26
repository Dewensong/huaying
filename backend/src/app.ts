import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import path from 'path'
import http from 'http'
import { fileURLToPath } from 'url'
import { config } from './config/index.js'
import { initWebSocketServer } from './services/task-progress.ws.js'

// 初始化数据库（执行迁移）
import './db/init.js'

// 启动时自动修复所有缺失 image 的预设形象
import { fixAllMissingImages } from './utils/avatar-cover.js'

// CommonJS 兼容的 __dirname 获取方式
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 导入路由
import authRoutes from './routes/core/auth.js'
import avatarRoutes from './routes/core/avatars.js'
import voiceRoutes from './routes/core/voices.js'
import scriptRoutes from './routes/core/scripts.js'
import videoRoutes from './routes/core/videos.js'
import templateRoutes from './routes/core/templates.js'
import dashboardRoutes from './routes/core/dashboard.js'
import pipelineRoutes from './routes/core/pipeline.js'
import cosRoutes from './routes/core/cos.js'
import uploadRoutes from './routes/core/upload.js'
import aiRoutes from './routes/core/ai.js'
import v1Routes from './routes/v1/index.js'

const app = express()

// 中间件
app.use(cors())
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}))
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// 静态文件
app.use(express.static(path.join(__dirname, '../../frontend/dist')))

// 媒体文件静态服务（视频、TTS音频等）
app.use('/api/static', express.static(path.join(__dirname, '../public')))

// API 路由
app.use('/api/core/auth', authRoutes)
app.use('/api/core/avatars', avatarRoutes)
app.use('/api/core/voices', voiceRoutes)
app.use('/api/core/scripts', scriptRoutes)
app.use('/api/core/videos', videoRoutes)
app.use('/api/core/templates', templateRoutes)
app.use('/api/core/dashboard', dashboardRoutes)
app.use('/api/core/cos', cosRoutes)
app.use('/api/core/upload', uploadRoutes)
app.use('/api/core/ai', aiRoutes)
app.use('/api/pipeline', pipelineRoutes)

// 对外 API v1
app.use('/api/v1', v1Routes)

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// SPA 路由
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'))
})

// 错误处理
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(500).json({ message: '服务器错误' })
})

// 创建 HTTP 服务器（与 Express 和 WebSocket 共享）
const server = http.createServer(app)

// 初始化 WebSocket 服务
initWebSocketServer(server)

// 启动服务器
server.listen(config.port, async () => {
  // 自动修复所有缺失 image 的预设形象
  console.log(`[启动] 正在检查并修复缺失封面图的预设形象...`)
  try {
    const result = await fixAllMissingImages()
    if (result.total > 0) {
      console.log(`[启动] 封面图修复结果: 总计 ${result.total}, 成功 ${result.fixed}, 失败 ${result.failed}`)
    } else {
      console.log(`[启动] 所有预设形象已有封面图，无需修复`)
    }
  } catch (err) {
    console.error(`[启动] 封面图修复失败:`, err)
  }

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎬 话映 - 数字人生产工厂                               ║
║                                                           ║
║   服务已启动                                               ║
║   • API:      http://localhost:${config.port}                       ║
║   • 前端:     http://localhost:${config.port}                       ║
║                                                           ║
║   环境: ${config.nodeEnv.padEnd(46)}║
╚═══════════════════════════════════════════════════════════╝
  `)
})
