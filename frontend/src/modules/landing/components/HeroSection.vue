<script setup lang="ts">
import { ArrowRight, VideoPlay, VideoPause } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { ref } from 'vue'

const router = useRouter()
const demoVideo = ref<HTMLVideoElement | null>(null)
const isVideoPlaying = ref(false)
const showPlayBtn = ref(false)

function goToRegister() {
  router.push('/register')
}

function scrollTo(id: string) {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' })
  }
}

function toggleVideo() {
  if (!demoVideo.value) return
  if (demoVideo.value.paused) {
    demoVideo.value.play()
    isVideoPlaying.value = true
  } else {
    demoVideo.value.pause()
    isVideoPlaying.value = false
  }
}
</script>

<template>
  <section class="relative min-h-screen flex items-center justify-center pt-24 overflow-hidden">
    <!-- 点阵网格背景 -->
    <div class="hero-grid"></div>
    
    <!-- 背景光效 -->
    <div class="absolute inset-0 bg-gradient-to-br from-[#3B82F6]/10 via-transparent to-[#8B5CF6]/10"></div>
    <div class="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-[#3B82F6]/10 rounded-full blur-[120px]"></div>
    <div class="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-[#8B5CF6]/15 rounded-full blur-[100px]"></div>

    <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <!-- 标签 -->
      <div class="inline-flex items-center gap-2 px-5 py-2 bg-white/5 rounded-full border border-white/10 mb-10 animate-float">
        <span class="w-2 h-2 bg-[#3B82F6] rounded-full animate-pulse"></span>
        <span class="text-sm text-slate-300">新一代 AI 数字人视频创作平台</span>
      </div>

      <h1 class="text-4xl sm:text-5xl lg:text-7xl font-bold text-white mb-8 leading-tight">
        <span class="bg-gradient-to-r from-[#3B82F6] via-[#8B5CF6] to-[#06B6D4] bg-clip-text text-transparent">AI 数字人</span>
        <br />
        <span class="text-white">视频创作平台</span>
      </h1>
      
      <p class="text-lg sm:text-xl text-slate-300 mb-12 max-w-3xl mx-auto leading-relaxed">
        智播坊是新一代智能数字人视频生成平台，帮助您快速创建高质量的虚拟主播内容，
        <span class="text-[#3B82F6] font-medium">适用于电商直播、知识分享、品牌宣传</span>等多种场景。
      </p>
      
      <!-- 主按钮组 -->
      <div class="flex flex-col sm:flex-row gap-4 justify-center mb-20">
        <el-button type="primary" size="large" @click="goToRegister()" class="!px-10 !py-4 !text-lg">
          立即免费开始
          <ArrowRight class="w-5 h-5 ml-2" />
        </el-button>
        <el-button size="large" @click="scrollTo('demo')" class="!px-10 !py-4 !text-lg !bg-white/5 !border-white/10 !text-white hover:!bg-white/10">
          <VideoPlay class="w-5 h-5 mr-2" />
          观看演示
        </el-button>
      </div>

      <!-- 真实案例视频预览 -->
      <div class="relative max-w-4xl mx-auto">
        <div class="relative p-1 bg-gradient-to-r from-[#3B82F6]/30 to-[#8B5CF6]/30 rounded-2xl animate-blue-purple-breathe">
          <div class="bg-[#0F172A]/90 rounded-2xl p-4 backdrop-blur-sm">
            <div class="aspect-video rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 flex items-center justify-center relative overflow-hidden border border-white/5">
              <!-- 视频标签 -->
              <video 
                ref="demoVideo"
                class="absolute inset-0 w-full h-full object-cover rounded-xl"
                src="/vedio.mp4"
                loop
                playsinline
                preload="auto"
              ></video>
              
              <!-- 播放/暂停按钮 -->
              <div class="absolute inset-0 flex items-center justify-center z-10 opacity-0 hover:opacity-100 transition-opacity duration-300" @mouseenter="showPlayBtn = true" @mouseleave="showPlayBtn = false">
                <div 
                  v-show="showPlayBtn || !isVideoPlaying"
                  class="w-16 h-16 rounded-full border-2 border-white/50 flex items-center justify-center cursor-pointer hover:border-white hover:bg-white/10 transition-all duration-300 backdrop-blur-sm"
                  @click="toggleVideo"
                >
                  <el-icon :size="28" class="text-white">
                    <VideoPlay v-if="!isVideoPlaying" />
                    <VideoPause v-else />
                  </el-icon>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 说明文字 -->
        <p class="text-center text-sm text-slate-400 mt-3">
          真实 AI 生成案例 · 输入文案即可自动合成
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Hero 区点阵网格 */
.hero-grid {
  position: absolute;
  inset: 0;
  background-image: 
    radial-gradient(circle at 1px 1px, rgba(59, 130, 246, 0.15) 1px, transparent 0);
  background-size: 30px 30px;
  pointer-events: none;
  mask-image: radial-gradient(ellipse 80% 60% at 50% 40%, black, transparent);
}

/* 动画 */
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

@keyframes breathe {
  0%, 100% { 
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.3), 0 0 40px rgba(139, 92, 246, 0.1);
  }
  50% { 
    box-shadow: 0 0 40px rgba(59, 130, 246, 0.5), 0 0 80px rgba(139, 92, 246, 0.3);
  }
}

@keyframes blue-purple-breathe {
  0%, 100% { 
    box-shadow: 0 0 30px rgba(59, 130, 246, 0.2), 0 0 60px rgba(139, 92, 246, 0.1);
  }
  50% { 
    box-shadow: 0 0 50px rgba(59, 130, 246, 0.4), 0 0 100px rgba(139, 92, 246, 0.2);
  }
}

.animate-float {
  animation: float 6s ease-in-out infinite;
}

.animate-breathe {
  animation: breathe 4s ease-in-out infinite;
}

.animate-blue-purple-breathe {
  animation: blue-purple-breathe 3s ease-in-out infinite;
}
</style>
