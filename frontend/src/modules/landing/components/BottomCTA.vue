<script setup lang="ts">
import { ArrowRight } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'

const router = useRouter()

function goToRegister() {
  router.push('/register')
}
</script>

<template>
  <section class="py-24">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="relative p-12 md:p-16 text-center rounded-3xl overflow-hidden scroll-animate">
        <!-- 背景 -->
        <div class="absolute inset-0 bg-gradient-to-br from-[#3B82F6]/10 via-[#0F172A] to-[#8B5CF6]/10"></div>
        <div class="absolute inset-0 backdrop-blur-xl"></div>
        <!-- 光效 -->
        <div class="absolute top-0 left-1/4 w-[400px] h-[400px] bg-[#3B82F6]/10 rounded-full blur-[100px]"></div>
        <div class="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-[#8B5CF6]/10 rounded-full blur-[100px]"></div>
        
        <div class="relative z-10">
          <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">准备好开始了吗？</h2>
          <p class="text-slate-300 mb-10 max-w-2xl mx-auto">立即注册，免费体验强大的 AI 数字人视频创作能力</p>
          <el-button type="primary" size="large" @click="goToRegister()" class="!px-12 !py-4 !text-lg !animate-blue-purple-breathe">
            立即免费开始
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
