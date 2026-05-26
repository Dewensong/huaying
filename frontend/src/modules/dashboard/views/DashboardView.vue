<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { videoApi } from '@/api'
import { useAuthStore } from '@/stores'
import { useWebSocketProgress } from '@/composables/useWebSocketProgress'
import StatsGrid from '../components/StatsGrid.vue'
import QuickActions from '../components/QuickActions.vue'
import RecentVideos from '../components/RecentVideos.vue'
import VideoDetail from '@/modules/video/components/VideoDetail.vue'

const router = useRouter()
const authStore = useAuthStore()

const stats = ref({
  monthlyVideos: 0,
  pendingTasks: 0,
  completedVideos: 0
})

const recentVideos = ref<any[]>([])
const allVideos = ref<any[]>([]) // 所有视频（包括处理中的），用于轮询和 WebSocket
const loading = ref(true)

// 轮询定时器
let pollTimer: number | null = null

// 是否有处理中的视频（用于控制轮询启停）
const hasProcessingVideos = computed(() => {
  return allVideos.value.some(v => v.status === 'processing' || v.status === 'pending')
})

// 启动轮询
function startPolling() {
  if (pollTimer) return
  pollTimer = window.setInterval(() => {
    // 如果已经没有处理中的视频，停止轮询
    if (!hasProcessingVideos.value) {
      stopPolling()
      return
    }
    fetchData()
  }, 5000)
}

// 停止轮询
function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// 获取处理中视频 ID 列表
function getProcessingVideoIds(): number[] {
  return allVideos.value
    .filter(v => v.status === 'processing' || v.status === 'pending')
    .map(v => v.id)
}

// 详情抽屉
const detailVisible = ref(false)
const currentVideo = ref<any>(null)

async function fetchData() {
  loading.value = true
  try {
    const videosRes = await videoApi.list({ page: 1, pageSize: 20 }).catch(() => null)

    const videosData = videosRes as any
    // 使用后端 SQL COUNT 返回的精确统计数据，不再用前 5 条估算
    const statusCounts = videosData?.statusCounts || {}

    stats.value = {
      // 本月生成 = 已完成的视频数
      monthlyVideos: statusCounts.completed || 0,
      // 生成中 = pending + processing
      pendingTasks: (statusCounts.pending || 0) + (statusCounts.processing || 0),
      completedVideos: statusCounts.completed || 0
    }

    // 保存所有视频（用于检测处理中视频和 WebSocket 订阅）
    const list = videosData?.data?.list || videosData?.list || []
    allVideos.value = list
    // 只取已完成的视频作为最近视频展示
    recentVideos.value = list.filter((v: any) => v.status === 'completed').slice(0, 5)
  } catch (error) {
    console.error('获取数据失败', error)
  } finally {
    loading.value = false
  }
}

function goTo(path: string) {
  router.push(path)
}

function handleVideoClick(video: any) {
  currentVideo.value = video
  detailVisible.value = true
}

function handleRetry(video: any) {
  videoApi.retry(video.id).then(() => {
    fetchData()
    detailVisible.value = false
  }).catch(() => {})
}

function handleDelete(video: any) {
  videoApi.delete(video.id).then(() => {
    fetchData()
    detailVisible.value = false
  }).catch(() => {})
}

// WebSocket 连接管理
const { connect, subscribe, onProgress } = useWebSocketProgress()

onMounted(() => {
  // 先建立 WebSocket 连接
  connect()

  fetchData().then(() => {
    // 初始加载后，如果有处理中的视频才启动轮询和订阅
    if (hasProcessingVideos.value) {
      startPolling()
      subscribe(getProcessingVideoIds())
    }
  })

  // 注册 WebSocket 监听，视频状态变化时实时刷新
  onProgress((_videoId: number, percent: number, _step?: string, data?: any) => {
    // 视频完成或失败时立即刷新数据
    if (percent >= 100 || data?.error) {
      fetchData()
      return
    }
    // 如果有处理中的视频但轮询已停止，重新启动轮询
    if (hasProcessingVideos.value && !pollTimer) {
      startPolling()
    }
  })
})

// 监听处理中视频列表变化，自动更新 WebSocket 订阅
watch(allVideos, (newVideos) => {
  const processingIds = newVideos
    .filter(v => v.status === 'processing' || v.status === 'pending')
    .map(v => v.id)
  if (processingIds.length > 0) {
    subscribe(processingIds)
  }
}, { deep: true })

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <div class="space-y-6 animate-fade-in">
    <!-- 欢迎区域 -->
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold text-white">
          欢迎回来，{{ authStore.userInfo?.name || '用户' }}
        </h1>
        <p class="text-slate-400 mt-1">这里是您的视频创作控制台</p>
      </div>
    </div>

    <!-- 统计卡片 -->
    <StatsGrid :stats="stats" :loading="loading" />

    <!-- 快捷入口 -->
    <QuickActions @action="goTo" />

    <!-- 最近视频 -->
    <RecentVideos :videos="recentVideos" :loading="loading" @view-all="goTo('/videos')" @click="handleVideoClick" />

    <!-- 详情侧边栏 -->
    <VideoDetail
      v-model:visible="detailVisible"
      :video="currentVideo"
      @retry="handleRetry"
      @delete="handleDelete"
    />
  </div>
</template>
