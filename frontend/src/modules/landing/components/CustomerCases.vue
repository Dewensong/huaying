<script setup lang="ts">
const trustedClients = [
  '某知名电商品牌',
  'XX MCN 机构',
  '某某餐饮连锁',
  'XX 教育集团',
  '某某科技公司',
  'YY 直播平台'
]
</script>

<template>
  <section id="cases" class="py-24">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-16 scroll-animate">
        <span class="inline-block px-4 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-full text-sm mb-6">客户案例</span>
        <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">已服务客户</h2>
        <p class="text-slate-400">来自各行业的领先企业正在使用话映</p>
      </div>

      <!-- Logo 墙 -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-16 scroll-animate">
        <div 
          v-for="client in trustedClients" 
          :key="client"
          class="unified-card p-6 flex items-center justify-center min-h-[80px] cursor-pointer"
        >
          <span class="text-slate-500 hover:text-white transition-colors text-sm text-center">{{ client }}</span>
        </div>
      </div>

      <!-- 客户证言 -->
      <div class="grid md:grid-cols-3 gap-6 scroll-animate">
        <div class="unified-card p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-12 h-12 rounded-full bg-gradient-to-br from-[#14B8A6] to-[#F59E0B] flex items-center justify-center text-xl">👩‍💼</div>
            <div>
              <div class="font-semibold text-white">李女士</div>
              <div class="text-sm text-slate-400">电商运营总监</div>
            </div>
          </div>
          <p class="text-slate-300">"使用话映后，我们的直播预录制效率提升了 <span class="text-[#14B8A6] font-semibold">300%</span>，内容产出更加稳定高效。"</p>
        </div>
        <div class="unified-card p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-12 h-12 rounded-full bg-gradient-to-br from-[#14B8A6] to-[#F59E0B] flex items-center justify-center text-xl">👨‍💻</div>
            <div>
              <div class="font-semibold text-white">张先生</div>
              <div class="text-sm text-slate-400">内容创作者</div>
            </div>
          </div>
          <p class="text-slate-300">"AI 文案生成太智能了！以前写脚本要半天，现在几分钟就能搞定，质量还很高。"</p>
        </div>
        <div class="unified-card p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-12 h-12 rounded-full bg-gradient-to-br from-[#F59E0B] to-[#14B8A6] flex items-center justify-center text-xl">👩‍🎨</div>
            <div>
              <div class="font-semibold text-white">王女士</div>
              <div class="text-sm text-slate-400">品牌营销负责人</div>
            </div>
          </div>
          <p class="text-slate-300">"数字人形象非常逼真，观众完全看不出是AI生成的，大大降低了制作成本。"</p>
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
