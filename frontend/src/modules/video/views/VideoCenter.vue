<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { videoApi } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useScriptStore } from '@/stores'
import { useWebSocketProgress } from '@/composables/useWebSocketProgress'
import VideoKanban from '../components/VideoKanban.vue'
import VideoCreateDrawer from '../components/VideoCreateDrawer.vue'
import VideoDetail from '../components/VideoDetail.vue'

const route = useRoute()
const scriptStore = useScriptStore()
const prefillScripts = ref<{ text: string }[]>([])

const videos = ref<any[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const createDrawerVisible = ref(false)
const detailVisible = ref(false)
const currentVideo = ref<any>(null)

// 分页相关
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

// 批量选择相关
const batchMode = ref(false)
const selectedVideoIds = ref<number[]>([])
const batchDeleting = ref(false)

const statusMap = {
  pending: { label: '排队中', color: '#F59E0B' },
  processing: { label: '生成中', color: '#3B82F6' },
  completed: { label: '已完成', color: '#10B981' },
  failed: { label: '失败', color: '#EF4444' }
}

// 统计使用后端返回的 total
const stats = computed(() => ({
  pending: statusCounts.value.pending,
  processing: statusCounts.value.processing,
  completed: statusCounts.value.completed,
  failed: statusCounts.value.failed
}))

// 状态统计（从后端获取）
const statusCounts = ref({
  pending: 0,
  processing: 0,
  completed: 0,
  failed: 0
})

const selectedVideos = computed(() => {
  return videos.value.filter(v => selectedVideoIds.value.includes(v.id))
})

async function fetchVideos() {
  loading.value = true
  currentPage.value = 1 // 重置页码
  try {
    const res = await videoApi.list({ page: 1, pageSize: pageSize.value }) as any
    const list = res.data?.list || res.list || []
    videos.value = list
    total.value = res.data?.total || res.total || 0
  } catch (error) {
    ElMessage.error('获取视频列表失败')
  } finally {
    loading.value = false
  }
}

async function fetchVideosStatusCounts() {
  // 获取各状态总数，直接使用后端 SQL COUNT 返回的精确数据
  try {
    const res = await videoApi.list({ page: 1, pageSize: 1 }) as any
    const counts = res.statusCounts || {}
    statusCounts.value = {
      pending: counts.pending || 0,
      processing: counts.processing || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0
    }
    total.value = res.total || 0
  } catch (error) {
    console.error('获取状态统计失败', error)
  }
}

async function loadMore() {
  if (loadingMore.value || videos.value.length >= total.value) return
  
  loadingMore.value = true
  try {
    const nextPage = currentPage.value + 1
    const res = await videoApi.list({ page: nextPage, pageSize: pageSize.value }) as any
    const list = res.data?.list || res.list || []
    if (list.length > 0) {
      videos.value = [...videos.value, ...list]
      currentPage.value = nextPage
    }
  } catch (error) {
    ElMessage.error('加载更多失败')
  } finally {
    loadingMore.value = false
  }
}

function handleViewDetail(video: any) {
  currentVideo.value = video
  detailVisible.value = true
}

async function handleRetry(video: any) {
  try {
    await videoApi.retry(video.id)
    ElMessage.success('已重新提交')
    fetchVideos()
  } catch (error) {
    ElMessage.error('重试失败')
  }
}

async function handleDelete(video: any) {
  try {
    await videoApi.delete(video.id)
    ElMessage.success('删除成功')
    // 重新加载列表和统计数据，确保前后端一致
    await fetchVideos()
    await fetchVideosStatusCounts()
  } catch (error) {
    ElMessage.error('删除失败')
  }
}

// 批量选择相关函数
function toggleBatchMode() {
  batchMode.value = !batchMode.value
  if (!batchMode.value) {
    selectedVideoIds.value = []
  }
}

function handleSelectionChange(ids: number[]) {
  selectedVideoIds.value = ids
}

async function handleBatchDelete() {
  if (selectedVideoIds.value.length === 0) {
    ElMessage.warning('请先选择要删除的视频')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedVideoIds.value.length} 个视频吗？此操作不可恢复。`,
      '批量删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    batchDeleting.value = true
    const deletePromises = selectedVideoIds.value.map(id => videoApi.delete(id))
    await Promise.all(deletePromises)
    ElMessage.success(`成功删除 ${selectedVideoIds.value.length} 个视频`)

    // 重新加载列表和统计数据，确保前后端一致
    await fetchVideos()
    await fetchVideosStatusCounts()

    selectedVideoIds.value = []
    batchMode.value = false
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('批量删除失败')
    }
  } finally {
    batchDeleting.value = false
  }
}

async function handleBatchRetry() {
  const failedVideos = selectedVideos.value.filter(v => v.status === 'failed')
  if (failedVideos.length === 0) {
    ElMessage.warning('选中的视频中没有失败的任务')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要重试选中的 ${failedVideos.length} 个失败视频吗？`,
      '批量重试确认',
      {
        confirmButtonText: '确定重试',
        cancelButtonText: '取消',
        type: 'info'
      }
    )

    const retryPromises = failedVideos.map(v => videoApi.retry(v.id))
    await Promise.all(retryPromises)
    ElMessage.success(`已提交 ${failedVideos.length} 个视频重试`)
    selectedVideoIds.value = []
    batchMode.value = false
    fetchVideos()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('批量重试失败')
    }
  }
}

async function handleBatchDownload() {
  const completedVideos = selectedVideos.value.filter(v => v.status === 'completed')
  if (completedVideos.length === 0) {
    ElMessage.warning('选中的视频中没有已完成的视频')
    return
  }

  const token = localStorage.getItem('token')

  for (const video of completedVideos) {
    let downloadUrl = video.video_url || video.url

    // 如果是相对路径，添加后端 baseURL 前缀
    if (downloadUrl && !downloadUrl.startsWith('http')) {
      // 后端返回的相对路径是 /api/static/videos/xxx，需要拼接后端地址
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'
      downloadUrl = `${baseUrl}${downloadUrl.startsWith('/') ? '' : '/'}${downloadUrl}`
    }

    if (!downloadUrl) continue

    // 使用 XMLHttpRequest 下载并触发浏览器下载
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
        link.download = `${video.title || '视频_' + video.id}.mp4`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      }
    }
    xhr.send()
  }

  ElMessage.success(`正在下载 ${completedVideos.length} 个视频`)
}

function handleCreateSuccess() {
  createDrawerVisible.value = false
  // 刷新整个视频列表和状态统计
  fetchVideos()
  fetchVideosStatusCounts()
}

// 轮询更新处理中的任务
let pollTimer: number | null = null

// WebSocket 实时进度
const { connected, subscribe, onProgress } = useWebSocketProgress()

// 【修复】注册 WebSocket 进度回调，实时更新 videos 数组中的 progress 字段
onProgress(async (videoId: number, percent: number, step?: string, data?: any) => {
  const index = videos.value.findIndex(v => v.id === videoId)

  if (index !== -1) {
    // 视频完成时，重新获取视频详情（包含缩略图等）
    if (percent >= 100) {
      try {
        const res = await videoApi.getDetail(videoId) as any
        const videoDetail = res?.data || res
        if (videoDetail) {
          const updatedVideo = {
            ...videos.value[index],
            ...videoDetail,
            progress: 100,
            status: data?.error ? 'failed' : 'completed'
          }
          videos.value.splice(index, 1, updatedVideo)
        }
      } catch (err) {
        console.error(`[VideoCenter] 获取视频详情失败:`, err)
        // 即使获取失败，也更新状态
        const updatedVideo = {
          ...videos.value[index],
          progress: 100,
          status: data?.error ? 'failed' : 'completed'
        }
        videos.value.splice(index, 1, updatedVideo)
      }
    } else {
      // 使用 splice 触发 Vue 3 深度响应式更新
      const updatedVideo = {
        ...videos.value[index],
        progress: percent,
        step: step || videos.value[index].step,
      }
      videos.value.splice(index, 1, updatedVideo)
    }

    // 从后端重新获取精确统计（避免基于当前分页列表计算导致数字跳动）
    fetchVideosStatusCounts()
  } else {
    console.warn(`[VideoCenter] ⚠️ 未在当前列表中找到 videoId=${videoId}，忽略此消息`)
  }
})

// 获取处理中的视频 ID 列表
function getProcessingVideoIds(): number[] {
  return videos.value
    .filter(v => v.status === 'processing' || v.status === 'pending')
    .map(v => v.id)
}

function startPolling() {
  pollTimer = window.setInterval(() => {
    // 只更新处理中的任务状态，不需要重新获取整个列表
    const hasProcessing = videos.value.some(v => v.status === 'processing' || v.status === 'pending')
    if (hasProcessing) {
      fetchVideosStatusCounts()
      // 同时刷新当前页数据，更新任务状态
      videoApi.list({ page: currentPage.value, pageSize: pageSize.value }).then((res: any) => {
        const list = res.data?.list || res.list || []
        // 【修复】保留 WebSocket 更新的 progress 和 step 值，避免被 API 响应覆盖
        videos.value = list.map((newVideo: any) => {
          const oldVideo = videos.value.find((v: any) => v.id === newVideo.id)
          // 如果旧视频有 WebSocket 更新的 progress，保留它
          if (oldVideo && oldVideo.progress !== undefined && oldVideo.progress > 0) {
            return {
              ...newVideo,
              progress: oldVideo.progress,
              step: oldVideo.step || newVideo.step
            }
          }
          return newVideo
        })
      }).catch(console.error)
      
      // 订阅 WebSocket 进度（如果有处理中的任务且未连接）
      const processingIds = getProcessingVideoIds()
      if (processingIds.length > 0 && !connected.value) {
        subscribe(processingIds)
      }
    }
  }, 5000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// 监听处理中视频 ID 列表变化，更新 WebSocket 订阅
const prevProcessingIds = ref<number[]>([])
watch(videos, (newVideos) => {
  const processingIds = newVideos
    .filter(v => v.status === 'processing' || v.status === 'pending')
    .map(v => v.id)
    .sort((a, b) => a - b)
  
  // 只在 ID 列表真正变化时才重新订阅
  const prev = prevProcessingIds.value
  if (processingIds.length !== prev.length ||
      processingIds.some((id, i) => id !== prev[i])) {
    prevProcessingIds.value = processingIds
    if (processingIds.length > 0) {
      subscribe(processingIds)
    }
  }
}, { deep: true })

onMounted(() => {
  fetchVideos()
  fetchVideosStatusCounts()
  startPolling()

  // 检查是否有从文案页传来的数据
  if (route.query.openCreate === 'true') {
    const scripts = scriptStore.consumeScripts()
    if (scripts.length > 0) {
      prefillScripts.value = scripts.map(s => ({ text: s.text }))
      createDrawerVisible.value = true
    }
    // 清除 URL 参数
    history.replaceState({}, '', route.path)
  }
})

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <div class="space-y-6 animate-fade-in overflow-x-hidden">
    <!-- 页面标题和操作 -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold text-white">视频任务中心</h1>
        <p class="text-slate-400 mt-1">管理您的视频生成任务，支持批量创建和状态跟踪</p>
      </div>

      <div class="flex flex-wrap gap-3">
        <template v-if="batchMode">
          <el-button @click="toggleBatchMode">
            取消选择
          </el-button>
          <el-button
            @click="handleBatchRetry"
            :disabled="selectedVideoIds.length === 0"
          >
            <el-icon class="mr-1"><RefreshRight /></el-icon>
            重试 ({{ selectedVideos.filter(v => v.status === 'failed').length }})
          </el-button>
          <el-button
            @click="handleBatchDownload"
            :disabled="selectedVideoIds.length === 0"
          >
            <el-icon class="mr-1"><Download /></el-icon>
            下载 ({{ selectedVideos.filter(v => v.status === 'completed').length }})
          </el-button>
          <el-button
            type="danger"
            @click="handleBatchDelete"
            :loading="batchDeleting"
            :disabled="selectedVideoIds.length === 0"
          >
            <el-icon class="mr-1"><Delete /></el-icon>
            删除 ({{ selectedVideoIds.length }})
          </el-button>
        </template>
        <template v-else>
          <el-button @click="toggleBatchMode">
            <el-icon class="mr-1"><List /></el-icon>
            批量操作
          </el-button>
          <el-button type="primary" @click="createDrawerVisible = true">
            <el-icon class="mr-1"><Plus /></el-icon>
            创建视频
          </el-button>
        </template>
      </div>
    </div>

    <!-- 状态统计 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div
        v-for="(stat, key) in stats"
        :key="key"
        class="glass-card p-4"
      >
        <div class="flex items-center justify-between">
          <span class="text-sm text-slate-400">{{ statusMap[key as keyof typeof statusMap]?.label }}</span>
          <span
            class="text-2xl font-bold"
            :style="{ color: statusMap[key as keyof typeof statusMap]?.color }"
          >
            {{ stat }}
          </span>
        </div>
      </div>
    </div>

    <!-- 批量选择提示 -->
    <div v-if="batchMode && selectedVideoIds.length > 0" class="glass-card p-3 flex items-center justify-between">
      <span class="text-slate-300">
        已选择 <span class="text-primary-400 font-bold">{{ selectedVideoIds.length }}</span> 个视频
      </span>
      <el-button link type="primary" @click="selectedVideoIds = []">清空选择</el-button>
    </div>

    <!-- 看板视图 -->
    <VideoKanban
      :videos="videos"
      :loading="loading"
      :selectable="batchMode"
      :selected-ids="selectedVideoIds"
      :status-counts="statusCounts"
      @view="handleViewDetail"
      @retry="handleRetry"
      @delete="handleDelete"
      @refresh="fetchVideos"
      @selection-change="handleSelectionChange"
      @load-more="loadMore"
    />

    <!-- 创建抽屉 -->
    <VideoCreateDrawer
      v-model:visible="createDrawerVisible"
      :prefill-scripts="prefillScripts"
      @success="handleCreateSuccess"
      @opened="prefillScripts = []"
    />

    <!-- 详情侧边栏 -->
    <VideoDetail
      v-model:visible="detailVisible"
      :video="currentVideo"
      @retry="handleRetry"
      @delete="handleDelete"
    />
  </div>
</template>
