/**
 * 火山方舟 TTS 服务 (v3 API)
 * 调用火山引擎语音合成 API，将音频上传到腾讯云 COS
 * API: https://openspeech.bytedance.com/api/v3/tts/unidirectional
 * 鉴权方式: X-Api-App-Id + X-Api-Access-Key
 */

console.log('当前 TTS 服务文件路径: server/src/services/tts.service.ts');

import path from 'path'
import fs from 'fs'
import axios from 'axios'
import { config } from '../config/index.js'
import { exec } from 'child_process'
import { promisify } from 'util'


const execAsync = promisify(exec)

/**
 * 安全转换为固定小数位（避免浮点精度问题）
 */
function safeToFixed(num: number, decimals: number = 2): string {
  const m = Math.pow(10, decimals)
  return (Math.round(num * m) / m).toFixed(decimals)
}

// 静态文件目录（用于通过 /api/static 访问）
const publicDir = path.join(process.cwd(), 'public')
const ttsAudioDir = path.join(publicDir, 'tts')

// 确保目录存在
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true })
}
if (!fs.existsSync(ttsAudioDir)) {
  fs.mkdirSync(ttsAudioDir, { recursive: true })
}

export interface TTSOptions {
  text: string
  voiceType?: string
  speedRatio?: number
  volumeRatio?: number
}

export interface TTSSegment {
  text: string
  start: number  // 秒
  duration: number
}

// 导出 TTS 结果类型（供 video-pipeline 使用）
export interface TTSResult {
  success: boolean
  audioUrl?: string
  duration?: number
  localPath?: string
  segments?: TTSSegment[]  // 分段数据，用于字幕同步
  error?: string
}

/**
 * 检查火山方舟 TTS 是否已配置
 */
export function isTTSConfigured(): boolean {
  return !!(config.volcanoTts?.appId && config.volcanoTts?.accessKey)
}

/**
 * 使用 FFmpeg concat 合并多个 MP3 片段
 * 策略：直接使用 FFmpeg concat demuxer，避免重新编码，保持音频质量
 * @param segmentFiles MP3 文件路径数组
 * @param silenceDuration 静音时长（秒）
 * @param outputPath 输出 MP3 文件路径
 * @returns 合并后的 MP3 Buffer
 */
async function concatenateAudioWithFFmpeg(
  segmentFiles: string[],
  silenceDuration: number,
  outputPath: string
): Promise<Buffer> {
  const tempDir = path.join(ttsAudioDir, 'temp_concat')

  console.log('[TTS] 开始 FFmpeg 音频合并...')

  // 确保临时目录存在
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }

  const tempFiles: string[] = []

  try {
    // 步骤1: 计算所有分句音频的总大小
    let totalInputSize = 0
    for (const file of segmentFiles) {
      if (fs.existsSync(file)) {
        const stats = fs.statSync(file)
        totalInputSize += stats.size
      }
    }
    console.log(`[TTS] 所有分句音频总大小: ${totalInputSize} 字节`)

    // 步骤2: 如果有静音需求，为每个分句添加静音间隔
    let filesToConcat: string[] = [...segmentFiles]

    if (silenceDuration > 0 && segmentFiles.length > 1) {
      console.log(`[TTS] 为分句间添加 ${silenceDuration} 秒静音...`)

      for (let i = 0; i < segmentFiles.length - 1; i++) {
        const silenceFile = path.join(tempDir, `silence_${i}.mp3`)

        // 生成静音 MP3（使用 ffmpeg 生成指定时长的静音）
        const silenceCmd = `ffmpeg -y -f lavfi -i "anullsrc=r=24000:cl=mono" -t ${silenceDuration} -codec:a libmp3lame -qscale:a 2 "${silenceFile}"`
        await execAsync(silenceCmd)

        tempFiles.push(silenceFile)

        // 在当前分句后插入静音
        filesToConcat.splice(i * 2 + 1, 0, silenceFile)
      }
    }

    console.log(`[TTS] 准备合并 ${filesToConcat.length} 个文件 (${segmentFiles.length} 个分句 + ${filesToConcat.length - segmentFiles.length} 个静音)`)

    // 步骤3: 创建 FFmpeg concat 文件列表
    const concatListPath = path.join(tempDir, 'concat_list.txt')
    const concatListContent = filesToConcat.map(f => `file '${f}'`).join('\n')
    fs.writeFileSync(concatListPath, concatListContent)
    tempFiles.push(concatListPath)

    console.log(`[TTS] FFmpeg concat 文件内容:\n${concatListContent}`)

    // 步骤4: 使用 FFmpeg concat demuxer 合并 MP3（使用 -c copy 直接复制，不重新编码）
    console.log('[TTS] 执行 FFmpeg 合并 (使用 -c copy)...')
    const concatCmd = `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy "${outputPath}"`
    await execAsync(concatCmd)

    // 验证合并后的文件
    if (!fs.existsSync(outputPath)) {
      throw new Error('FFmpeg 合并失败，输出文件不存在')
    }

    const finalStats = fs.statSync(outputPath)
    console.log(`[TTS] FFmpeg 合并完成，输出文件大小: ${finalStats.size} 字节`)

    // 步骤5: 检查文件大小差异
    const sizeDiff = Math.abs(finalStats.size - totalInputSize) / totalInputSize * 100
    console.log(`[TTS] 文件大小差异: ${safeToFixed(sizeDiff, 2)}%`)

    if (sizeDiff > 5) {
      console.warn(`[TTS-WARN] 文件大小差异超过 5% (差异: ${safeToFixed(sizeDiff, 2)}%), 建议检查音频内容`)
    }

    // 读取最终的 MP3 文件
    const finalBuffer = fs.readFileSync(outputPath)

    // 步骤6: 清理所有临时文件
    for (const tempFile of tempFiles) {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile)
      }
    }
    // 清理分句临时文件
    for (const file of segmentFiles) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file)
      }
    }

    // 尝试清理临时目录
    const remainingFiles = fs.readdirSync(tempDir)
    if (remainingFiles.length === 0) {
      fs.rmdirSync(tempDir)
    }

    console.log('[TTS] 已清理所有临时文件')

    return finalBuffer
  } catch (error) {
    // 清理临时文件
    for (const tempFile of tempFiles) {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile)
      }
    }
    for (const file of segmentFiles) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file)
      }
    }
    throw error
  }
}

/**
 * 调用火山方舟 TTS API (v3 流式接口)
 * @param text 文本内容
 * @param voiceType 音色名称，默认使用 zh_female_vv_uranus_bigtts
 *                  如果是克隆音色（以 clone_ 开头），使用火山引擎声音复刻 API
 * 
 * 注意：X-Api-Access-Key 需要拼接后缀 "-ALL2UzND"（与 test_tts.js 保持一致）
 * 注意：speed_ratio 已硬编码为 0.85，无需外部传入
 */
async function callVolcanoTTS(
  text: string,
  voiceType: string,
  volumeRatio: number = 1.0
): Promise<{ audioData: Buffer; duration: number }> {
  const endpoint = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional'

  // Resource ID: 统一使用 seed-tts-2.0
  const resourceId = 'seed-tts-2.0'

  // 【关键】Access Key 拼接后缀，与 test_tts.js 保持一致
  const baseAccessKey = config.volcanoTts.accessKey || ''
  const accessKey = baseAccessKey.endsWith('-ALL2UzND') 
    ? baseAccessKey 
    : baseAccessKey + '-ALL2UzND'

  // 【克隆音色检测】判断是否为克隆音色
  // 格式: clone_userId_timestamp 或 S_xxx（火山引擎克隆音色）
  const isClonedVoice = voiceType && (voiceType.startsWith('clone_') || voiceType.startsWith('S_'))
  if (isClonedVoice) {
    console.log(`[TTS] 检测到克隆音色: ${voiceType}，使用声音复刻专用 TTS 接口`)

    // 【与 test_tts.js 逻辑完全一致】
    // URL
    const endpoint = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional'
    // Resource ID: seed-icl-2.0（声音复刻专用）
    const resourceId = 'seed-icl-2.0'

    // 请求体：speaker 直接用原始 S_ 开头的音色 ID
    const requestBody = {
      user: { uid: `huaying_${Date.now()}` },
      req_params: {
        text: text,
        speaker: voiceType,  // 直接用原始音色 ID，如 S_D9wczJt22
        audio_params: { format: "mp3", sample_rate: 24000 },
        additions: JSON.stringify({ explicit_language: "zh" })  // 关键：添加语言标识
      }
    }

    console.log('========================================');
    console.log('[TTS-Clone] 调用声音复刻 TTS API v3 (与 test_tts.js 一致)');
    console.log('========================================');
    console.log('[TTS-Clone] Resource ID:', resourceId);
    console.log('[TTS-Clone] Speaker (原始音色ID):', voiceType);
    console.log('[TTS-Clone] Request Headers:', {
      'X-Api-App-Id': config.volcanoTts.appId,
      'X-Api-Access-Key': accessKey.slice(0, 10) + '...' + accessKey.slice(-6),
      'X-Api-Resource-Id': resourceId,
      'Content-Type': 'application/json'
    });

    const requestPayloadString = JSON.stringify(requestBody, null, 2);
    console.log('\n【TTS-Clone】请求体 Payload:');
    console.log(requestPayloadString);
    console.log('========================================\n');

    // 发送请求
    const response = await axios.post(endpoint, requestBody, {
      headers: {
        'X-Api-App-Id': config.volcanoTts.appId,
        'X-Api-Access-Key': accessKey,
        'X-Api-Resource-Id': resourceId,
        'Content-Type': 'application/json',
        'Connection': 'keep-alive'
      },
      responseType: 'stream',
      timeout: config.thirdPartyTimeout
    }).catch(async (err) => {
      let errorDetail = '';
      if (err.response?.data && typeof err.response.data.pipe === 'function') {
        errorDetail = await new Promise<string>((resolve) => {
          let data = '';
          err.response.data.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          err.response.data.on('end', () => resolve(data));
        });
      }
      console.error('[TTS-Clone] API 请求失败:', {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: errorDetail || err.message
      });
      throw err;
    });

    console.log(`\n[TTS-Clone] HTTP 状态码: ${response.status}`);

    // 【与 test_tts.js 完全一致】处理流式响应
    return new Promise((resolve, reject) => {
      let data = '';

      response.data.on('data', (chunk: Buffer) => {
        data += chunk.toString();
      });

      response.data.on('end', () => {
        console.log('[TTS-Clone] HTTP 流结束，已接收数据长度:', data.length, '字节');

        // 逐行解析 JSON（与 test_tts.js 完全一致）
        const lines = data.split('\n').filter(line => line.trim());
        let audioChunks: Buffer[] = [];

        lines.forEach(line => {
          try {
            const json = JSON.parse(line);
            if (json.code === 0 && json.data) {
              // 解码 base64 音频数据
              const audioBuffer = Buffer.from(json.data, 'base64');
              audioChunks.push(audioBuffer);
            } else if (json.code && json.code !== 0) {
              console.error('[TTS-Clone] 错误响应:', json);
            }
          } catch (e) {
            console.error('[TTS-Clone] 解析行失败:', line.substring(0, 100), (e as Error).message);
          }
        });

        if (audioChunks.length > 0) {
          const finalAudio = Buffer.concat(audioChunks);
          console.log(`[TTS-Clone] ✅ 音频数据块数量: ${audioChunks.length}`);
          console.log(`[TTS-Clone] ✅ 最终 Buffer 大小: ${finalAudio.length} 字节`);
          console.log('========================================\n');

          const estimatedDuration = Math.max(1, Math.ceil(finalAudio.length / 12000));
          resolve({ audioData: finalAudio, duration: estimatedDuration });
        } else if (response.status === 200) {
          // 也许直接返回二进制
          const buffer = Buffer.from(data, 'binary');
          if (buffer.length > 1024) {
            console.log('[TTS-Clone] 未检测到 JSON 格式，尝试作为二进制处理');
            resolve({ audioData: buffer, duration: Math.max(1, Math.ceil(buffer.length / 12000)) });
          } else {
            console.error('\n[TTS-Clone] ❌ 未获取到有效音频数据');
            console.error('原始响应:', data);
            reject(new Error('克隆音色 TTS API 返回空数据'));
          }
        } else {
          console.error('\n[TTS-Clone] ❌ 请求失败');
          reject(new Error('克隆音色 TTS API 请求失败'));
        }
      });

      response.data.on('error', (err: Error) => {
        reject(new Error(`TTS 流读取失败: ${err.message}`));
      });
    });
  }

  // 【优化】Payload 结构 - 使用默认语速 1.0
  const requestBody = {
    user: { uid: `huaying_${Date.now()}` },
    req_params: {
      text: text,
      speaker: voiceType,
      speed_ratio: 1.0,  // 使用默认语速
      volume_ratio: volumeRatio,
      audio_params: { format: "mp3", sample_rate: 24000 }
    }
  }

  console.log('========================================');
  console.log('[TTS] 调用火山方舟 TTS API v3');
  console.log('========================================');
  console.log('[TTS] Resource ID:', resourceId);
  console.log('[TTS] Request Headers:', {
    'X-Api-App-Id': config.volcanoTts.appId,
    'X-Api-Access-Key': accessKey.slice(0, 10) + '...' + accessKey.slice(-6),
    'X-Api-Resource-Id': resourceId,
    'Content-Type': 'application/json',
    'Connection': 'keep-alive'
  });
  
  // 【关键检查】打印完整请求体 JSON 字符串
  const requestPayloadString = JSON.stringify(requestBody, null, 2);
  console.log('\n【TTS-DEBUG】请求体 Payload:');
  console.log(requestPayloadString);
  console.log('\n【TTS-DEBUG】audio_params 检查:');
  console.log('  audio_params.format:', requestBody.req_params.audio_params.format);
  console.log('  audio_params.sample_rate:', requestBody.req_params.audio_params.sample_rate);
  console.log('  speed_ratio:', requestBody.req_params.speed_ratio);
  console.log('  volume_ratio:', requestBody.req_params.volume_ratio);
  console.log('========================================\n');

  const response = await axios.post(endpoint, requestBody, {
    headers: {
      'X-Api-App-Id': config.volcanoTts.appId,
      'X-Api-Access-Key': accessKey,  // 使用拼接后的完整 Access Key
      'X-Api-Resource-Id': resourceId,
      'Content-Type': 'application/json',
      'Connection': 'keep-alive'
    },
    responseType: 'stream',
    timeout: config.thirdPartyTimeout
  }).catch(async (err) => {
    // 读取错误响应体
    let errorDetail = '';
    if (err.response?.data && typeof err.response.data.pipe === 'function') {
      errorDetail = await new Promise<string>((resolve) => {
        let data = '';
        err.response.data.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        err.response.data.on('end', () => resolve(data));
      });
    }
    console.error('[TTS] API 请求失败:', {
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: errorDetail || err.message
    });
    throw err;
  });

  // 打印响应状态
  console.log(`\n[TTS] HTTP 状态码: ${response.status}`);
  console.log('[TTS] 响应 Headers:', response.headers);

  // 【完全复用 test_tts.js 的流式响应处理逻辑，并增强结束标记检测】
  return new Promise((resolve, reject) => {
    let data = '';
    let hasReceivedEndMarker = false;  // 是否已收到结束标记

    response.data.on('data', (chunk: Buffer) => {
      // 与 test_tts.js 完全一致：只累积原始数据
      data += chunk.toString();

      // 【新增】实时检查是否收到结束标记
      // 结束标记特征：code 为 20000000 且 data 为 null
      const lines = data.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const json = JSON.parse(line);
            if (json.code === 20000000 && json.data === null) {
              console.log('[TTS] ✅ 检测到结束标记 (code: 20000000, data: null)');
              hasReceivedEndMarker = true;
            }
          } catch (e) {
            // JSON 解析失败，忽略
          }
        }
      }
    });

    response.data.on('end', () => {
      console.log('\n========================================');
      console.log('[TTS] ======= 处理流式响应 (增强结束标记检测) =======');
      console.log(`[TTS] HTTP 流结束，已接收数据长度: ${data.length} 字节`);
      console.log(`[TTS] 已收到结束标记: ${hasReceivedEndMarker ? '是 ✅' : '否 ⚠️'}`);

      // 与 test_tts.js 完全一致：按行切分、解析 JSON
      const lines = data.split('\n').filter(line => line.trim());
      let audioChunks: Buffer[] = [];
      let base64Strings: string[] = [];  // 保存 base64 字符串用于验证

      lines.forEach((line, index) => {
        try {
          const json = JSON.parse(line);
          
          // 处理音频数据块：code === 0 且有 data
          if (json.code === 0 && json.data) {
            // 与 test_tts.js 完全一致：解码 base64 音频数据
            base64Strings.push(json.data);
            const audioBuffer = Buffer.from(json.data, 'base64');
            audioChunks.push(audioBuffer);
          }
          // 忽略结束标记（code: 20000000, data: null），它不包含音频数据
          else if (json.code === 20000000 && json.data === null) {
            console.log(`[TTS] 第 ${index + 1} 行: 收到结束标记`);
          }
          // 其他错误
          else if (json.code && json.code !== 0 && json.code !== 20000000) {
            console.error('[TTS] 错误响应:', json);
          }
        } catch (e) {
          console.error('[TTS] 解析行失败:', line.substring(0, 100), (e as Error).message);
        }
      });

      if (audioChunks.length > 0) {
        // 与 test_tts.js 完全一致：拼接所有音频片段
        const finalAudio = Buffer.concat(audioChunks);
        console.log(`[TTS] 音频数据块数量: ${audioChunks.length}`);
        console.log(`[TTS] 最终 Buffer 大小: ${finalAudio.length} 字节`);
        
        // 【新增】base64 数据完整性验证
        const combinedBase64 = base64Strings.join('');
        const endsWithPadding = combinedBase64.endsWith('=') || combinedBase64.endsWith('==');
        const lastNonPaddingChar = combinedBase64.replace(/=+$/, '').slice(-1);
        console.log('[TTS-DEBUG] base64 数据完整性检查:');
        console.log(`[TTS-DEBUG]   合并后 base64 长度: ${combinedBase64.length} 字符`);
        console.log(`[TTS-DEBUG]   是否以 = 结尾: ${endsWithPadding ? '是 ✅ (数据完整)' : '否 ⚠️'}`);
        console.log(`[TTS-DEBUG]   最后有效字符: ${lastNonPaddingChar}`);
        
        if (!endsWithPadding && combinedBase64.length > 0) {
          console.warn('[TTS-WARN] base64 数据可能不完整，建议检查是否丢失了结束标记前的数据');
        }
        
        console.log('[TTS-DEBUG] 文件头检查:', finalAudio.subarray(0, 10).toString('hex'));
        const isMP3 = finalAudio.subarray(0, 3).toString('hex') === '494433' || 
                      finalAudio.subarray(0, 4).toString('hex') === 'fff3' ||
                      finalAudio.subarray(0, 4).toString('hex') === 'fffb';
        console.log('[TTS-DEBUG] 可能是 MP3 文件:', isMP3);
        console.log('[TTS] ======= 处理结束 =======');
        console.log('========================================\n');

        const estimatedDuration = Math.max(1, Math.ceil(finalAudio.length / 12000));
        resolve({ audioData: finalAudio, duration: estimatedDuration });
      } else if (response.status === 200) {
        // 与 test_tts.js 完全一致：也许直接返回二进制
        const buffer = Buffer.from(data, 'binary');
        if (buffer.length > 1024) {
          console.log('[TTS] 未检测到 JSON 格式，尝试作为二进制处理');
          console.log(`[TTS] 二进制数据长度: ${buffer.length} 字节`);
          console.log('[TTS-DEBUG] 文件头:', buffer.subarray(0, 10).toString('hex'));
          console.log('[TTS] ======= 处理结束 =======');
          console.log('========================================\n');
          resolve({ audioData: buffer, duration: Math.max(1, Math.ceil(buffer.length / 12000)) });
        } else {
          console.error('\n[TTS] 未获取到有效音频数据，原始响应:');
          console.log(data);
          console.log('========================================\n');
          reject(new Error('TTS API 返回空数据'));
        }
      } else {
        console.error('\n[TTS] 请求失败，原始响应:');
        console.log(data);
        console.log('========================================\n');
        reject(new Error('TTS API 请求失败'));
      }
    });

    response.data.on('error', (err: Error) => {
      reject(new Error(`TTS 流读取失败: ${err.message}`));
    });
  });
}

/**
 * 调用火山引擎声音复刻 TTS API
 * 使用克隆的音色进行语音合成
 * @param text 文本内容
 * @param speakerId 克隆音色 ID
 * @param volumeRatio 音量比例
 */
async function callVoiceCloneTTS(
  text: string,
  speakerId: string,
  volumeRatio: number = 1.0
): Promise<{ audioData: Buffer; duration: number }> {
  const endpoint = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional'
  const resourceId = 'voice_clone'  // 声音复刻使用 voice_clone resource

  // 获取 API Key（优先使用声音复刻专用 Key）
  const apiKey = config.volcanoSpeechApiKey || config.volcanoTts.accessKey || ''
  const accessKey = apiKey.endsWith('-ALL2UzND') ? apiKey : apiKey + '-ALL2UzND'

  const requestBody = {
    user: { uid: `huaying_${Date.now()}` },
    req_params: {
      text: text,
      speaker: speakerId,  // 直接使用 speaker_id
      speed_ratio: 1.0,
      volume_ratio: volumeRatio,
      audio_params: { format: "mp3", sample_rate: 24000 }
    }
  }

  console.log('========================================');
  console.log('[TTS] 调用火山引擎声音复刻 TTS API');
  console.log('========================================');
  console.log('[TTS] Resource ID:', resourceId);
  console.log('[TTS] Speaker ID:', speakerId);
  console.log('[TTS] Request Headers:', {
    'X-Api-App-Id': config.volcanoTts.appId,
    'X-Api-Access-Key': accessKey.slice(0, 10) + '...' + accessKey.slice(-6),
    'X-Api-Resource-Id': resourceId,
    'Content-Type': 'application/json'
  });
  
  const requestPayloadString = JSON.stringify(requestBody, null, 2);
  console.log('\n【TTS-Clone】请求体 Payload:');
  console.log(requestPayloadString);
  console.log('========================================\n');

  const response = await axios.post(endpoint, requestBody, {
    headers: {
      'X-Api-App-Id': config.volcanoTts.appId,
      'X-Api-Access-Key': accessKey,
      'X-Api-Resource-Id': resourceId,
      'Content-Type': 'application/json',
      'Connection': 'keep-alive'
    },
    responseType: 'stream',
    timeout: config.thirdPartyTimeout
  }).catch(async (err) => {
    let errorDetail = '';
    if (err.response?.data && typeof err.response.data.pipe === 'function') {
      errorDetail = await new Promise<string>((resolve) => {
        let data = '';
        err.response.data.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        err.response.data.on('end', () => resolve(data));
      });
    }
    console.error('[TTS-Clone] API 请求失败:', {
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: errorDetail || err.message
    });
    throw err;
  });

  console.log(`\n[TTS-Clone] HTTP 状态码: ${response.status}`);

  return new Promise((resolve, reject) => {
    let data = '';
    let hasReceivedEndMarker = false;

    response.data.on('data', (chunk: Buffer) => {
      data += chunk.toString();

      const lines = data.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const json = JSON.parse(line);
            if (json.code === 20000000 && json.data === null) {
              console.log('[TTS-Clone] 检测到结束标记 (code: 20000000, data: null)');
              hasReceivedEndMarker = true;
            }
          } catch (e) {
            // JSON 解析失败，忽略
          }
        }
      }
    });

    response.data.on('end', () => {
      console.log('\n========================================');
      console.log('[TTS-Clone] ======= 处理流式响应 =======');
      console.log(`[TTS-Clone] HTTP 流结束，已接收数据长度: ${data.length} 字节`);

      const lines = data.split('\n').filter(line => line.trim());
      let audioChunks: Buffer[] = [];

      lines.forEach((line, index) => {
        try {
          const json = JSON.parse(line);
          
          if (json.code === 0 && json.data) {
            const audioBuffer = Buffer.from(json.data, 'base64');
            audioChunks.push(audioBuffer);
          }
          else if (json.code === 20000000 && json.data === null) {
            console.log(`[TTS-Clone] 第 ${index + 1} 行: 收到结束标记`);
          }
          else if (json.code && json.code !== 0 && json.code !== 20000000) {
            console.error('[TTS-Clone] 错误响应:', json);
          }
        } catch (e) {
          console.error('[TTS-Clone] 解析行失败:', line.substring(0, 100), (e as Error).message);
        }
      });

      if (audioChunks.length > 0) {
        const finalAudio = Buffer.concat(audioChunks);
        console.log(`[TTS-Clone] 音频数据块数量: ${audioChunks.length}`);
        console.log(`[TTS-Clone] 最终 Buffer 大小: ${finalAudio.length} 字节`);
        console.log('[TTS-Clone] ======= 处理结束 =======');
        console.log('========================================\n');

        const estimatedDuration = Math.max(1, Math.ceil(finalAudio.length / 12000));
        resolve({ audioData: finalAudio, duration: estimatedDuration });
      } else if (response.status === 200) {
        const buffer = Buffer.from(data, 'binary');
        if (buffer.length > 1024) {
          console.log('[TTS-Clone] 未检测到 JSON 格式，尝试作为二进制处理');
          resolve({ audioData: buffer, duration: Math.max(1, Math.ceil(buffer.length / 12000)) });
        } else {
          console.error('\n[TTS-Clone] 未获取到有效音频数据');
          reject(new Error('声音复刻 TTS API 返回空数据'));
        }
      } else {
        console.error('\n[TTS-Clone] 请求失败');
        reject(new Error('声音复刻 TTS API 请求失败'));
      }
    });

    response.data.on('error', (err: Error) => {
      reject(new Error(`TTS 流读取失败: ${err.message}`));
    });
  });
}

/**
 * 上传音频到腾讯云 COS
 * 返回 COS 对象键（如 tts/tts_xxx.mp3），前端通过 preview-url 接口获取访问地址
 */
async function uploadAudioToCOS(audioData: Buffer, fileName: string): Promise<string> {
  // 调试日志：打印 COS 配置（完整值，不脱敏）
  console.log('[TTS] COS 配置检查 (完整值):')
  console.log('[TTS]   SecretId:  ', config.cos.secretId)
  console.log('[TTS]   SecretKey: ', config.cos.secretKey)
  console.log('[TTS]   bucket:    ', config.cos.bucket)
  console.log('[TTS]   region:   ', config.cos.region)

  // 如果未配置 COS，使用本地存储
  if (!config.cos.secretId || !config.cos.secretKey || !config.cos.bucket) {
    console.log('[TTS] COS 密钥不完整，使用本地存储')
    return await saveAudioLocally(audioData, fileName)
  }

  try {
    // 动态导入 COS SDK
    const COS = await import('cos-nodejs-sdk-v5')

    return new Promise((resolve) => {
      const cos = new COS.default({
        SecretId: config.cos.secretId,
        SecretKey: config.cos.secretKey
      })
      console.log('[TTS] COS SDK 已初始化，准备上传到 bucket:', config.cos.bucket)

      // 使用 COS 对象键作为 audioUrl（如 tts/tts_xxx.mp3）
      const cosKey = `tts/${fileName}`

      cos.putObject(
        {
          Bucket: config.cos.bucket,
          Region: config.cos.region,
          Key: cosKey,
          Body: audioData,
          ContentLength: audioData.length,
          ACL: 'public-read',
          ContentDisposition: `inline; filename="${fileName}"`
        },
        (err: any) => {
          if (err) {
            console.error('[TTS] COS 上传失败:', err)
            // 降级到本地存储
            resolve(saveAudioLocally(audioData, fileName))
          } else {
            // 返回 COS 对象键，前端通过 /api/core/cos/preview-url 获取访问地址
            console.log('[TTS] COS 上传成功，存储 COS 对象键:', cosKey)
            resolve(cosKey)
          }
        }
      )
    })
  } catch (error) {
    console.error('[TTS] COS 上传异常:', error)
    // 降级到本地存储
    return await saveAudioLocally(audioData, fileName)
  }
}

/**
 * 保存音频到本地
 */
async function saveAudioLocally(audioData: Buffer, fileName: string): Promise<string> {
  const localPath = path.join(ttsAudioDir, fileName)
  
  // 【调试日志】确认音频数据类型
  console.log('[TTS-DEBUG] saveAudioLocally - 音频数据类型检查:')
  console.log(`[TTS-DEBUG]   audioData 类型: ${typeof audioData}, 是否为 Buffer: ${Buffer.isBuffer(audioData)}`)
  console.log(`[TTS-DEBUG]   audioData 长度: ${audioData.length} 字节`)
  
  // 直接写入二进制数据，不使用任何编码
  fs.writeFileSync(localPath, audioData)
  
  // 【调试日志】验证文件是否正确写入
  const stats = fs.statSync(localPath)
  console.log(`[TTS-DEBUG]   写入后文件大小: ${stats.size} 字节`)
  console.log(`[TTS-DEBUG]   文件大小匹配: ${stats.size === audioData.length ? '是' : '否 (警告!)'}`)

  // 返回相对路径，前端可以通过静态文件服务访问
  const relativeUrl = `/api/static/tts/${fileName}`
  console.log('[TTS] 音频保存到本地:', localPath, '->', relativeUrl)

  return relativeUrl
}

/**
 * 降级到模拟音频
 */
async function fallbackToMock(): Promise<TTSResult> {
  const fileName = `mock_tts.mp3`
  const localPath = path.join(publicDir, 'audio', fileName)

  // 如果模拟文件存在，直接返回
  if (fs.existsSync(localPath)) {
    const relativeUrl = `/api/static/audio/${fileName}`
    console.log('[TTS] 使用模拟音频:', relativeUrl)
    return {
      success: true,
      audioUrl: relativeUrl,
      duration: 3,
      localPath
    }
  }

  // 确保目录存在
  const audioDir = path.join(publicDir, 'audio')
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true })
  }

  // 返回模拟音频 URL
  const relativeUrl = `/audio/mock_tts.mp3`
  console.log('[TTS] 返回模拟音频URL:', relativeUrl)
  return {
    success: true,
    audioUrl: relativeUrl,
    duration: 3,
    localPath: path.join(publicDir, relativeUrl)
  }
}

/**
 * 将文本按中文标点符号分句
 * 1. 优先按标点（。！？；，\n）分句，确保句子完整性
 * 2. 过滤空句（长度小于1）
 * 3. 如果单个完整句子超过 maxLength，再按字符数拆分
 */
function splitText(text: string, maxLength: number = 200): string[] {
  if (!text || text.trim().length === 0) {
    return []
  }

  // 【核心修改】按标点符号分割文本
  // 标点列表：句号、问号、感叹号、分号、逗号、换行
  const punctuationRegex = /[。？！；，.?!;,\n]/
  const sentences: string[] = []
  
  // 使用 split + filter 保留分隔符，然后重组
  const parts = text.split(punctuationRegex)
  
  parts.forEach(part => {
    const trimmed = part.trim()
    // 过滤空句
    if (trimmed.length < 1) {
      return
    }
    
    if (trimmed.length <= maxLength) {
      // 句子长度在限制内，直接使用
      sentences.push(trimmed)
    } else {
      // 句子超过限制，按字符数拆分
      for (let i = 0; i < trimmed.length; i += maxLength) {
        const chunk = trimmed.substring(i, i + maxLength).trim()
        if (chunk.length >= 1) {
          sentences.push(chunk)
        }
      }
    }
  })

  // 如果没有分出任何句子（原文可能是没有标点的纯文本）
  if (sentences.length === 0 && text.trim().length > 0) {
    const trimmedText = text.trim()
    if (trimmedText.length <= maxLength) {
      return [trimmedText]
    } else {
      // 按字符数拆分
      for (let i = 0; i < trimmedText.length; i += maxLength) {
        const chunk = trimmedText.substring(i, i + maxLength).trim()
        if (chunk.length >= 1) {
          sentences.push(chunk)
        }
      }
    }
  }

  return sentences
}

/**
 * 合成文案音频
 * 优先使用火山方舟 TTS，失败时降级到模拟音频
 */
export async function synthesizeSpeech(options: TTSOptions): Promise<TTSResult> {
  const {
    text,
    voiceType = config.volcanoTts?.speaker || 'zh_female_vv_uranus_bigtts',
    volumeRatio = 1.0
  } = options

  // 检查是否配置了火山方舟 TTS App ID 和 Access Key
  if (!config.volcanoTts?.appId || !config.volcanoTts?.accessKey) {
    console.log('[TTS] 火山方舟 TTS App ID 或 Access Key 未配置，使用模拟音频')
    return await fallbackToMock()
  }

  const fileName = `tts_${Date.now()}.mp3`
  const localPath = path.join(ttsAudioDir, fileName)

  // 确保临时目录存在
  const tempDir = path.join(ttsAudioDir, 'temp_concat')
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }

  const segmentFiles: string[] = []  // 存储每个分句的临时 MP3 文件路径

  try {
    // 使用改进后的 splitText 函数按标点分句
    const segments = splitText(text, 200)

    // 过滤空句
    const validSegments = segments.filter(s => s && s.trim().length > 0)

    if (validSegments.length === 0) {
      console.error('[TTS] 文本为空或仅包含空白字符')
      return await fallbackToMock()
    }

    // 多句文本，分句合成后拼接（带静音间隔）
    console.log(`[TTS] 文本(${text.length}字)，按标点分${validSegments.length}句合成`)

    const SILENCE_DURATION = 0.3  // 静音时长（秒）
    const segmentDurations: TTSSegment[] = []  // 存储分段时长信息
    let currentStartTime = 0

    for (let i = 0; i < validSegments.length; i++) {
      const segment = validSegments[i]
      const displayText = segment.length > 50 ? segment.substring(0, 50) + '...' : segment
      console.log(`[TTS] 分句合成进度: ${i + 1}/${validSegments.length}, 文本: "${displayText}"`)

      // 调用 TTS API
      const { audioData } = await callVolcanoTTS(segment, voiceType, volumeRatio)

      // 每个分句单独保存为临时 MP3 文件
      const segmentFile = path.join(tempDir, `segment_${i}.mp3`)
      fs.writeFileSync(segmentFile, audioData)
      segmentFiles.push(segmentFile)

      // 估算时长
      const estimatedDuration = Math.ceil(audioData.length / 8000)

      // 记录分段信息（用于字幕同步）
      segmentDurations.push({
        text: segment,
        start: currentStartTime,
        duration: estimatedDuration
      })

      // 更新下一个分句的开始时间
      currentStartTime += estimatedDuration + SILENCE_DURATION

      console.log(`[TTS] 已保存分句音频: ${segmentFile}, 估算时长: ${estimatedDuration}s`)
    }

    // 计算总时长
    const totalDuration = currentStartTime - SILENCE_DURATION

    console.log('[TTS-SEGMENT] 分句音频文件统计:')
    console.log(`  - 分句数量: ${segmentFiles.length}`)
    console.log(`  - 估算音频时长: ${totalDuration} 秒`)

    // 使用 FFmpeg concat 合并所有分句音频
    console.log('[TTS] 使用 FFmpeg concat 合并分句音频...')
    const finalAudioData = await concatenateAudioWithFFmpeg(
      segmentFiles,
      SILENCE_DURATION,
      localPath
    )

    // 【修复】使用 ffprobe 获取实际音频时长，并重新计算字幕时间轴
    const actualDuration = await getAudioDuration(localPath)
    console.log('[TTS-FINAL] 最终音频验证:')
    console.log(`  - 文件大小: ${finalAudioData.length} 字节`)
    console.log(`  - 实际时长: ${safeToFixed(actualDuration, 2)} 秒 (ffprobe)`)

    // 重新计算字幕时间轴（基于实际时长比例）
    const estimatedTotalDuration = totalDuration
    const durationRatio = actualDuration / estimatedTotalDuration
    let adjustedStartTime = 0
    for (const seg of segmentDurations) {
      seg.start = adjustedStartTime
      seg.duration = seg.duration * durationRatio
      adjustedStartTime += seg.duration + SILENCE_DURATION
    }
    console.log('[TTS] 字幕时间轴已重新计算（基于实际音频时长）')

    const audioUrl = await uploadAudioToCOS(finalAudioData, fileName)

    console.log('[TTS] TTS 分句合成成功:', {
      totalSegments: validSegments.length,
      totalDuration: actualDuration,
      localPath,
      audioUrl,
      segments: segmentDurations
    })

    return {
      success: true,
      audioUrl,
      duration: actualDuration,
      localPath,
      segments: segmentDurations
    }
  } catch (error: any) {
    console.error('[TTS] TTS 调用失败:', error.message)

    // 清理临时文件
    for (const file of segmentFiles) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file)
      }
    }

    // 降级到模拟音频
    console.log('[TTS] 降级到模拟音频')
    return await fallbackToMock()
  }
}

/**
 * 获取音频时长
 * 通过解析 MP3 文件获取准确的音频时长
 * 使用 ffprobe 获取实际时长，失败时返回估算值
 */
export async function getAudioDuration(audioPath: string): Promise<number> {
  // ffprobe 命令获取音频时长
  const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`

  try {
    const { stdout } = await execAsync(cmd)
    const duration = parseFloat(stdout.trim())
    if (!isNaN(duration) && duration > 0) {
      console.log('[TTS] ffprobe 获取音频时长:', safeToFixed(duration, 2), '秒')
      return duration
    }
  } catch (error) {
    console.warn('[TTS] ffprobe 获取音频时长失败:', (error as Error).message)
  }

  // 回退方案：估算音频时长（按 8000 字节/秒估算）
  if (fs.existsSync(audioPath)) {
    const stats = fs.statSync(audioPath)
    const estimatedDuration = Math.max(1, stats.size / 8000)
    console.log('[TTS] 使用估算音频时长:', safeToFixed(estimatedDuration, 2), '秒')
    return estimatedDuration
  }

  // 默认值
  return 5
}
