import Database, { Database as DatabaseType } from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '../../data/huaying.db')

// 确保目录存在
import fs from 'fs'
const dataDir = path.dirname(dbPath)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const db: DatabaseType = new Database(dbPath)

// 启用 WAL 模式提高性能
db.pragma('journal_mode = WAL')

// 启用外键约束（必须开启才能让 ON DELETE CASCADE 生效）
db.pragma('foreign_keys = ON')

// ============ 数据库迁移 ============

// videos 表添加 mode 字段（视频生成模式：static=静态合成, digital_human=数字人口播）
try {
  const tableInfo = db.prepare("PRAGMA table_info(videos)").all() as { name: string }[]
  const hasMode = tableInfo.some(col => col.name === 'mode')
  if (!hasMode) {
    db.exec("ALTER TABLE videos ADD COLUMN mode VARCHAR(20) DEFAULT 'static'")
    console.log('[DB] ✅ videos 表已添加 mode 字段')
  }
} catch (err) {
  console.log('[DB] mode 字段可能已存在:', err)
}

// videos 表添加 video_source 字段（视频来源：static, digital_human）
try {
  const tableInfo = db.prepare("PRAGMA table_info(videos)").all() as { name: string }[]
  const hasVideoSource = tableInfo.some(col => col.name === 'video_source')
  if (!hasVideoSource) {
    db.exec("ALTER TABLE videos ADD COLUMN video_source VARCHAR(20) DEFAULT 'static'")
    console.log('[DB] ✅ videos 表已添加 video_source 字段')
  }
} catch (err) {
  console.log('[DB] video_source 字段可能已存在:', err)
}

// videos 表添加 digital_human_task_id 字段（腾讯云数智人任务ID）
try {
  const tableInfo = db.prepare("PRAGMA table_info(videos)").all() as { name: string }[]
  const hasTaskId = tableInfo.some(col => col.name === 'digital_human_task_id')
  if (!hasTaskId) {
    db.exec("ALTER TABLE videos ADD COLUMN digital_human_task_id VARCHAR(100)")
    console.log('[DB] ✅ videos 表已添加 digital_human_task_id 字段')
  }
} catch (err) {
  console.log('[DB] digital_human_task_id 字段可能已存在:', err)
}

// avatars 表添加 virtualman_key 字段（腾讯云数智人形象Key）
try {
  const tableInfo = db.prepare("PRAGMA table_info(avatars)").all() as { name: string }[]
  const hasVirtualmanKey = tableInfo.some(col => col.name === 'virtualman_key')
  if (!hasVirtualmanKey) {
    db.exec("ALTER TABLE avatars ADD COLUMN virtualman_key VARCHAR(100)")
    console.log('[DB] ✅ avatars 表已添加 virtualman_key 字段')
  }
} catch (err) {
  console.log('[DB] virtualman_key 字段可能已存在:', err)
}

// avatars 表添加 image_url_no_bg 字段（抠图后的透明背景图片）
try {
  const tableInfo = db.prepare("PRAGMA table_info(avatars)").all() as { name: string }[]
  const hasImageUrlNoBg = tableInfo.some(col => col.name === 'image_url_no_bg')
  if (!hasImageUrlNoBg) {
    db.exec("ALTER TABLE avatars ADD COLUMN image_url_no_bg VARCHAR(500)")
    console.log('[DB] ✅ avatars 表已添加 image_url_no_bg 字段')
  }
} catch (err) {
  console.log('[DB] image_url_no_bg 字段可能已存在:', err)
}

// ============ 声音克隆音色表 ============
try {
  const voiceCloneTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_voice_clones'").get()
  
  if (!voiceCloneTableExists) {
    db.exec(`
      CREATE TABLE user_voice_clones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        speaker_id VARCHAR(100) NOT NULL,
        name VARCHAR(100) NOT NULL,
        status INTEGER DEFAULT 1,
        sample_duration INTEGER,
        language INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, speaker_id)
      )
    `)
    console.log('[DB] ✅ user_voice_clones 表已创建')
  }
} catch (err) {
  console.log('[DB] user_voice_clones 表可能已存在:', err)
}

// ============ 视频模板表 ============
try {
  const templatesTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='templates'").get()
  
  if (!templatesTableExists) {
    db.exec(`
      CREATE TABLE templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        avatar_id INTEGER,
        voice_type TEXT,
        speed_ratio REAL DEFAULT 1.0,
        volume_ratio REAL DEFAULT 1.0,
        background TEXT,
        subtitle_config TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)
    console.log('[DB] ✅ templates 表已创建')
  } else {
    // 表已存在，检查并添加缺失的列
    const tableInfo = db.prepare("PRAGMA table_info(templates)").all() as { name: string }[]
    
    const columnsToAdd = [
      { name: 'voice_type', sql: 'voice_type TEXT' },
      { name: 'speed_ratio', sql: 'speed_ratio REAL DEFAULT 1.0' },
      { name: 'volume_ratio', sql: 'volume_ratio REAL DEFAULT 1.0' },
      { name: 'background', sql: 'background TEXT' },
      { name: 'subtitle_config', sql: 'subtitle_config TEXT' }
    ]
    
    for (const col of columnsToAdd) {
      if (!tableInfo.some(c => c.name === col.name)) {
        db.exec(`ALTER TABLE templates ADD COLUMN ${col.sql}`)
        console.log(`[DB] ✅ templates 表已添加 ${col.name} 字段`)
      }
    }
  }
} catch (err) {
  console.log('[DB] templates 表迁移失败:', err)
}

export default db
