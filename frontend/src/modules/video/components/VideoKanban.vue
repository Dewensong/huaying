<script setup lang="ts">
import { computed } from 'vue'
import { useResponsive } from '@/composables/useResponsive'
import VideoTaskCard from './VideoTaskCard.vue'

interface Props {
  videos: any[]
  loading?: boolean
  selectable?: boolean
  selectedIds?: number[]
  statusCounts?: {
    pending: number
    processing: number
    completed: number
    failed: number
  }
}

const props = withDefaults(defineProps<Props>(), {
  selectable: false,
  selectedIds: () => [],
  statusCounts: () => ({
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0
  })
})

const emit = defineEmits<{
  view: [video: any]
  retry: [video: any]
  delete: [video: any]
  refresh: []
  'selection-change': [ids: number[]]
  'load-more': [columnKey: string]
}>()

const { isMobile, isTablet } = useResponsive()

const columns = [
  { key: 'pending', label: '排队中', color: '#F59E0B' },
  { key: 'processing', label: '生成中', color: '#3B82F6' },
  { key: 'completed', label: '已完成', color: '#10B981' },
  { key: 'failed', label: '失败', color: '#EF4444' }
]

const filteredVideos = (status: string) => {
  return props.videos.filter(v => v.status === status)
}

const gridClass = computed(() => {
  if (isMobile.value) return 'grid-cols-1'
  if (isTablet.value) return 'grid-cols-2'
  return 'grid-cols-1 lg:grid-cols-4'
})

function isSelected(videoId: number) {
  return props.selectedIds.includes(videoId)
}

function toggleSelect(videoId: number, event: Event) {
  event.stopPropagation()
  const newSelection = [...props.selectedIds]
  const index = newSelection.indexOf(videoId)
  if (index > -1) {
    newSelection.splice(index, 1)
  } else {
    newSelection.push(videoId)
  }
  emit('selection-change', newSelection)
}

// 无限滚动处理
function handleScroll(columnKey: string, event: Event) {
  const target = event.target as HTMLElement
  const { scrollTop, scrollHeight, clientHeight } = target
  // 当滚动到底部 50px 范围内时触发加载更多
  if (scrollHeight - scrollTop - clientHeight < 50) {
    emit('load-more', columnKey)
  }
}
</script>

<template>
  <div :class="['grid gap-4', gridClass]">
    <div
      v-for="column in columns"
      :key="column.key"
      class="glass-card"
    >
      <!-- 列头 -->
      <div
        class="px-4 py-3 border-b border-white/10 flex items-center justify-between"
        :style="{ borderLeftColor: column.color, borderLeftWidth: '3px' }"
      >
        <span class="font-medium text-white">{{ column.label }}</span>
        <span
          class="px-2 py-0.5 rounded-full text-xs font-medium"
          :style="{ backgroundColor: column.color + '20', color: column.color }"
        >
          {{ statusCounts[column.key as keyof typeof statusCounts] || filteredVideos(column.key).length }}
        </span>
      </div>

      <!-- 列内容 -->
      <div 
        class="p-3 space-y-3 max-h-[calc(100vh-380px)] overflow-y-auto"
        @scroll="(e) => handleScroll(column.key, e)"
      >
        <!-- 加载状态 -->
        <template v-if="loading">
          <div
            v-for="i in 2"
            :key="i"
            class="glass-card p-3 animate-pulse"
          >
            <div class="h-24 bg-slate-700 rounded-lg mb-3" />
            <div class="h-3 bg-slate-700 rounded w-3/4 mb-2" />
            <div class="h-3 bg-slate-700 rounded w-1/2" />
          </div>
        </template>

        <!-- 空状态 -->
        <div
          v-else-if="filteredVideos(column.key).length === 0"
          class="text-center py-8"
        >
          <svg class="w-8 h-8 mx-auto text-slate-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p class="text-sm text-slate-500">暂无任务</p>
        </div>

        <!-- 任务卡片 -->
        <div
          v-else
          v-for="video in filteredVideos(column.key)"
          :key="video.id"
          class="relative"
        >
          <!-- 选择框 -->
          <div
            v-if="selectable"
            class="absolute top-2 left-2 z-10"
            @click="(e) => toggleSelect(video.id, e)"
          >
            <div
              :class="[
                'w-5 h-5 rounded border-2 cursor-pointer transition-all flex items-center justify-center',
                isSelected(video.id)
                  ? 'bg-primary-500 border-primary-500'
                  : 'border-slate-500 hover:border-primary-400'
              ]"
            >
              <svg v-if="isSelected(video.id)" class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <VideoTaskCard
            :video="video"
            @click="emit('view', video)"
            @retry="emit('retry', video)"
            @delete="emit('delete', video)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
