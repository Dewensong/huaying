<script setup lang="ts">
const technologies = [
  {
    icon: '3d',
    title: 'AI 3D建模',
    desc: '支持照片生成3D形象，也支持上传自定义模型，满足不同场景需求',
    highlight: '智能生成'
  },
  {
    icon: 'audio',
    title: 'AI 口型驱动',
    desc: '高精度语音驱动口型同步，文本转语音 + 口型动画一气呵成',
    highlight: '精准同步'
  },
  {
    icon: 'video',
    title: '批量视频合成',
    desc: '多任务并行处理，文案→视频全自动，大幅提升内容生产效率',
    highlight: '高效生产'
  }
]
</script>

<template>
  <section id="tech" class="py-24 relative">
    <div class="tech-grid"></div>
    <div class="absolute inset-0 bg-gradient-to-b from-transparent via-[#8B5CF6]/5 to-transparent"></div>
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      <div class="text-center mb-16 scroll-animate">
        <span class="inline-block px-4 py-1.5 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-full text-sm mb-6">核心技术</span>
        <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">自研核心技术，打造专业级数字人视频</h2>
        <p class="text-slate-400 max-w-2xl mx-auto">集成行业顶尖AI能力，从形象生成到口型驱动，全流程智能化</p>
      </div>
      
      <div class="grid md:grid-cols-3 gap-6">
        <div 
          v-for="(tech, index) in technologies" 
          :key="tech.title"
          class="group unified-card p-8 scroll-animate"
          :style="{ animationDelay: `${index * 0.15}s` }"
        >
          <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary-500/30 transition-all flex-shrink-0">
            <span class="text-lg font-bold text-white leading-none tracking-wider">{{ tech.icon.toUpperCase() }}</span>
          </div>
          <div class="flex items-center gap-2 mb-3">
            <h3 class="text-xl font-semibold text-white">{{ tech.title }}</h3>
            <span class="px-2 py-0.5 bg-[#3B82F6]/10 text-[#3B82F6] text-xs rounded-full">{{ tech.highlight }}</span>
          </div>
          <p class="text-slate-400 leading-relaxed">{{ tech.desc }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* 技术区网格 */
.tech-grid {
  position: absolute;
  inset: 0;
  background-image: 
    radial-gradient(circle at 1px 1px, rgba(139, 92, 246, 0.1) 1px, transparent 0);
  background-size: 50px 50px;
  pointer-events: none;
  mask-image: radial-gradient(ellipse 60% 40% at 50% 50%, black, transparent);
}

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
