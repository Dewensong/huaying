<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  videos: any[]
  loading?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  viewAll: []
  click: [video: any]
}>()

// 确保 videos 是数组
const videoList = computed(() => {
  if (Array.isArray(props.videos)) return props.videos
  const raw = props.videos as any
  if (raw?.data && Array.isArray(raw.data)) return raw.data
  return []
})

const statusMap = {
  pending: { label: '排队中', color: '#F59E0B' },
  processing: { label: '生成中', color: '#3B82F6' },
  completed: { label: '已完成', color: '#10B981' },
  failed: { label: '失败', color: '#EF4444' }
}

function formatTime(dateStr: string) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="glass-card">
    <div class="flex items-center justify-between p-4 border-b border-white/10">
      <h2 class="text-lg font-semibold text-white">最近视频</h2>
      <el-button text type="primary" @click="emit('viewAll')">
        查看全部
        <el-icon class="ml-1"><ArrowRight /></el-icon>
      </el-button>
    </div>

    <div v-if="loading" class="p-8 text-center">
      <div class="inline-flex items-center gap-2 text-slate-400">
        <svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        加载中...
      </div>
    </div>

    <div v-else-if="videoList.length === 0" class="p-8 text-center">
      <svg class="w-12 h-12 mx-auto text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
      <p class="text-slate-400">暂无视频</p>
      <el-button type="primary" size="small" class="mt-3" @click="emit('viewAll')">
        立即创建
      </el-button>
    </div>

    <div v-else class="divide-y divide-white/5">
      <div
        v-for="video in videoList.slice(0, 5)"
        :key="video.id"
        class="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors cursor-pointer"
        @click="emit('click', video)"
      >
        <div class="w-16 h-10 rounded-lg bg-slate-800 overflow-hidden flex-shrink-0 relative">
          <img
            v-if="video.thumbnail"
            :src="video.thumbnail"
            class="w-full h-full object-cover"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <svg class="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <!-- 已完成状态显示播放图标 -->
          <div
            v-if="video.status === 'completed'"
            class="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg"
          >
            <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-white truncate">{{ video.title || '未命名视频' }}</p>
          <p class="text-xs text-slate-500">{{ formatTime(video.createdAt || video.created_at) }}</p>
        </div>

        <span
          class="px-2 py-1 rounded-full text-xs font-medium"
          :style="{ backgroundColor: (statusMap[video.status as keyof typeof statusMap]?.color || '#666') + '20', color: statusMap[video.status as keyof typeof statusMap]?.color || '#666' }"
        >
          {{ statusMap[video.status as keyof typeof statusMap]?.label || video.status }}
        </span>
      </div>
    </div>
  </div>
</template>
