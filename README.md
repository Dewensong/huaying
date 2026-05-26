# 话映 (HuaYing) — AI 口播视频自动生成平台

一个「文案 → AI 口播视频」的自动化流水线平台。输入文字、选择形象和声音，自动合成带字幕的口播视频。

[![Vue 3](https://img.shields.io/badge/Vue-3.x-42b883?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express.js](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3.x-003b57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![MIT License](https://img.shields.io/badge/license-MIT-green)](./LICENSE.md)

## 功能

- **文字转视频合成** — 输入文案，选择形象和声音，一键生成口播视频（FFmpeg 合成）
- **AI 文案生成** — 接入火山方舟 LLM，自动生成创意口播文案
- **声音克隆** — 上传音频样本，克隆自定义音色（火山引擎声音复刻）
- **形象管理** — 自定义上传/管理口播头像
- **模板系统** — 保存常用配置组合，一键复用
- **WebSocket 实时进度** — 任务进度实时推送

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + Vite + TypeScript + TailwindCSS + Element Plus + Pinia |
| 后端 | Express.js + TypeScript + SQLite (better-sqlite3) + JWT |
| AI 服务 | 火山方舟（LLM + TTS）+ 火山引擎声音复刻 |
| 视频合成 | FFmpeg |
| 存储 | 腾讯云 COS |
| 短信 | 阿里云短信（手机验证码登录） |

## 项目结构

```
huaying/
├── frontend/          # Vue 3 前端
│   └── src/
│       ├── api/       # API 请求层
│       ├── components/ # 全局组件
│       ├── composables/ # 组合式函数
│       ├── modules/   # 功能模块（auth/avatar/dashboard/video/voice/script/template/landing）
│       ├── router/    # 路由
│       ├── stores/    # Pinia 状态管理
│       └── styles/    # 全局样式
├── backend/           # Express 后端
│   └── src/
│       ├── config/    # 配置
│       ├── db/        # 数据库
│       ├── middleware/ # 中间件（认证）
│       ├── routes/    # API 路由
│       └── services/  # 业务服务（视频流水线/TTS/声音克隆/Seedream）
└── docs/              # 文档
```

## 快速开始

### 环境要求

- Node.js >= 18
- FFmpeg（视频合成）
- 火山方舟 API Key
- 腾讯云 COS（可选，用于云端存储）

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/Dewensong/huaying.git
cd huaying

# 后端
cd backend
cp .env.example .env   # 编辑 .env 填入 API Key
npm install
npm run dev             # 启动在 http://localhost:3000

# 前端（新终端）
cd frontend
npm install
npm run dev             # 启动在 http://localhost:5173
```

### 环境变量

在 `backend/.env` 中配置：

```env
PORT=3000
JWT_SECRET=your_secret_key

# 火山方舟
ARK_API_KEY=your_ark_api_key
ARK_API_ENDPOINT=https://ark.cn-beijing.volces.com/api/v3
ARK_MODEL=your_model_id

# 火山 TTS
VOLCANO_TTS_APP_ID=your_tts_app_id
VOLCANO_TTS_ACCESS_KEY=your_tts_access_key

# 火山声音复刻
VOLCANO_SPEECH_API_KEY=your_speech_api_key

# 腾讯云 COS
COS_SECRET_ID=your_secret_id
COS_SECRET_KEY=your_secret_key
COS_BUCKET=your_bucket
COS_REGION=ap-beijing

# 阿里云短信
ALIYUN_SMS_ACCESS_KEY_ID=your_access_key
ALIYUN_SMS_ACCESS_KEY_SECRET=your_secret
```

## 许可证

基于 MIT 协议开源。本项目基于 [智播坊](https://gitee.com/zhang-dongtao/zhibofang) 修改而来。

---

**维护者**: [Dewensong](https://github.com/Dewensong)
