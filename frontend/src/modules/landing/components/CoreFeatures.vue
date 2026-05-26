<script setup lang="ts">
const features = [
  {
    svgIcon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
    title: '数字人形象',
    desc: '多种风格的虚拟主播形象，支持定制化打造专属IP'
  },
  {
    svgIcon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
    title: '智能配音',
    desc: 'AI 驱动的语音合成，支持多种音色和语言'
  },
  {
    svgIcon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    title: '智能文案',
    desc: '一键生成直播话术和视频脚本，省时省力'
  },
  {
    svgIcon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
    title: '视频生成',
    desc: '批量生成高质量视频，支持多种场景模板'
  },
  {
    svgIcon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    title: '数据分析',
    desc: '实时监控直播效果，优化运营策略'
  },
  {
    svgIcon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
    title: '一键发布',
    desc: '多平台同步发布，覆盖主流直播平台'
  }
]
</script>

<template>
  <section id="features" class="py-24">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-16 scroll-animate">
        <span class="inline-block px-4 py-1.5 bg-[#14B8A6]/10 text-[#14B8A6] rounded-full text-sm mb-6">核心功能</span>
        <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">强大功能，简单易用</h2>
        <p class="text-slate-400 max-w-2xl mx-auto">一站式数字人视频创作解决方案，从形象到内容，全流程智能化</p>
      </div>
      
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="(feature, index) in features"
          :key="feature.title"
          class="unified-card p-6 scroll-animate hover:-translate-y-1"
          :style="{ animationDelay: `${index * 0.08}s` }"
        >
          <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-[#14B8A6]/10 to-[#F59E0B]/10 flex items-center justify-center mb-5 border border-[#14B8A6]/20">
            <svg class="w-7 h-7 text-[#14B8A6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="feature.svgIcon" />
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-white mb-2">{{ feature.title }}</h3>
          <p class="text-slate-400 text-sm">{{ feature.desc }}</p>
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
