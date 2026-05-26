<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { videoApi } from '@/api'

interface Props {
  visible: boolean
  video: any
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  retry: [video: any]
  delete: [video: any]
}>()

// 视频详情数据
const videoDetail = ref<any>(null)
const loadingDetail = ref(false)

// 监听 visible 变化，当打开时获取详情
watch(() => props.visible, async (newVal) => {
  if (newVal && props.video?.id) {
    await fetchVideoDetail(props.video.id)
  }
})

// 获取视频详情
async function fetchVideoDetail(videoId: number) {
  loadingDetail.value = true
  try {
    const res = await videoApi.getDetail(videoId)
    const rawRes = res as any
    videoDetail.value = rawRes.data || rawRes
  } catch (error) {
    console.error('获取视频详情失败:', error)
    // 如果获取失败，使用 props.video 作为后备
    videoDetail.value = props.video
  } finally {
    loadingDetail.value = false
  }
}

// 响应式移动端判断
const isMobile = ref(false)
if (typeof window !== 'undefined') {
  isMobile.value = window.innerWidth < 768
  window.addEventListener('resize', () => {
    isMobile.value = window.innerWidth < 768
  })
}

// 当前显示的视频数据（优先使用详情数据）
const currentVideo = computed(() => videoDetail.value || props.video)

// 视频状态配置
const statusConfig = {
  pending: { label: '排队中', color: '#F59E0B' },
  processing: { label: '生成中', color: '#3B82F6' },
  completed: { label: '已完成', color: '#10B981' },
  failed: { label: '失败', color: '#EF4444' }
}

const statusInfo = computed(() => {
  if (!currentVideo.value) return null
  return statusConfig[currentVideo.value.status as keyof typeof statusConfig] || statusConfig.pending
})

// 格式化时间
function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 格式化时长为 mm:ss
function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return '--:--'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs.toFixed(2)).padStart(5, '0')}`
}

// 套餐标签映射
const planLabels: Record<string, string> = {
  free: '免费版',
  creator: '创作者',
  studio: '工作室',
  enterprise: '企业版'
}

// 获取套餐显示标签
function getPlanLabel(plan: string | undefined): string {
  if (!plan) return '免费版'
  return planLabels[plan] || plan
}

// 获取套餐标签背景色
function getPlanBadgeClass(plan: string | undefined) {
  const bgClasses: Record<string, string> = {
    free: 'bg-gray-500/20',
    creator: 'bg-blue-500/20',
    studio: 'bg-purple-500/20',
    enterprise: 'bg-amber-500/20'
  }
  return bgClasses[plan || 'free'] || 'bg-gray-500/20'
}

// 获取套餐文字颜色
function getPlanTextClass(plan: string | undefined) {
  const textClasses: Record<string, string> = {
    free: 'text-gray-400',
    creator: 'text-blue-400',
    studio: 'text-purple-400',
    enterprise: 'text-amber-400'
  }
  return textClasses[plan || 'free'] || 'text-gray-400'
}

// 检查视频是否可用
const isVideoAvailable = computed(() => {
  const video = currentVideo.value
  if (!video) return false
  // 有 video_url 且状态为已完成
  return video.status === 'completed' && (video.video_url || video.url)
})

// 下载视频
async function handleDownload() {
  const video = currentVideo.value
  if (!video) return

  // 优先使用 video_url（后端已返回完整 URL）
  let downloadUrl = video.video_url || video.url

  // 如果是相对路径，添加后端 baseURL 前缀
  if (downloadUrl && !downloadUrl.startsWith('http')) {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'
    downloadUrl = `${baseUrl}${downloadUrl.startsWith('/') ? '' : '/'}${downloadUrl}`
  }

  if (!downloadUrl) {
    ElMessage.warning('视频地址不存在')
    return
  }

  try {
    ElMessage.info('正在下载视频...')

    // 获取 token
    const token = localStorage.getItem('token')

    // 使用 XMLHttpRequest 以支持下载大文件
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('GET', downloadUrl, true)
      xhr.responseType = 'blob'

      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      }

      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          const blob = xhr.response
          const url = window.URL.createObjectURL(blob)

          const link = document.createElement('a')
          link.href = url
          link.download = `${video.title || '视频'}_${video.id}.mp4`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          window.URL.revokeObjectURL(url)

          ElMessage.success('视频下载完成')
          resolve()
        } else {
          ElMessage.error(`下载失败: ${xhr.status}`)
          reject(new Error(`下载失败: ${xhr.status}`))
        }
      }

      xhr.onerror = function() {
        ElMessage.error('网络错误，下载失败')
        reject(new Error('网络错误'))
      }

      xhr.send()
    })
  } catch (error: any) {
    console.error('下载失败:', error)
    ElMessage.error('视频下载失败，请稍后重试')
  }
}

// 复制文案
async function handleCopyScript() {
  const video = currentVideo.value
  if (!video?.script) {
    ElMessage.warning('文案内容为空')
    return
  }
  
  try {
    await navigator.clipboard.writeText(video.script)
    ElMessage.success('文案已复制到剪贴板')
  } catch (error) {
    ElMessage.error('复制失败，请手动复制')
  }
}

// 删除视频
async function handleDelete() {
  const video = currentVideo.value
  if (!video) return
  
  try {
    await ElMessageBox.confirm(
      '确定要删除这个视频吗？删除后无法恢复。',
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    emit('delete', video)
    emit('update:visible', false)
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

// 重新生成
function handleRetry() {
  const video = currentVideo.value
  if (!video) return
  emit('retry', video)
}
</script>

<template>
  <el-drawer
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    title="视频详情"
    :size="isMobile ? '100%' : '500px'"
    direction="rtl"
    destroy-on-close
    append-to-body
    class="video-detail-drawer"
  >
    <div v-if="currentVideo" class="space-y-6 overflow-x-hidden">
      <!-- 视频播放器 -->
      <div class="aspect-video rounded-lg overflow-hidden bg-slate-900 relative">
        <video
          v-if="isVideoAvailable"
          :src="currentVideo.video_url || currentVideo.url"
          controls
          controlsList="nodownload"
          class="w-full h-full object-contain"
          playsinline
          crossorigin="anonymous"
        >
          您的浏览器不支持视频播放
        </video>
        
        <!-- 处理中状态 -->
        <div 
          v-else-if="currentVideo.status === 'processing' || currentVideo.status === 'pending'"
          class="w-full h-full flex flex-col items-center justify-center"
        >
          <div class="relative w-20 h-20 mb-4">
            <svg class="animate-spin w-20 h-20 text-primary-500" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
          </div>
          <p class="text-slate-400 mb-2">视频生成中...</p>
          <p class="text-sm text-slate-500">{{ currentVideo.progress || 0 }}%</p>
        </div>
        
        <!-- 失败状态 -->
        <div 
          v-else-if="currentVideo.status === 'failed'"
          class="w-full h-full flex flex-col items-center justify-center"
        >
          <svg class="w-16 h-16 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p class="text-red-400 mb-2">视频生成失败</p>
          <p v-if="currentVideo.error" class="text-sm text-slate-500 px-4 text-center">{{ currentVideo.error }}</p>
        </div>
        
        <!-- 视频不可用 -->
        <div 
          v-else
          class="w-full h-full flex flex-col items-center justify-center"
        >
          <svg class="w-16 h-16 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p class="text-slate-400">视频暂时无法播放</p>
        </div>
      </div>

      <!-- 状态标签和字幕控制 -->
      <div class="flex items-center gap-3">
        <!-- 状态标签 -->
        <div
          v-if="statusInfo"
          class="flex items-center gap-2 px-3 py-2 rounded-lg"
          :style="{ backgroundColor: statusInfo.color + '20' }"
        >
          <span
            class="w-2 h-2 rounded-full animate-pulse"
            :style="{ backgroundColor: statusInfo.color }"
          />
          <span :style="{ color: statusInfo.color }">{{ statusInfo.label }}</span>
        </div>

        <!-- 套餐标签 -->
        <div
          v-if="currentVideo && currentVideo.userPlan"
          class="flex items-center gap-2 px-3 py-2 rounded-lg"
          :class="getPlanBadgeClass(currentVideo.userPlan)"
        >
          <span
            class="text-xs"
            :class="getPlanTextClass(currentVideo.userPlan)"
          >
            {{ getPlanLabel(currentVideo.userPlan) }}
          </span>
        </div>
      </div>

      <!-- 视频信息区 -->
      <div class="glass-card p-4 space-y-4">
        <!-- 标题 -->
        <div>
          <label class="text-xs text-slate-400 mb-1 block">标题</label>
          <p class="text-white font-medium">{{ currentVideo.title || '未命名视频' }}</p>
        </div>

        <!-- 时长 -->
        <div v-if="currentVideo.status === 'completed'">
          <label class="text-xs text-slate-400 mb-1 block">时长</label>
          <p class="text-white">{{ formatDuration(currentVideo.duration) }}</p>
        </div>

        <!-- 创建时间 -->
        <div>
          <label class="text-xs text-slate-400 mb-1 block">创建时间</label>
          <p class="text-white">{{ formatDateTime(currentVideo.created_at) }}</p>
        </div>

        <!-- 完成时间 -->
        <div v-if="currentVideo.finished_at || currentVideo.completed_at">
          <label class="text-xs text-slate-400 mb-1 block">完成时间</label>
          <p class="text-white">{{ formatDateTime(currentVideo.finished_at || currentVideo.completed_at) }}</p>
        </div>
      </div>

      <!-- 文案区域 -->
      <div v-if="currentVideo.script" class="glass-card p-4">
        <div class="flex items-center justify-between mb-2">
          <label class="text-xs text-slate-400">文案内容</label>
          <el-button 
            size="small" 
            text 
            @click="handleCopyScript"
            class="!text-primary-400"
          >
            <el-icon class="mr-1"><DocumentCopy /></el-icon>
            复制文案
          </el-button>
        </div>
        <p class="text-white text-sm whitespace-pre-wrap leading-relaxed">{{ currentVideo.script }}</p>
      </div>

      <!-- 操作按钮 -->
      <div class="space-y-3">
        <!-- 重新生成（失败状态） -->
        <el-button
          v-if="currentVideo.status === 'failed'"
          @click="handleRetry"
          type="success"
          class="w-full"
        >
          <el-icon class="mr-1"><Refresh /></el-icon>
          重新生成
        </el-button>

        <!-- 下载视频 + 删除视频（已完成） -->
        <div
          v-if="currentVideo.status === 'completed'"
          class="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4"
          style="padding-bottom: 10px;"
        >
          <el-button
            @click="handleDownload"
            class="w-full sm:w-36 sm:!flex-none !bg-gradient-to-r !from-primary-500 !to-purple-500 !text-white !border-0"
          >
            <el-icon class="mr-1"><Download /></el-icon>
            下载视频
          </el-button>
          <el-button
            @click="handleDelete"
            class="w-full sm:w-36 sm:!flex-none !bg-transparent !text-slate-400 !border !border-slate-600 hover:!border-red-500 hover:!text-red-400"
          >
            <el-icon class="mr-1"><Delete /></el-icon>
            删除视频
          </el-button>
        </div>

        <!-- 仅删除视频（未完成） -->
        <el-button
          v-if="currentVideo.status !== 'completed'"
          @click="handleDelete"
          class="w-full !bg-transparent !text-slate-400 !border !border-slate-600 hover:!border-red-500 hover:!text-red-400"
        >
          <el-icon class="mr-1"><Delete /></el-icon>
          删除视频
        </el-button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-else-if="loadingDetail" class="flex items-center justify-center h-64">
      <el-icon class="is-loading text-4xl text-primary-500">
        <Loading />
      </el-icon>
    </div>
  </el-drawer>
</template>

<style scoped>
/* 视频详情弹窗私有样式 - 手机端去掉按钮间距 */
@media screen and (max-width: 768px){
  .video-detail-drawer .el-drawer__body .el-button + .el-button,
  .video-detail-drawer .el-drawer__body .el-button {
    margin-left: 0 !important;
  }
}

</style>
