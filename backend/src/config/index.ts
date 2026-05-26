import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 加载 .env 文件
dotenv.config({ path: path.join(__dirname, '../../.env') })

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',

  jwt: {
    secret: process.env.JWT_SECRET || 'default_secret_change_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },

  cos: {
    secretId: process.env.COS_SECRET_ID || '',
    secretKey: process.env.COS_SECRET_KEY || '',
    bucket: process.env.COS_BUCKET || '',
    region: process.env.COS_REGION || '',
    appId: process.env.COS_APP_ID || '',
    cdnDomain: process.env.COS_CDN_DOMAIN || ''
  },

  ark: {
    apiKey: process.env.ARK_API_KEY || '',
    apiEndpoint: process.env.ARK_API_ENDPOINT || '',
    model: process.env.ARK_MODEL || ''
  },

  // 第三方 API 超时时间（毫秒），默认 2 分钟
  thirdPartyTimeout: parseInt(process.env.THIRD_PARTY_TIMEOUT || '120000'),

  volcanoTts: {
    appId: process.env.VOLCANO_TTS_APP_ID || '',
    accessKey: process.env.VOLCANO_TTS_ACCESS_KEY || '',
    speaker: process.env.VOLCANO_TTS_SPEAKER || 'zh_female_vv_uranus_bigtts'
  },

  // 火山引擎声音复刻 API (V3)
  volcanoSpeechApiKey: process.env.VOLCANO_SPEECH_API_KEY || ''
}
