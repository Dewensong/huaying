import db from './index.js'

// 创建表
const createTables = `
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password TEXT,
  name TEXT NOT NULL,
  avatar TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 形象表
CREATE TABLE IF NOT EXISTS avatars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT NOT NULL,
  image TEXT,
  model_url TEXT,
  is_rigged INTEGER DEFAULT 0,
  fit_mode VARCHAR(20) DEFAULT 'contain',
  type TEXT DEFAULT 'custom' CHECK(type IN ('preset', 'custom')),
  config TEXT DEFAULT '{}',
  enabled INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 声音表
CREATE TABLE IF NOT EXISTS voices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT NOT NULL,
  audio TEXT,
  type TEXT DEFAULT 'custom' CHECK(type IN ('preset', 'custom')),
  config TEXT DEFAULT '{}',
  enabled INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 脚本表
CREATE TABLE IF NOT EXISTS scripts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  source TEXT,
  style TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 视频任务表
CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT,
  script TEXT,
  avatar_id INTEGER,
  voice_id INTEGER,
  background TEXT,
  subtitle_config TEXT DEFAULT '{}',
  intro_config TEXT DEFAULT '{}',
  outro_config TEXT DEFAULT '{}',
  thumbnail TEXT,
  url TEXT,
  subtitle_url TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0,
  duration INTEGER DEFAULT 0,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 视频片段表（记录多片段生成中失败片段的信息）
CREATE TABLE IF NOT EXISTS video_segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL,
  segment_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
  video_url TEXT,
  task_id TEXT,
  error TEXT,
  duration INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (video_id) REFERENCES videos(id)
);

-- 模板表
CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  avatar_id INTEGER,
  voice_id INTEGER,
  background TEXT,
  subtitle_config TEXT DEFAULT '{}',
  intro_config TEXT DEFAULT '{}',
  outro_config TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_videos_user_status ON videos(user_id, status);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_scripts_user ON scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_avatars_user ON avatars(user_id);
CREATE INDEX IF NOT EXISTS idx_voices_user ON voices(user_id);
`

// 数据库迁移函数
function runMigrations() {
  // 检查并添加 model_url 字段（对于已存在的数据库）
  try {
    const avatarsTableInfo = db.prepare("PRAGMA table_info(avatars)").all() as { name: string }[]
    const existingColumns = avatarsTableInfo.map(col => col.name)

    if (!existingColumns.includes('model_url')) {
      db.exec("ALTER TABLE avatars ADD COLUMN model_url VARCHAR(500) NULL")
      console.log('✅ 已添加 model_url 字段')
    }

    if (!existingColumns.includes('is_rigged')) {
      db.exec("ALTER TABLE avatars ADD COLUMN is_rigged INTEGER DEFAULT 0")
      console.log('✅ 已添加 is_rigged 字段')
    }

    // 修复缺少 image 字段的预设形象
    const fixImageResult = db.prepare(`
      UPDATE avatars 
      SET image = '/images/avatars/default_avatar.svg' 
      WHERE type = 'preset' AND (image IS NULL OR image = '')
    `).run()
    if (fixImageResult.changes > 0) {
      console.log(`✅ 已修复 ${fixImageResult.changes} 条缺少图片的预设形象`)
    }
  } catch (error) {
    console.log('📝 avatars 表字段已存在或无需迁移')
  }

  // videos 表迁移
  try {
    const videosTableInfo = db.prepare("PRAGMA table_info(videos)").all() as { name: string }[]
    const videosColumns = videosTableInfo.map(col => col.name)

    if (!videosColumns.includes('subtitle_url')) {
      db.exec("ALTER TABLE videos ADD COLUMN subtitle_url VARCHAR(500) NULL")
      console.log('✅ 已添加 subtitle_url 字段到 videos 表')
    }

  } catch (error) {
    console.log('📝 videos 表字段已存在或无需迁移')
  }

  // video_segments 表迁移
  try {
    // 检查 video_segments 表的外键是否有 ON DELETE CASCADE
    // SQLite 不支持 ALTER TABLE 修改外键，需要重建表
    const foreignKeyInfo = db.prepare("PRAGMA foreign_key_list(video_segments)").all() as { from: string; to: string; on_delete: string }[]
    const hasCascade = foreignKeyInfo.some(fk => fk.on_delete === 'CASCADE')

    if (!hasCascade && foreignKeyInfo.length > 0) {
      console.log('[DB] video_segments 表外键缺少 ON DELETE CASCADE，开始重建...')
      // SQLite 重建表：重命名 → 创建新表 → 迁移数据 → 删除旧表
      db.exec(`
        ALTER TABLE video_segments RENAME TO video_segments_old;
        
        CREATE TABLE IF NOT EXISTS video_segments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          video_id INTEGER NOT NULL,
          segment_index INTEGER NOT NULL,
          text TEXT NOT NULL,
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
          video_url TEXT,
          task_id TEXT,
          error TEXT,
          duration INTEGER DEFAULT 0,
          retry_count INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
        );
        
        INSERT INTO video_segments SELECT * FROM video_segments_old;
        
        DROP TABLE video_segments_old;
      `)
      console.log('[DB] ✅ video_segments 表已添加 ON DELETE CASCADE')
    } else if (foreignKeyInfo.length === 0) {
      // 表不存在，创建新表
      db.prepare(`
        CREATE TABLE IF NOT EXISTS video_segments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          video_id INTEGER NOT NULL,
          segment_index INTEGER NOT NULL,
          text TEXT NOT NULL,
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
          video_url TEXT,
          task_id TEXT,
          error TEXT,
          duration INTEGER DEFAULT 0,
          retry_count INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
        )
      `).run()
      console.log('[DB] ✅ video_segments 表已创建（含 ON DELETE CASCADE）')

      // 添加索引
      db.exec("CREATE INDEX IF NOT EXISTS idx_video_segments_video ON video_segments(video_id)")
    } else {
      console.log('[DB] video_segments 表外键已包含 ON DELETE CASCADE')
    }
  } catch (error) {
    console.log('📝 video_segments 表迁移完成或无需迁移:', error)
  }
}

async function initDatabase() {
  console.log('📦 初始化数据库...')
  
  // 关闭外键约束
  db.exec('PRAGMA foreign_keys = OFF')

  try {
    // 执行建表语句
    db.exec(createTables)
    console.log('✅ 数据表创建成功')

    // 运行迁移
    runMigrations()

    // 插入预设数据
    insertPresetData()

    console.log('🎉 数据库初始化完成')
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error)
    process.exit(1)
  } finally {
    // 恢复外键约束
    db.exec('PRAGMA foreign_keys = ON')
  }
}

// ============ 数据库迁移：商业化模块字段补充 ============
// ============ 预设数据插入 ============
function insertPresetData() {
  // ========== 形象系统改造：不再插入预设形象 ==========
  // 所有形象改为用户自定义，不再保留 type='preset' 的预设数据

  // 删除所有预设形象记录
  const deletePresetsResult = db.prepare("DELETE FROM avatars WHERE type = 'preset'").run()
  if (deletePresetsResult.changes > 0) {
    console.log(`✅ 已删除 ${deletePresetsResult.changes} 条预设形象记录`)
  } else {
    console.log('📝 没有预设形象需要删除')
  }

  // ========== 预设声音数据（中文通用场景）- 声音保留不变 ==========
  const presetVoices = [
    {
      name: 'Vivi 活泼女声',
      config: { language: '中文', gender: 'female', speed: 1.0, voice_type: 'zh_female_vv_uranus_bigtts' }
    },
    {
      name: '擎苍 阳光男声',
      config: { language: '中文', gender: 'male', speed: 1.0, voice_type: 'zh_male_qingcang_uranus_bigtts' }
    },
    {
      name: '小何 知性女声',
      config: { language: '中文', gender: 'female', speed: 1.0, voice_type: 'zh_female_xiaohe_uranus_bigtts' }
    },
    {
      name: '云舟 磁性男声',
      config: { language: '中文', gender: 'male', speed: 1.0, voice_type: 'zh_male_m191_uranus_bigtts' }
    },
    {
      name: '暖阳女声 甜美女生',
      config: { language: '中文', gender: 'female', speed: 1.0, voice_type: 'zh_female_tianmeitaozi_uranus_bigtts' }
    }
  ]

  // 删除旧的预设声音，重新插入
  console.log('📝 更新预设声音...')
  db.prepare('DELETE FROM voices WHERE type = ?').run('preset')

  const insertVoice = db.prepare('INSERT INTO voices (user_id, name, type, config) VALUES (NULL, ?, ?, ?)')
  for (const voice of presetVoices) {
    insertVoice.run(voice.name, 'preset', JSON.stringify(voice.config))
  }
  console.log('✅ 5个预设声音已更新')
  console.log('✅ 预设数据初始化完成')
}

// 运行初始化
initDatabase()

export default db
