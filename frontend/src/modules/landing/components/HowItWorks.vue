<script setup lang="ts">
const workflow = [
  { step: '01', title: '选择形象', desc: '从丰富形象库选择，或定制专属数字人' },
  { step: '02', title: '生成文案', desc: 'AI 智能生成直播话术，一键优化' },
  { step: '03', title: '合成视频', desc: '选择音色，生成口播视频' },
  { step: '04', title: '下载视频', desc: '下载生成视频，即可使用' }
]
</script>

<template>
  <section id="workflow" class="py-24">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-16 scroll-animate">
        <span class="inline-block px-4 py-1.5 bg-[#14B8A6]/10 text-[#14B8A6] rounded-full text-sm mb-6">使用流程</span>
        <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">四步创建数字人视频</h2>
        <p class="text-slate-400">无需专业技能，轻松创建专业级数字人视频</p>
      </div>
      
      <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
        <div 
          v-for="(item, index) in workflow" 
          :key="item.step"
          class="relative scroll-animate"
          :style="{ animationDelay: `${index * 0.15}s` }"
        >
          <div class="unified-card p-6 text-center h-full">
            <div class="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#14B8A6] to-[#F59E0B] flex items-center justify-center text-white font-bold text-lg hover:shadow-lg hover:shadow-primary-500/30 transition-all">
              {{ item.step }}
            </div>
            <h3 class="text-lg font-semibold text-white mb-2">{{ item.title }}</h3>
            <p class="text-slate-400 text-sm">{{ item.desc }}</p>
          </div>
          <!-- 连接线 -->
          <div v-if="index < workflow.length - 1" class="hidden lg:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
            <div class="w-6 h-0.5 bg-gradient-to-r from-[#14B8A6] to-transparent"></div>
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
