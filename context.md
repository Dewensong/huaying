# 话映 (HuaYing) - 项目背景

## 项目目标

基于开源项目「智播坊」Fork 改皮，打造一个干净、好看的 AI 口播视频自动生成平台，发布到 GitHub 作为个人展示项目。

## 技术栈

- 前端：Vue 3 + Vite + TypeScript + TailwindCSS + Element Plus + Pinia
- 后端：Express.js + TypeScript + SQLite (better-sqlite3) + JWT
- AI 服务：火山方舟（LLM + TTS + Seedream 图片生成）
- 视频合成：FFmpeg
- 存储：腾讯云 COS

## 约束

- MIT 协议开源
- 国内用户，中文口播场景为主
- MVP 聚焦：文字转视频合成 + AI 文案生成 + 声音克隆
- 剔除原项目所有商业化模块

## 验收标准

- [ ] 前后端代码可编译通过
- [ ] 品牌名称全部替换为话映/huaying
- [ ] 商业化代码全部移除
- [ ] UI 视觉升级完成
- [ ] GitHub 仓库展示效果良好
