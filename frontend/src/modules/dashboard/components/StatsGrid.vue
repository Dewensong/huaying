<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  stats: {
    monthlyVideos: number
    pendingTasks: number
    completedVideos: number
  }
  loading?: boolean
}

const props = defineProps<Props>()

const cards = computed(() => [
  {
    title: '本月生成',
    value: props.stats.monthlyVideos,
    suffix: '个',
    icon: 'video',
    gradient: 'from-accent-500 to-cyan-500'
  },
  {
    title: '生成中',
    value: props.stats.pendingTasks,
    suffix: '个',
    icon: 'clock',
    gradient: 'from-cyan-500 to-primary-500'
  },
  {
    title: '已完成',
    value: props.stats.completedVideos,
    suffix: '个',
    icon: 'check',
    gradient: 'from-emerald-500 to-teal-500'
  }
])
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
    <div
      v-for="(card, index) in cards"
      :key="index"
      class="glass-card p-5 hover:border-primary-500/30 transition-all duration-300 group"
    >
      <div class="flex items-start justify-between">
        <div>
          <p class="text-sm text-slate-400 mb-1">{{ card.title }}</p>
          <div class="flex items-baseline gap-1">
            <span v-if="loading" class="text-2xl font-bold text-white">-</span>
            <span v-else class="text-3xl font-bold text-white">{{ card.value }}</span>
            <span class="text-sm text-slate-500">{{ card.suffix }}</span>
          </div>
        </div>

        <div
          :class="[
            'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center transform group-hover:scale-110 transition-transform',
            card.gradient
          ]"
        >
          <svg v-if="card.icon === 'video'" class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <svg v-else-if="card.icon === 'clock'" class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <svg v-else class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>
