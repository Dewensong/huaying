/**
 * 火山引擎声音复刻服务 (V3 API)
 * API 文档: https://openspeech.bytedance.com/api/v3/tts/voice_clone
 */

import axios from 'axios'
import crypto from 'crypto'
import { config } from '../config/index.js'

// ============ 类型定义 ============

export interface CloneVoiceOptions {
  speakerId: string        // 音色槽位ID
  audioBase64: string      // base64编码的音频
  audioFormat: string     // 音频格式：wav/mp3/ogg/m4a/aac/pcm
  text?: string           // 可选：参考文本
  language?: number       // 可选：0=中文 1=英文
  enableAudioDenoise?: boolean  // 可选：是否降噪
}

export interface SpeakerStatusItem {
  model_type: number
  icl_speaker_id: string
  demo_audio?: string
  status: number
}

export interface VoiceStatus {
  speakerId: string
  status: number          // 0=NotFound 1=Training 2=Success 3=Failed 4=Active
  statusText: string
  isReady: boolean        // status === 2 或 4
  speakerStatus?: SpeakerStatusItem[]  // 完整的音色状态数组
  iclSpeakerId?: string   // 取 model_type 最大的 icl_speaker_id
}

export interface CloneResult {
  success: boolean
  message: string
  speakerId?: string
  error?: string
}

// ============ API 调用 ============

const VOLCANO_VOICE_CLONE_API = 'https://openspeech.bytedance.com/api/v3/tts/voice_clone'
const VOLCANO_GET_VOICE_API = 'https://openspeech.bytedance.com/api/v3/tts/get_voice'

/**
 * 获取 API Key
 */
function getApiKey(): string {
  return config.volcanoSpeechApiKey || process.env.VOLCANO_SPEECH_API_KEY || ''
}

/**
 * 音色复刻训练
 * 上传音频样本，让模型学习音色特征
 */
export async function cloneVoice(options: CloneVoiceOptions): Promise<CloneResult> {
  const apiKey = getApiKey()
  
  if (!apiKey) {
    return {
      success: false,
      message: '未配置火山引擎声音复刻 API Key',
      error: 'VOLCANO_SPEECH_API_KEY is not configured'
    }
  }

  if (!options.speakerId) {
    return {
      success: false,
      message: '缺少 speakerId 参数',
      error: 'speakerId is required'
    }
  }

  if (!options.audioBase64) {
    return {
      success: false,
      message: '缺少音频数据',
      error: 'audioBase64 is required'
    }
  }

  if (!options.audioFormat) {
    return {
      success: false,
      message: '缺少音频格式',
      error: 'audioFormat is required'
    }
  }

  // 检查音频格式是否支持
  const supportedFormats = ['wav', 'mp3', 'ogg', 'm4a', 'aac', 'pcm']
  if (!supportedFormats.includes(options.audioFormat.toLowerCase())) {
    return {
      success: false,
      message: `不支持的音频格式：${options.audioFormat}，支持格式：${supportedFormats.join('/')}`,
      error: 'Unsupported audio format'
    }
  }

  console.log('[VoiceClone] 开始音色复刻训练:', {
    speakerId: options.speakerId,
    audioFormat: options.audioFormat,
    audioSize: Math.round(options.audioBase64.length / 1024) + ' KB',
    language: options.language ?? 0
  })

  try {
    const requestBody: any = {
      speaker_id: options.speakerId,
      audio: {
        data: options.audioBase64,
        format: options.audioFormat
      }
    }

    // 添加可选参数
    if (options.text) {
      requestBody.text = options.text
    }
    
    if (options.language !== undefined) {
      requestBody.language = options.language
    }

    if (options.enableAudioDenoise !== undefined) {
      requestBody.enable_audio_denoise = options.enableAudioDenoise
    }

    const response = await axios.post(VOLCANO_VOICE_CLONE_API, requestBody, {
      headers: {
        'X-Api-Key': apiKey,
        'X-Api-Request-Id': crypto.randomUUID(),
        'Content-Type': 'application/json'
      },
      timeout: config.thirdPartyTimeout
    })

    console.log('[VoiceClone] API 响应:', response.status, response.data)

    // 根据响应判断结果
    if (response.status === 200) {
      // 成功响应
      return {
        success: true,
        message: '音色训练已提交，请稍后查询训练状态',
        speakerId: options.speakerId
      }
    }

    return {
      success: false,
      message: response.data?.message || '音色训练失败',
      error: JSON.stringify(response.data)
    }
  } catch (error: any) {
    console.error('[VoiceClone] API 调用失败:', error.response?.data || error.message)
    
    // 解析错误信息
    const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message
    
    return {
      success: false,
      message: `音色训练失败: ${errorMsg}`,
      error: JSON.stringify(error.response?.data || error.message)
    }
  }
}

/**
 * 查询音色状态
 * 获取克隆音色的训练进度
 */
export async function getVoiceStatus(speakerId: string): Promise<VoiceStatus> {
  const apiKey = getApiKey()
  
  if (!apiKey) {
    console.error('[VoiceClone] 未配置 API Key')
    return {
      speakerId,
      status: 0,
      statusText: 'API未配置',
      isReady: false
    }
  }

  console.log('[VoiceClone] 查询音色状态:', speakerId)

  try {
    const response = await axios.post(VOLCANO_GET_VOICE_API, {
      speaker_id: speakerId
    }, {
      headers: {
        'X-Api-Key': apiKey,
        'X-Api-Request-Id': crypto.randomUUID(),
        'Content-Type': 'application/json'
      },
      timeout: 30000
    })

    console.log('[VoiceClone] 状态查询响应:', JSON.stringify(response.data, null, 2))

    const statusCode = response.data?.status ?? 0
    const statusText = getStatusText(statusCode)
    const isReady = statusCode === 2 || statusCode === 4

    // 从 speaker_status 数组中提取 icl_speaker_id
    // 规则：取 model_type 最大的那一项的 icl_speaker_id
    let iclSpeakerId: string | undefined
    const speakerStatus: SpeakerStatusItem[] = response.data?.speaker_status || []

    if (speakerStatus.length > 0) {
      // 按 model_type 降序排序，取最大的
      const sortedStatus = [...speakerStatus].sort((a, b) => b.model_type - a.model_type)
      const bestStatus = sortedStatus[0]
      iclSpeakerId = bestStatus.icl_speaker_id

      console.log('[VoiceClone] Speaker Status 列表:', speakerStatus.map(s => ({
        model_type: s.model_type,
        icl_speaker_id: s.icl_speaker_id,
        status: s.status
      })))
      console.log('[VoiceClone] 选用 ICL Speaker ID:', iclSpeakerId, '(model_type:', bestStatus.model_type, ')')
    } else {
      console.warn('[VoiceClone] 响应中缺少 speaker_status 数组')
    }

    return {
      speakerId,
      status: statusCode,
      statusText,
      isReady,
      speakerStatus,
      iclSpeakerId
    }
  } catch (error: any) {
    console.error('[VoiceClone] 状态查询失败:', error.response?.data || error.message)
    
    // 如果是 404，说明音色不存在
    if (error.response?.status === 404) {
      return {
        speakerId,
        status: 0,
        statusText: '音色不存在',
        isReady: false
      }
    }

    return {
      speakerId,
      status: 3, // Failed
      statusText: '查询失败',
      isReady: false
    }
  }
}

/**
 * 状态码转文字描述
 */
function getStatusText(status: number): string {
  const statusMap: Record<number, string> = {
    0: '不存在',
    1: '训练中',
    2: '训练成功',
    3: '训练失败',
    4: '激活成功'
  }
  return statusMap[status] || '未知状态'
}

/**
 * 声音复刻 TTS 合成
 * 使用已训练的克隆音色进行语音合成
 */
export async function previewVoice(speakerId: string, text: string): Promise<{ success: boolean; audioData?: Buffer; error?: string }> {
  const apiKey = getApiKey()

  if (!apiKey) {
    return {
      success: false,
      error: 'VOLCANO_SPEECH_API_KEY is not configured'
    }
  }

  if (!speakerId) {
    return {
      success: false,
      error: 'speakerId is required'
    }
  }

  if (!text) {
    return {
      success: false,
      error: 'text is required'
    }
  }

  console.log('[VoiceClone] 声音复刻 TTS 合成:', { speakerId, textLength: text.length })

  try {
    const requestBody = {
      speaker_id: speakerId,
      operation: 'query',  // 关键参数：使用查询模式进行合成
      text: text,
      audio: {
        encoding: 'mp3',
        speed_ratio: 1.0
      }
    }

    console.log('[VoiceClone] TTS 请求体:', JSON.stringify(requestBody, null, 2))

    const response = await axios.post(VOLCANO_VOICE_CLONE_API, requestBody, {
      headers: {
        'X-Api-Key': apiKey,
        'X-Api-Request-Id': crypto.randomUUID(),
        'Content-Type': 'application/json'
      },
      timeout: config.thirdPartyTimeout
    })

    console.log('[VoiceClone] TTS 响应状态:', response.status)
    console.log('[VoiceClone] TTS 响应数据:', JSON.stringify(response.data).slice(0, 500))

    // 从响应中提取 base64 音频数据
    const audioBase64 = response.data?.audio?.data
    if (!audioBase64) {
      console.error('[VoiceClone] TTS 响应中缺少音频数据')
      return {
        success: false,
        error: '响应中缺少音频数据'
      }
    }

    // 解码 base64 为 Buffer
    const audioData = Buffer.from(audioBase64, 'base64')
    console.log('[VoiceClone] TTS 音频数据大小:', audioData.length, '字节')

    return {
      success: true,
      audioData
    }
  } catch (error: any) {
    console.error('[VoiceClone] TTS 合成失败:', error.response?.data || error.message)
    return {
      success: false,
      error: error.response?.data?.message || error.message
    }
  }
}

/**
 * 检查服务是否已配置
 */
export function isVoiceCloneConfigured(): boolean {
  return !!(getApiKey())
}
