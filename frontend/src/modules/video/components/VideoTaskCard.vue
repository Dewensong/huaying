<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { ElMessageBox } from 'element-plus'

interface Props {
  video: {
    id: number
    title: string
    thumbnail?: string
    status: string
    progress?: number
    step?: string
    avatar?: string
    voice?: string
    createdAt?: string
    created_at?: string
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  click: []
  retry: []
  delete: []
}>()

const statusConfig = {
  pending: { label: '排队中', color: '#F59E0B', icon: 'clock' },
  processing: { label: '生成中', color: '#3B82F6', icon: 'spinner' },
  completed: { label: '已完成', color: '#10B981', icon: 'check' },
  failed: { label: '失败', color: '#EF4444', icon: 'x' }
}

const config = computed(() => statusConfig[props.video.status as keyof typeof statusConfig] || statusConfig.pending)

// 目标进度
const targetProgress = computed(() => Math.min(100, Math.max(0, props.video.progress || 0)))

// 平滑显示的进度（用于动画）
const displayProgress = ref(0)
let animationTimer: number | null = null

// 停止当前动画
function stopAnimation() {
  if (animationTimer !== null) {
    clearInterval(animationTimer)
    animationTimer = null
  }
}

// 启动平滑动画：从当前值逐步过渡到目标值
function startAnimation(target: number) {
  stopAnimation()
  
  const current = displayProgress.value
  const diff = target - current
  
  // 如果差距很小，直接设置
  if (Math.abs(diff) <= 1) {
    displayProgress.value = target
    return
  }
  
  // 根据差值计算动画时长（每 50ms 前进 1%）
  const step = diff > 0 ? 1 : -1
  const interval = 50 // 每 50ms 更新一次
  
  animationTimer = window.setInterval(() => {
    const newValue = displayProgress.value + step
    
    // 判断是否到达目标
    if ((step > 0 && newValue >= target) || (step < 0 && newValue <= target)) {
      displayProgress.value = target
      stopAnimation()
    } else {
      displayProgress.value = newValue
    }
  }, interval)
}

// 监听目标进度变化，触发动画（带防回退检查）
watch(targetProgress, (newVal) => {
  // 【防回退】只接受大于等于当前显示值的进度更新
  if (newVal >= displayProgress.value) {
    startAnimation(newVal)
  }
}, { immediate: true })

// 清理动画
onUnmounted(() => {
  stopAnimation()
})

// 计算进度百分比
const progressPercent = computed(() => displayProgress.value)

function formatTime(dateStr: string) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

async function handleDelete() {
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
    emit('delete')
  } catch {
    // 用户取消，不做任何操作
  }
}
</script>

<template>
  <div
    class="glass-card p-3 cursor-pointer hover:border-primary-500/30 transition-all group"
  >
    <!-- 缩略图 -->
    <div class="relative aspect-video rounded-lg overflow-hidden bg-slate-800 mb-3">
      <img
        v-if="video.thumbnail"
        :src="video.thumbnail"
        class="w-full h-full object-cover"
      />
      <div v-else class="w-full h-full flex items-center justify-center">
        <svg class="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </div>

      <!-- 进度条遮罩层（仅在 processing 状态显示） -->
      <div
        v-if="video.status === 'processing'"
        class="absolute inset-0 bg-black/40 flex flex-col items-center justify-center"
      >
        <!-- 进度百分比 -->
        <div class="text-2xl font-bold text-white mb-1 animate-number-pulse">
          {{ progressPercent }}%
        </div>
        <!-- 步骤文字 -->
        <div v-if="video.step" class="text-xs text-slate-300 px-2 text-center max-w-full truncate animate-step-fade">
          {{ video.step }}
        </div>
      </div>

      <!-- 进度条 -->
      <div
        v-if="video.status === 'processing'"
        class="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-700 overflow-hidden"
      >
        <div
          class="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 transition-all duration-300 ease-out animate-progress"
          :style="{ width: `${progressPercent}%` }"
        />
        <!-- 条纹动画覆盖层 -->
        <div
          class="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-stripe"
        />
      </div>

      <!-- 状态角标 -->
      <div
        class="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium"
        :style="{ backgroundColor: config.color + 'CC', color: 'white' }"
      >
        {{ config.label }}
      </div>
    </div>

    <!-- 标题 -->
    <h4 class="text-sm font-medium text-white truncate mb-2">{{ video.title || '未命名视频' }}</h4>

    <!-- 元信息 -->
    <div class="flex items-center justify-between text-xs text-slate-500">
      <span>{{ formatTime(video.createdAt || video.created_at || '') }}</span>

      <!-- pending 状态特殊提示 -->
      <span v-if="video.status === 'pending'" class="text-amber-400 text-xs">
        等待处理...
      </span>

      <!-- processing 状态显示进度 -->
      <span v-if="video.status === 'processing'" class="text-blue-400 text-xs">
        {{ progressPercent }}%
      </span>

      <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <!-- pending 状态：取消按钮 -->
        <el-button
          v-if="video.status === 'pending'"
          @click.stop="handleDelete"
          type="warning"
          size="small"
          circle
          title="取消任务"
        >
          <el-icon><Close /></el-icon>
        </el-button>
        <!-- failed 状态：重试按钮 -->
        <el-button
          v-if="video.status === 'failed'"
          @click.stop="emit('retry')"
          type="success"
          size="small"
          circle
          title="重试"
        >
          <el-icon><RefreshRight /></el-icon>
        </el-button>
        <!-- completed 状态：预览按钮 -->
        <el-button
          v-if="video.status === 'completed'"
          @click.stop="emit('click')"
          type="primary"
          size="small"
          circle
          title="预览"
        >
          <el-icon><VideoPlay /></el-icon>
        </el-button>
        <!-- 删除按钮（所有状态） -->
        <el-button
          @click.stop="handleDelete"
          type="danger"
          size="small"
          circle
          title="删除"
        >
          <el-icon><Delete /></el-icon>
        </el-button>
      </div>
    </div>
  </div>
</template>
