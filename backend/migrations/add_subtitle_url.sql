-- 手动迁移脚本：为 videos 表添加 subtitle_url 和 webhook_url 字段
-- 运行方式：在数据库文件目录执行

-- 添加 subtitle_url 字段
ALTER TABLE videos ADD COLUMN subtitle_url VARCHAR(500) NULL;

-- 添加 webhook_url 字段
ALTER TABLE videos ADD COLUMN webhook_url VARCHAR(500) NULL;

-- 添加 url 字段（有些旧数据库可能缺少）
ALTER TABLE videos ADD COLUMN url TEXT;

-- 验证字段是否添加成功
PRAGMA table_info(videos);
