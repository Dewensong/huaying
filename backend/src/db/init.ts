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
  plan TEXT DEFAULT 'free' CHECK(plan IN ('free', 'creator', 'studio', 'enterprise')),
  credits INTEGER DEFAULT 5,
  credits_reset_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 订阅表
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  plan TEXT DEFAULT 'free' CHECK(plan IN ('free', 'creator', 'studio', 'enterprise')),
  start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  end_date DATETIME,
  auto_renew INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 套餐表
CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  price REAL DEFAULT 0,
  credits_per_month INTEGER DEFAULT 0,
  features TEXT DEFAULT '{}',
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  plan_name TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'unpaid' CHECK(status IN ('unpaid', 'paid', 'refunded')),
  payment_method TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 额度日志表
CREATE TABLE IF NOT EXISTS quota_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  video_id INTEGER,
  delta INTEGER NOT NULL,
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 形象表
CREATE TABLE IF NOT EXISTS avatars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT NOT NULL,
  image TEXT,
  image_url_no_bg TEXT,
  model_url TEXT,
  is_rigged INTEGER DEFAULT 0,
  fit_mode VARCHAR(20) DEFAULT 'contain',
  virtualman_key VARCHAR(100),
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
  cost INTEGER DEFAULT 0,
  error TEXT,
  webhook_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- API Keys 表（对外 API 鉴权）
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  name TEXT,
  quota_limit INTEGER DEFAULT 100,
  quota_used INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'expired')),
  last_used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
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

    if (!videosColumns.includes('webhook_url')) {
      db.exec("ALTER TABLE videos ADD COLUMN webhook_url VARCHAR(500) NULL")
      console.log('✅ 已添加 webhook_url 字段到 videos 表')
    }

    // 腾讯云数智人相关字段
    if (!videosColumns.includes('video_source')) {
      db.exec("ALTER TABLE videos ADD COLUMN video_source VARCHAR(50) DEFAULT 'static'")
      console.log('✅ 已添加 video_source 字段到 videos 表')
    }

    if (!videosColumns.includes('digital_human_task_id')) {
      db.exec("ALTER TABLE videos ADD COLUMN digital_human_task_id VARCHAR(200) NULL")
      console.log('✅ 已添加 digital_human_task_id 字段到 videos 表')
    }
  } catch (error) {
    console.log('📝 videos 表字段已存在或无需迁移')
  }

  // api_keys 表迁移
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        api_key TEXT UNIQUE NOT NULL,
        name TEXT,
        quota_limit INTEGER DEFAULT 100,
        quota_used INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'expired')),
        last_used_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `)
    console.log('✅ api_keys 表已创建')

    // 添加 api_keys 索引
    db.exec("CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)")
    db.exec("CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(api_key)")
  } catch (error) {
    console.log('📝 api_keys 表已存在或无需创建')
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
    runBusinessMigrations()

    // 迁移：将旧用户 99999 额度更新为 5
    migrateCredits()

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
function runBusinessMigrations() {
  // users 表添加 is_admin 字段
  try {
    const usersTableInfo = db.prepare("PRAGMA table_info(users)").all() as { name: string }[]
    if (!usersTableInfo.some(col => col.name === 'is_admin')) {
      db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0")
      console.log('[DB] ✅ users 表已添加 is_admin 字段')
    }
  } catch (err) {
    console.log('[DB] is_admin 字段可能已存在:', err)
  }

  // users 表添加 plan_expire_at 字段
  try {
    const usersTableInfo = db.prepare("PRAGMA table_info(users)").all() as { name: string }[]
    if (!usersTableInfo.some(col => col.name === 'plan_expire_at')) {
      db.exec("ALTER TABLE users ADD COLUMN plan_expire_at DATETIME")
      console.log('[DB] ✅ users 表已添加 plan_expire_at 字段')
    }
  } catch (err) {
    console.log('[DB] plan_expire_at 字段可能已存在:', err)
  }

  // plans 表添加 credits 和 duration_days 字段（兼容旧表）
  try {
    const plansTableInfo = db.prepare("PRAGMA table_info(plans)").all() as { name: string }[]

    if (!plansTableInfo.some(col => col.name === 'credits')) {
      db.exec("ALTER TABLE plans ADD COLUMN credits INTEGER NOT NULL DEFAULT 0")
      console.log('[DB] ✅ plans 表已添加 credits 字段')
    }

    if (!plansTableInfo.some(col => col.name === 'duration_days')) {
      db.exec("ALTER TABLE plans ADD COLUMN duration_days INTEGER NOT NULL DEFAULT 30")
      console.log('[DB] ✅ plans 表已添加 duration_days 字段')
    }

    // 迁移：将 credits_per_month 的值复制到 credits（如果存在）
    if (plansTableInfo.some(col => col.name === 'credits_per_month')) {
      db.exec("UPDATE plans SET credits = credits_per_month WHERE credits = 0")
      console.log('[DB] ✅ plans 表 credits_per_month 已迁移到 credits')
    }
  } catch (err) {
    console.log('[DB] plans 表迁移失败:', err)
  }

  // orders 表添加 plan_id 字段
  try {
    const ordersTableInfo = db.prepare("PRAGMA table_info(orders)").all() as { name: string }[]
    if (!ordersTableInfo.some(col => col.name === 'plan_id')) {
      db.exec("ALTER TABLE orders ADD COLUMN plan_id INTEGER REFERENCES plans(id)")
      console.log('[DB] ✅ orders 表已添加 plan_id 字段')
    }
  } catch (err) {
    console.log('[DB] orders 表迁移失败:', err)
  }
}

// ============ 迁移：将旧用户和免费套餐 99999 额度更新为 5 ============
function migrateCredits() {
  try {
    const userResult = db.prepare("UPDATE users SET credits = 5 WHERE credits = 99999").run()
    if (userResult.changes > 0) {
      console.log(`✅ 已将 ${userResult.changes} 位用户的免费额度从 99999 更新为 5`)
    }

    const planResult = db.prepare("UPDATE plans SET credits = 5 WHERE name = 'free' AND credits = 99999").run()
    if (planResult.changes > 0) {
      console.log(`✅ 已将免费套餐 credits 从 99999 更新为 5`)
    }
  } catch (err) {
    console.log('[DB] credits 迁移失败:', err)
  }
}

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

  // 插入/更新默认套餐（统一为4个套餐：免费版/创作者/工作室/企业版）
  console.log('📝 更新套餐数据...')

  // 删除所有旧套餐数据
  db.prepare('DELETE FROM plans').run()
  console.log('✅ 已清理旧套餐数据')

  // 插入正确的4个套餐
  const plans = [
    { name: 'free', label: '免费版', price: 0, credits: 5, duration_days: 30, features: JSON.stringify({ avatars: 3, voices: 3, hdVideo: false, voiceClone: false, batchMode: false, priority: false }) },
    { name: 'creator', label: '创作者', price: 99, credits: 30, duration_days: 30, features: JSON.stringify({ avatars: 10, voices: 10, hdVideo: true, voiceClone: false, batchMode: false, priority: false }) },
    { name: 'studio', label: '工作室', price: 299, credits: 200, duration_days: 30, features: JSON.stringify({ avatars: -1, voices: -1, hdVideo: true, voiceClone: true, batchMode: true, priority: true }) },
    { name: 'enterprise', label: '企业版', price: 999, credits: -1, duration_days: 30, features: JSON.stringify({ avatars: -1, voices: -1, hdVideo: true, voiceClone: true, batchMode: true, priority: true }) }
  ];

  const insertPlan = db.prepare('INSERT INTO plans (name, label, price, credits, duration_days, features) VALUES (?, ?, ?, ?, ?, ?)')
  for (const plan of plans) {
    insertPlan.run(plan.name, plan.label, plan.price, plan.credits, plan.duration_days, plan.features)
  }
  console.log('✅ 4个默认套餐已插入（免费版/创作者/工作室/企业版）')

  console.log('✅ 预设数据初始化完成（形象系统已改造为用户自定义模式）')
}

// 运行初始化
initDatabase()

export default db
