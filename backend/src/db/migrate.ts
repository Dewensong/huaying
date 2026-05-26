import db from './index.js'

/**
 * 数据库迁移脚本
 * 为 avatars 表添加 model_url 和 is_rigged 字段
 * 用于支持 3D 数字人模型
 */
export function runMigrations() {
  console.log('🔄 运行数据库迁移...')

  try {
    // ========== avatars 表迁移 ==========
    const avatarsTableInfo = db.prepare("PRAGMA table_info(avatars)").all() as { name: string }[]
    const avatarsColumns = avatarsTableInfo.map(col => col.name)

    if (!avatarsColumns.includes('model_url')) {
      db.exec("ALTER TABLE avatars ADD COLUMN model_url VARCHAR(500) NULL")
      console.log('✅ 已添加 model_url 字段')
    }

    if (!avatarsColumns.includes('is_rigged')) {
      db.exec("ALTER TABLE avatars ADD COLUMN is_rigged INTEGER DEFAULT 0")
      console.log('✅ 已添加 is_rigged 字段')
    }

    if (!avatarsColumns.includes('fit_mode')) {
      db.exec("ALTER TABLE avatars ADD COLUMN fit_mode VARCHAR(20) DEFAULT 'contain'")
      console.log('✅ 已添加 fit_mode 字段 (contain: 完整显示/cover: 填满画面)')
    }

    if (!avatarsColumns.includes('image_url_no_bg')) {
      db.exec("ALTER TABLE avatars ADD COLUMN image_url_no_bg VARCHAR(500) NULL")
      console.log('✅ 已添加 image_url_no_bg 字段（抠图后的透明背景图片）')
    }

    // ========== videos 表迁移 ==========
    const videosTableInfo = db.prepare("PRAGMA table_info(videos)").all() as { name: string }[]
    const videosColumns = videosTableInfo.map(col => col.name)

    if (!videosColumns.includes('duration')) {
      db.exec("ALTER TABLE videos ADD COLUMN duration INTEGER DEFAULT 0")
      console.log('✅ 已添加 duration 字段')
    }

    if (!videosColumns.includes('cost')) {
      db.exec("ALTER TABLE videos ADD COLUMN cost INTEGER DEFAULT 0")
      console.log('✅ 已添加 cost 字段')
    }

    console.log('🎉 数据库迁移完成')
  } catch (error) {
    console.error('❌ 迁移失败:', error)
    throw error
  }
}

// 自动执行迁移
runMigrations()
