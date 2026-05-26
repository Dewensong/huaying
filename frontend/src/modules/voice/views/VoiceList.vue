<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { voiceApi } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import type { UploadRawFile } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

const voices = ref<any[]>([])
const cloneVoices = ref<any[]>([])
const loading = ref(false)
const cloneLoading = ref(false)
const previewingVoiceId = ref<number | null>(null)
const previewAudio = ref<HTMLAudioElement | null>(null)

// 上传请求头
const uploadHeaders = computed(() => ({
  Authorization: `Bearer ${authStore.token || ''}`
}))

// 克隆对话框
const cloneDialogVisible = ref(false)
const cloneForm = ref({
  name: '',
  speakerId: '',
  audioUrl: '',
  audioFormat: 'mp3',
  language: 0
})
const uploadingAudio = ref(false)
const audioFile = ref<UploadRawFile | null>(null)
const cloneFormRef = ref()
const speakerIdInputRef = ref()

async function fetchVoices() {
  loading.value = true
  try {
    const res = await voiceApi.list()
    voices.value = res?.list || []
  } catch (error) {
    ElMessage.error('获取声音列表失败')
  } finally {
    loading.value = false
  }
}

async function fetchCloneVoices() {
  cloneLoading.value = true
  try {
    const res = await voiceApi.getCloneList()
    cloneVoices.value = res?.list || []
  } catch (error: any) {
    // 如果返回 503，说明服务未配置，隐藏克隆列表
    if (error?.response?.status !== 503) {
      ElMessage.error('获取克隆音色列表失败')
    }
  } finally {
    cloneLoading.value = false
  }
}

async function handleDelete(voice: any) {
  try {
    await voiceApi.delete(voice.id)
    ElMessage.success('删除成功')
    fetchVoices()
  } catch (error) {
    ElMessage.error('删除失败')
  }
}

async function handleDeleteClone(clone: any) {
  try {
    await ElMessageBox.confirm(
      `确定要删除音色"${clone.name}"吗？`,
      '删除确认',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    await voiceApi.deleteClone(clone.speakerId)
    ElMessage.success('删除成功')
    fetchCloneVoices()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

async function handlePreview(voice: any) {
  // 克隆音色有 speakerId 字段，系统音色有 voice_type 字段
  const voiceType = voice.speakerId || voice.voice_type

  // 如果正在播放这个声音，停止播放
  if (previewingVoiceId.value === voice.id) {
    stopPreview()
    return
  }

  // 停止之前的预览
  stopPreview()

  try {
    previewingVoiceId.value = voice.id
    ElMessage.info('正在生成试听音频...')

    const res = await voiceApi.preview({
      voiceId: voice.id,
      voiceType
    })

    if (res?.audioUrl) {
      // 直接使用后端返回的 audioUrl，不做任何拼接或域名替换
      const audioUrl = res.audioUrl

      // 创建音频对象并播放
      const audio = new Audio(audioUrl)

      // 监听加载错误
      audio.onerror = () => {
        ElMessage.error('音频加载失败，请检查网络')
        stopPreview()
      }

      // 播放
      audio.play().then(() => {
        ElMessage.success('正在播放...')
        previewAudio.value = audio
        previewingVoiceId.value = voice.id
      }).catch((err: any) => {
        console.error('[VoiceList] 音频播放失败:', err)
        ElMessage.error('音频播放失败')
        stopPreview()
      })

      // 播放结束后清理
      audio.onended = () => {
        stopPreview()
      }
    } else {
      stopPreview()
    }
  } catch (error: any) {
    console.error('[VoiceList] preview 失败:', error)
    stopPreview()
    ElMessage.error(error?.message || error?.response?.data?.message || '试听生成失败')
  }
}

function stopPreview() {
  if (previewAudio.value) {
    previewAudio.value.pause()
    previewAudio.value = null
  }
  previewingVoiceId.value = null
}

// 打开克隆对话框
function openCloneDialog() {
  cloneForm.value = {
    name: '',
    speakerId: '',
    audioUrl: '',
    audioFormat: 'mp3',
    language: 0
  }
  audioFile.value = null
  cloneDialogVisible.value = true
}

// 音频上传前校验
function beforeAudioUpload(file: File) {
  // 支持的 MIME 类型（包含大小写和变体）
  const validMimeTypes = [
    'audio/mpeg', 'audio/mp3', 'audio/mpeg',
    'audio/wav', 'audio/wave', 'audio/x-wav',
    'audio/ogg', 'audio/ogg',
    'audio/x-m4a', 'audio/mp4', 'audio/m4a',
    'audio/aac', 'audio/x-aac'
  ]
  // 支持的文件后缀
  const validExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac']

  // 检查 MIME 类型或文件后缀
  const fileType = file.type.toLowerCase()
  const fileName = file.name.toLowerCase()
  const hasValidMime = validMimeTypes.some(t => fileType.includes(t.toLowerCase()))
  const hasValidExt = validExtensions.some(ext => fileName.endsWith(ext))
  const isValidFormat = hasValidMime || hasValidExt

  const isLt10M = file.size / 1024 / 1024 < 10

  if (!isValidFormat) {
    ElMessage.error('只能上传 MP3、WAV、OGG、M4A、AAC 格式的音频文件')
    return false
  }
  if (!isLt10M) {
    ElMessage.error('音频文件大小不能超过 10MB')
    return false
  }

  // 根据文件类型设置格式
  if (fileName.endsWith('.wav')) {
    cloneForm.value.audioFormat = 'wav'
  } else if (fileName.endsWith('.ogg')) {
    cloneForm.value.audioFormat = 'ogg'
  } else if (fileName.endsWith('.m4a')) {
    cloneForm.value.audioFormat = 'm4a'
  } else if (fileName.endsWith('.aac')) {
    cloneForm.value.audioFormat = 'aac'
  } else {
    cloneForm.value.audioFormat = 'mp3'
  }

  return true
}

// 音频上传成功
async function handleAudioSuccess(response: any) {
  uploadingAudio.value = false
  cloneForm.value.audioUrl = response.url
  ElMessage.success('音频上传成功')
}

// 音频上传失败
function handleAudioError() {
  uploadingAudio.value = false
  ElMessage.error('音频上传失败')
}

// 表单校验规则
const cloneFormRules = {
  name: [
    { required: true, message: '请输入音色名称', trigger: 'blur' }
  ],
  speakerId: [
    { required: true, message: '请输入音色资源 ID', trigger: 'blur' }
  ]
}

// 提交克隆
async function submitClone() {
  // 使用表单校验
  try {
    await cloneFormRef.value.validate()
  } catch {
    // 校验失败，聚焦到音色资源 ID 输入框
    nextTick(() => {
      speakerIdInputRef.value?.focus()
    })
    return
  }

  if (!cloneForm.value.audioUrl) {
    ElMessage.warning('请上传音频文件')
    return
  }

  cloneLoading.value = true
  try {
    const res = await voiceApi.cloneVoice(cloneForm.value)
    ElMessage.success(res?.message || '音色克隆已提交，请等待训练完成')
    cloneDialogVisible.value = false
    // 刷新克隆列表
    setTimeout(() => {
      fetchCloneVoices()
    }, 1000)
  } catch (error: any) {
    ElMessage.error(error?.message || error?.response?.data?.message || '克隆失败')
  } finally {
    cloneLoading.value = false
  }
}

// 获取状态标签颜色
function getStatusColor(status: number) {
  const colors: Record<number, string> = {
    0: 'bg-slate-500/20 text-slate-400',
    1: 'bg-blue-500/20 text-blue-400',
    2: 'bg-green-500/20 text-green-400',
    3: 'bg-red-500/20 text-red-400',
    4: 'bg-green-500/20 text-green-400'
  }
  return colors[status] || colors[0]
}

onMounted(() => {
  fetchVoices()
  fetchCloneVoices()
})
</script>

<template>
  <div class="space-y-6 animate-fade-in">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold text-white">声音管理</h1>
        <p class="text-slate-400 mt-1">管理您的配音声音，支持系统音色和克隆音色</p>
      </div>
      <div class="flex gap-2">
        <el-button type="primary" @click="openCloneDialog">
          <el-icon class="mr-1"><UploadFilled /></el-icon>
          克隆声音
        </el-button>
      </div>
    </div>

    <!-- 克隆音色列表 -->
    <div v-if="cloneLoading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="i in 3" :key="'clone-' + i" class="glass-card p-4 animate-pulse">
        <div class="flex gap-4">
          <div class="w-16 h-16 bg-slate-700 rounded-lg" />
          <div class="flex-1 space-y-2">
            <div class="h-4 bg-slate-700 rounded w-3/4" />
            <div class="h-3 bg-slate-700 rounded w-1/2" />
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="cloneVoices.length > 0">
      <h2 class="text-lg font-medium text-white mb-3 flex items-center gap-2">
        <svg class="w-5 h-5 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        我的克隆音色
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div
          v-for="clone in cloneVoices"
          :key="clone.id"
          class="glass-card p-4 hover:border-primary-500/30 transition-all"
        >
          <div class="flex gap-4">
            <div class="w-16 h-16 rounded-lg bg-gradient-to-br from-accent-500 to-primary-500 flex items-center justify-center flex-shrink-0">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-medium text-white truncate">{{ clone.name }}</h3>
                <span :class="['px-2 py-0.5 text-xs rounded', getStatusColor(clone.status)]">
                  {{ clone.statusText }}
                </span>
              </div>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400">
                  样本 {{ clone.sampleDuration }}秒
                </span>
                <span class="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400">
                  {{ clone.language === 0 ? '中文' : '英文' }}
                </span>
              </div>

              <!-- 操作按钮 -->
              <div class="flex items-center gap-2 mt-3">
                <el-button
                  size="small"
                  :type="previewingVoiceId === clone.id ? 'primary' : 'default'"
                  :disabled="!clone.isReady"
                  @click="handlePreview(clone)"
                  :title="clone.isReady ? '试听' : '训练未完成，无法试听'"
                >
                  <svg v-if="previewingVoiceId !== clone.id" class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <svg v-else class="w-4 h-4 mr-1 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  {{ previewingVoiceId === clone.id ? '停止' : '试听' }}
                </el-button>
                <el-button
                  @click="handleDeleteClone(clone)"
                  type="danger"
                  size="small"
                  plain
                >
                  删除
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 系统预设音色 -->
    <div>
      <h2 class="text-lg font-medium text-white mb-3">系统音色</h2>

      <!-- 声音列表 -->
      <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="i in 6" :key="i" class="glass-card p-4 animate-pulse">
          <div class="flex gap-4">
            <div class="w-16 h-16 bg-slate-700 rounded-lg" />
            <div class="flex-1 space-y-2">
              <div class="h-4 bg-slate-700 rounded w-3/4" />
              <div class="h-3 bg-slate-700 rounded w-1/2" />
            </div>
          </div>
        </div>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="voice in voices"
          :key="voice.id"
          class="glass-card p-4 hover:border-primary-500/30 transition-all"
        >
          <div class="flex gap-4">
            <div class="w-16 h-16 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-medium text-white truncate">{{ voice.name }}</h3>
                <span v-if="voice.type === 'preset'" class="px-2 py-0.5 bg-accent-500/20 text-accent-400 text-xs rounded">预设</span>
              </div>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400">{{ voice.language || '中文' }}</span>
                <span class="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400">{{ voice.gender === 'female' ? '女声' : voice.gender === 'male' ? '男声' : '通用' }}</span>
              </div>

              <!-- 试听按钮 -->
              <div class="flex items-center gap-2 mt-3">
                <el-button
                  size="small"
                  :type="previewingVoiceId === voice.id ? 'primary' : 'default'"
                  @click="handlePreview(voice)"
                >
                  <svg v-if="previewingVoiceId !== voice.id" class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <svg v-else class="w-4 h-4 mr-1 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  {{ previewingVoiceId === voice.id ? '停止' : '试听' }}
                </el-button>
                <el-button
                  v-if="voice.type !== 'preset'"
                  @click="handleDelete(voice)"
                  type="danger"
                  size="small"
                  plain
                >
                  删除
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="!loading && voices.length === 0" class="glass-card p-12 text-center">
        <svg class="w-16 h-16 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
        <h3 class="text-lg font-medium text-white mb-2">暂无系统音色</h3>
        <p class="text-slate-400">请联系管理员添加预设音色</p>
      </div>
    </div>

    <!-- 克隆声音对话框 -->
    <el-dialog
      v-model="cloneDialogVisible"
      title="克隆声音"
      width="500px"
      append-to-body
      :close-on-click-modal="false"
    >
      <el-form ref="cloneFormRef" :model="cloneForm" :rules="cloneFormRules" label-width="80px">
        <el-form-item label="音色名称" prop="name" required>
          <el-input v-model="cloneForm.name" placeholder="给克隆音色起个名字" maxlength="20" show-word-limit />
        </el-form-item>

        <el-form-item label="音色资源 ID" prop="speakerId" required>
          <el-input 
            ref="speakerIdInputRef"
            v-model="cloneForm.speakerId" 
            placeholder="请输入火山引擎控制台的音色ID，通常以 S_ 开头"
            maxlength="50"
          />
          <div class="text-xs text-blue-400 mt-1">
            如何获取？前往
            <span class="font-medium">火山引擎控制台 → 声音复刻 → 我的音色 → 创建音色</span>
            ，复制生成的音色ID
          </div>
        </el-form-item>

        <el-form-item label="音频样本" required>
          <div class="w-full">
            <el-upload
              class="w-full"
              drag
              action="/api/core/upload"
              :headers="uploadHeaders"
              :before-upload="beforeAudioUpload"
              :on-success="handleAudioSuccess"
              :on-error="handleAudioError"
              accept=".mp3,.wav,.ogg,.m4a,.aac"
              :disabled="uploadingAudio"
            >
              <el-icon class="el-icon--upload"><upload-filled /></el-icon>
              <div class="el-upload__text">
                拖拽音频文件到此处，或<em>点击上传</em>
              </div>
              <template #tip>
                <div class="el-upload__tip">
                  支持 MP3、WAV、OGG、M4A、AAC 格式，时长 10-30 秒，文件小于 10MB
                </div>
              </template>
            </el-upload>
            <div v-if="cloneForm.audioUrl" class="mt-2 text-green-400 text-sm flex items-center gap-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              音频已上传
            </div>
          </div>
        </el-form-item>

        <el-form-item label="语言">
          <el-radio-group v-model="cloneForm.language">
            <el-radio :label="0">中文</el-radio>
            <el-radio :label="1">英文</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="cloneDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="cloneLoading" @click="submitClone">
          提交克隆
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
