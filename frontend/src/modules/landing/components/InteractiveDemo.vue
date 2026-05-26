<script setup lang="ts">
import { ref } from 'vue'
import { ArrowRight, Check, VideoPlay, VideoPause } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'

const router = useRouter()

function goToRegister() {
  router.push('/register')
}

const demoVideo = ref<HTMLVideoElement | null>(null)
const isVideoPlaying = ref(false)
const showPlayBtn = ref(false)

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
  <section id="demo" class="py-24 relative overflow-hidden">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      <div class="grid lg:grid-cols-2 gap-16 items-center">
        <!-- 左侧真实案例视频展示 -->
        <div class="relative scroll-animate">
          <div class="relative p-1 bg-gradient-to-r from-[#3B82F6]/40 to-[#8B5CF6]/40 rounded-3xl animate-blue-purple-breathe">
            <div class="bg-[#0F172A]/95 rounded-3xl p-6 backdrop-blur-xl">
              <div class="aspect-[4/3] rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 flex items-center justify-center relative overflow-hidden border border-white/5">
                <video 
                  ref="demoVideo"
                  class="absolute inset-0 w-full h-full object-cover rounded-2xl"
                  src="/vedio.mp4"
                  loop
                  playsinline
                  preload="auto"
                ></video>
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
        </div>

        <!-- 右侧文案 -->
        <div class="scroll-animate">
          <span class="inline-block px-4 py-1.5 bg-[#3B82F6]/10 text-[#3B82F6] rounded-full text-sm mb-6">效果演示</span>
          <h2 class="text-3xl md:text-4xl font-bold text-white mb-6">所见即所得</h2>
          <p class="text-slate-300 mb-8 leading-relaxed">
            输入文案，选择形象和声音，一键生成专业级口播视频。
            无需真人出镜，无需剪辑软件，几分钟搞定一天的视频内容。
          </p>
          <ul class="space-y-4 mb-10">
            <li class="flex items-center gap-3 text-slate-300">
              <span class="w-6 h-6 rounded-full bg-[#3B82F6]/20 flex items-center justify-center flex-shrink-0">
                <Check class="w-4 h-4 text-[#3B82F6]" />
              </span>
              多种形象风格可选，自定义上传形象
            </li>
            <li class="flex items-center gap-3 text-slate-300">
              <span class="w-6 h-6 rounded-full bg-[#3B82F6]/20 flex items-center justify-center flex-shrink-0">
                <Check class="w-4 h-4 text-[#3B82F6]" />
              </span>
              TTS 语音合成 + 声音克隆，音色统一自然
            </li>
            <li class="flex items-center gap-3 text-slate-300">
              <span class="w-6 h-6 rounded-full bg-[#3B82F6]/20 flex items-center justify-center flex-shrink-0">
                <Check class="w-4 h-4 text-[#3B82F6]" />
              </span>
              自动字幕生成，开箱即用
            </li>
          </ul>
          <el-button type="primary" size="large" @click="goToRegister()">
            立即体验
            <ArrowRight class="w-5 h-5 ml-2" />
          </el-button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* 动画 */
@keyframes blue-purple-breathe {
  0%, 100% { 
    box-shadow: 0 0 30px rgba(59, 130, 246, 0.2), 0 0 60px rgba(139, 92, 246, 0.1);
  }
  50% { 
    box-shadow: 0 0 50px rgba(59, 130, 246, 0.4), 0 0 100px rgba(139, 92, 246, 0.2);
  }
}

.animate-blue-purple-breathe {
  animation: blue-purple-breathe 3s ease-in-out infinite;
}

/* 滚动触发动画 */
.scroll-animate {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.6s ease-out, transform 0.6s ease-out;
}

.scroll-animate.visible {
  opacity: 1;
  transform: translateY(0);
}
</style>
