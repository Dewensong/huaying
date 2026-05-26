# 推进记录

## 2026-05-26

### 已完成

- **Step 0: 项目目录初始化** — 基于 `_templates/ai-project/` 创建项目骨架，迁移前后端代码
- **Step 1: 全局改名** — 智播坊→话映, zhibofang→huaying, ZhiBoFang→HuaYing（29 个文件，80+ 处引用）
- **Step 2: 精简商业化代码** — 删除支付/套餐/额度/API Key/数字人/管理员相关代码（16 个文件）
- **Step 3: README 重写** — 英文 README，涵盖功能介绍、技术栈、本地运行说明
- **Step 4: TypeScript 编译验证** — 修复 15 个 TS 错误，tsc 零错误通过
- **Step 5: UI 设计优化** — 品牌色从蓝紫改为青金（#14B8A6 / #F59E0B），更新所有组件和动画
- **Step 6: 推送 GitHub** — 仓库已创建并推送：https://github.com/Dewensong/huaying

### 技术决策

- 品牌色方案：Teal + Amber（#14B8A6 / #F59E0B），区别于原项目的蓝紫渐变
- 保持 dark slate 底色不变，降低改动范围
- favicon 从损坏的 SVG 替换为完整青底白色摄像机图标

### Git 历史

1. `2174e0e` Initial commit: fork from 智播坊
2. `4cdd66d` Rebrand: 智播坊 → 话映
3. `5f50693` Strip commercial code
4. `1ccf558` Design rebrand + TS fixes
5. `7a2d1ba` Fix README GitHub URL

### 下一步

- 配置火山方舟 API Key 等环境变量后可本地运行
- 可选：添加 GitHub Actions CI/CD
- 可选：部署到服务器
