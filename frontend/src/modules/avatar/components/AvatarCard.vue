<script setup lang="ts">
import { computed, ref } from 'vue'

interface Props {
  avatar: {
    id: number
    name: string
    image: string
    image_url?: string
    model_url?: string | null
    is_rigged?: number
    type: 'preset' | 'custom'
    enabled?: boolean
    config?: any
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  edit: [avatar: any]
  delete: [avatar: any]
  toggle: [avatar: any]
}>()

const hasModel = computed(() => !!props.avatar.model_url)

// 防止重复点击
const isToggling = ref(false)

function handleToggle(_newValue: string | number | boolean) {
  if (isToggling.value) return
  isToggling.value = true
  emit('toggle', props.avatar)
  // 重置标志位，确保能再次点击
  setTimeout(() => {
    isToggling.value = false
  }, 1000)
}
</script>

<template>
  <div
    :class="[
      'glass-card overflow-hidden group transition-all duration-300 hover:shadow-glow',
      'hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/20',
      avatar.enabled === false && 'opacity-50'
    ]"
  >
    <!-- 形象展示区域 -->
    <div class="aspect-[3/4] relative overflow-hidden bg-slate-800/50">
      <!-- 3D 模型（保留但基本不使用） -->
      <ModelViewer
        v-if="hasModel && avatar.model_url"
        :model-url="avatar.model_url"
        :auto-rotate="true"
        class="h-48"
      />

      <!-- 图片 -->
      <img
        v-else-if="avatar.image || avatar.image_url"
        :src="avatar.image || avatar.image_url"
        class="w-full h-full object-cover"
      />

      <!-- 默认占位图 -->
      <div
        v-else
        class="w-full h-full flex items-center justify-center bg-slate-800"
      >
        <el-icon :size="48" class="text-slate-600">
          <UserFilled />
        </el-icon>
      </div>

      <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <el-button
          @click="emit('edit', avatar)"
          circle
          title="编辑"
        >
          <el-icon><Edit /></el-icon>
        </el-button>
        <el-button
          @click="emit('delete', avatar)"
          type="danger"
          circle
          title="删除"
        >
          <el-icon><Delete /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- 底部信息 -->
    <div class="p-3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-medium text-white truncate flex-1">{{ avatar.name }}</h3>
        <el-switch
          :model-value="avatar.enabled"
          :disabled="isToggling"
          @change="handleToggle"
        />
      </div>
      <!-- 描述信息 -->
      <p v-if="avatar.config?.description" class="text-xs text-slate-500 mt-1 truncate">
        {{ avatar.config.description }}
      </p>
    </div>
  </div>
</template>
