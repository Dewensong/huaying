<script setup lang="ts">
import { watch } from 'vue'
import AvatarCard from '@/modules/avatar/components/AvatarCard.vue'

const props = defineProps<{
  avatars: any[]
  voices: any[]
  loading?: boolean
}>()

watch(() => props.avatars, () => {
  // avatars 更新时会自动响应式更新
}, { immediate: true, deep: true })

const avatarId = defineModel<number | null>('avatarId', { default: null })
const voiceId = defineModel<number | null>('voiceId', { default: null })
const voiceType = defineModel<string>('voiceType', { default: '' })  // 音色类型
const background = defineModel<'' | { type: 'color' | 'image'; value: string }>('background', { default: '' })
const subtitleConfig = defineModel<any>('subtitleConfig', { default: () => ({}) })

const bgOptions = [
  { label: '渐变蓝', type: 'image' as const, value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { label: '科技感', type: 'image' as const, value: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' },
  { label: '清新绿', type: 'image' as const, value: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  { label: '商务蓝', type: 'image' as const, value: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)' },
  { label: '纯色黑', type: 'color' as const, value: '#0a0a0a' }
]

// 处理形象选择
function handleAvatarSelect(avatar: any) {
  avatarId.value = avatar.id
}

// 处理声音选择
function handleVoiceSelect(voice: any) {
  voiceId.value = voice.id
  voiceType.value = voice.voice_type || ''
}
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
    <!-- 左侧：选择形象和声音 -->
    <div class="space-y-6">
      <!-- 形象选择 -->
      <div>
        <label class="block text-sm font-medium text-white mb-3">选择数字人形象</label>
        <div v-if="loading" class="grid grid-cols-3 gap-2">
          <div v-for="i in 6" :key="i" class="glass-card p-3 animate-pulse">
            <div class="aspect-[3/4] bg-slate-700 rounded-lg mb-2" />
            <div class="h-3 bg-slate-700 rounded w-3/4 mx-auto" />
          </div>
        </div>
        <div v-else-if="avatars.length === 0" class="h-48 bg-slate-800/50 rounded-xl flex flex-col items-center justify-center">
          <div class="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <p class="mt-3 text-sm text-white font-medium">暂无可用形象</p>
          <p class="mt-1 text-xs text-slate-400">请先在形象管理中创建形象</p>
          <el-button 
            type="primary" 
            size="small" 
            class="mt-3"
            @click="$router.push('/avatar')"
          >
            去创建形象
          </el-button>
        </div>
        <div v-else class="max-h-80 overflow-y-auto pr-1">
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div
              v-for="avatar in avatars"
              :key="avatar.id"
              @click="handleAvatarSelect(avatar)"
              :class="[
                'cursor-pointer rounded-lg transition-all duration-200',
                avatarId === avatar.id ? 'ring-2 ring-[#3B82F6] ring-offset-2 ring-offset-slate-900' : 'hover:ring-2 hover:ring-blue-500/50 hover:ring-offset-2 hover:ring-offset-slate-900'
              ]"
            >
              <AvatarCard
                :avatar="avatar"
                class="pointer-events-none"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 声音选择 -->
      <div>
        <label class="block text-sm font-medium text-white mb-3">选择配音声音</label>
        <div v-if="loading" class="space-y-2">
          <div v-for="i in 3" :key="i" class="h-12 bg-slate-700 rounded-lg animate-pulse" />
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="voice in voices"
            :key="voice.id"
            @click="handleVoiceSelect(voice)"
            :class="[
              'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border',
              voiceId === voice.id ? 'border-primary-500 bg-primary-500/10' : 'border-transparent hover:bg-slate-800'
            ]"
          >
            <div class="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-white flex items-center gap-2">
                {{ voice.name }}
                <span v-if="voice.source === 'cloned'" class="inline-flex items-center px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                  已克隆
                </span>
              </p>
              <p class="text-xs text-slate-400">
                <span class="inline-block px-1.5 py-0.5 bg-slate-700/50 rounded text-slate-400 mr-1">{{ voice.language || '中文' }}</span>
                <span class="inline-block px-1.5 py-0.5 bg-slate-700/50 rounded text-slate-400">
                  {{ voice.gender === 'female' ? '女声' : voice.gender === 'male' ? '男声' : (voice.gender || '通用') }}
                </span>
              </p>
            </div>
            <svg
              v-if="voiceId === voice.id"
              class="w-5 h-5 text-primary-400 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧：背景和样式配置 -->
    <div class="space-y-6">
      <!-- 背景选择 -->
      <div>
        <label class="block text-sm font-medium text-white mb-3">背景样式</label>
        <div class="grid grid-cols-5 gap-2">
          <div
            v-for="bg in bgOptions"
            :key="bg.value"
            @click="background = { type: bg.type, value: bg.value }"
            :class="[
              'h-10 rounded-lg cursor-pointer transition-all border-2',
              background && background.value === bg.value ? 'border-primary-500 ring-2 ring-primary-500/50' : 'border-transparent'
            ]"
            :style="{ background: bg.value }"
            :title="bg.label"
          />
        </div>
      </div>

      <!-- 字幕配置 -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <label class="text-sm font-medium text-white">字幕样式</label>
          <el-switch v-model="subtitleConfig.enabled" />
        </div>
        <div v-if="subtitleConfig.enabled" class="glass-card p-4 space-y-3">
          <div>
            <label class="text-xs text-slate-400">字体大小</label>
            <el-slider v-model="subtitleConfig.fontSize" :min="16" :max="40" show-input />
          </div>
          <div>
            <label class="text-xs text-slate-400">字体颜色</label>
            <el-color-picker v-model="subtitleConfig.color" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
