<script setup lang="ts">
const partners = [
  { name: '腾讯云', color: 'from-blue-500 to-blue-600' },
  { name: '火山引擎', color: 'from-orange-500 to-red-500' },
  { name: 'NVIDIA', color: 'from-green-500 to-yellow-500' },
  { name: '阿里云', color: 'from-orange-400 to-orange-600' },
  { name: '字节跳动', color: 'from-pink-500 to-purple-500' },
  { name: '华为云', color: 'from-red-500 to-orange-500' }
]
</script>

<template>
  <section class="py-24 relative">
    <div class="absolute inset-0 bg-gradient-to-r from-[#3B82F6]/5 via-transparent to-[#8B5CF6]/5"></div>
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      <div class="text-center mb-16 scroll-animate">
        <span class="inline-block px-4 py-1.5 bg-[#06B6D4]/10 text-[#06B6D4] rounded-full text-sm mb-6">合作生态</span>
        <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">强大技术合作伙伴</h2>
        <p class="text-slate-400 max-w-2xl mx-auto">我们与行业领先技术提供商合作，确保最佳性能和稳定性</p>
      </div>
      
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 scroll-animate">
        <div 
          v-for="partner in partners" 
          :key="partner.name"
          class="unified-card p-6 flex items-center justify-center min-h-[100px] group cursor-pointer hover:border-[#3B82F6]/50"
        >
          <span class="text-lg font-bold text-slate-500 group-hover:text-white group-hover:bg-gradient-to-r group-hover:bg-clip-text transition-all duration-300" :class="`group-hover:from-[${partner.color.split(' ')[0].replace('from-', '')}] group-hover:to-[${partner.color.split(' ')[1].replace('to-', '')}]`">
            {{ partner.name }}
          </span>
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
