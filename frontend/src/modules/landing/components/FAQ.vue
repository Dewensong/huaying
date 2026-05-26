<script setup lang="ts">
import { ref } from 'vue'
import { CaretBottom } from '@element-plus/icons-vue'

const faqs = [
  {
    q: '话映适合哪些用户？',
    a: '话映面向电商直播、内容创作者、企业营销等场景，帮助用户快速生成高质量的数字人视频内容。'
  },
  {
    q: '数字人视频可以商用吗？',
    a: '付费用户生成的视频可用于商业用途。免费版仅供个人学习使用。'
  },
  {
    q: '额度用完怎么办？',
    a: '可以升级到更高级别套餐获得更多额度，也可以等待次月额度重置。'
  },
  {
    q: '支持哪些视频导出格式？',
    a: '支持 MP4、MOV 等主流格式，免费版支持 720P，付费版支持 1080P 高清导出。'
  },
  {
    q: '如何联系客服？',
    a: '可通过官网联系方式或应用内客服系统联系我们，工作日 9:00-18:00 实时响应。'
  }
]

const openFaq = ref<number | null>(null)

function toggleFaq(index: number) {
  openFaq.value = openFaq.value === index ? null : index
}
</script>

<template>
  <section id="faq" class="py-24">
    <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-12 scroll-animate">
        <span class="inline-block px-4 py-1.5 bg-[#14B8A6]/10 text-[#14B8A6] rounded-full text-sm mb-6">常见问题</span>
        <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">常见问题</h2>
        <p class="text-slate-400">有其他问题？随时联系我们的客服团队</p>
      </div>
      
      <div class="space-y-4 scroll-animate">
        <div
          v-for="(faq, index) in faqs"
          :key="index"
          class="unified-card overflow-hidden"
        >
          <el-button
            @click="toggleFaq(index)"
            class="w-full h-auto py-5 px-6 justify-start rounded-none border-none"
            text
          >
            <span class="font-medium text-white flex-1 text-left">{{ faq.q }}</span>
            <el-icon
              :class="['text-slate-400 transition-transform duration-300', openFaq === index ? 'rotate-180' : '']"
              :size="20"
            >
              <CaretBottom />
            </el-icon>
          </el-button>
          <div 
            :class="['overflow-hidden transition-all duration-300', openFaq === index ? 'max-h-40' : 'max-h-0']"
          >
            <p class="px-6 pb-5 text-slate-300">{{ faq.a }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* 统一卡片样式 */
.unified-card {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.3s ease;
}

.unified-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(59, 130, 246, 0.4);
  box-shadow: 0 8px 32px rgba(59, 130, 246, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.1);
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
