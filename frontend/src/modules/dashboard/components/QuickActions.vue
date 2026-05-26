<script setup lang="ts">
const emit = defineEmits<{
  action: [path: string]
}>()

const actions = [
  {
    title: '创建视频',
    description: '开始制作数字人口播视频',
    icon: 'plus',
    path: '/videos',
    gradient: 'from-primary-500 to-accent-500'
  },
  {
    title: 'AI 文案',
    description: '让 AI 为您生成创意文案',
    icon: 'sparkles',
    path: '/scripts',
    gradient: 'from-accent-500 to-cyan-500'
  },
  {
    title: '形象管理',
    description: '管理您的数字人形象',
    icon: 'user',
    path: '/avatars',
    gradient: 'from-cyan-500 to-primary-500'
  },
  {
    title: '声音管理',
    description: '设置视频配音声音',
    icon: 'microphone',
    path: '/voices',
    gradient: 'from-emerald-500 to-cyan-500'
  }
]
</script>

<template>
  <div>
    <h2 class="text-lg font-semibold text-white mb-4">快捷操作</h2>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div
        v-for="(action, index) in actions"
        :key="index"
        @click="emit('action', action.path)"
        class="glass-card p-4 text-left hover:border-primary-500/30 hover:shadow-glow transition-all duration-300 group cursor-pointer"
      >
        <div
          :class="[
            'w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3 transform group-hover:scale-110 transition-transform',
            action.gradient
          ]"
        >
          <el-icon :size="20" class="text-white">
            <Plus v-if="action.icon === 'plus'" />
            <MagicStick v-else-if="action.icon === 'sparkles'" />
            <User v-else-if="action.icon === 'user'" />
            <Microphone v-else />
          </el-icon>
        </div>

        <h3 class="text-sm font-medium text-white mb-1">{{ action.title }}</h3>
        <p class="text-xs text-slate-400 line-clamp-2">{{ action.description }}</p>
      </div>
    </div>
  </div>
</template>
