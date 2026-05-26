<script setup lang="ts">
import { Check, ArrowRight } from '@element-plus/icons-vue'
import { ShoppingCart, LocationInformation, Microphone } from '@element-plus/icons-vue'

const solutions = [
  {
    id: 'ecommerce',
    label: '电商直播带货',
    icon: ShoppingCart,
    desc: '一张产品图，批量生成AI数字人带货视频',
    benefits: ['产品图生3D数字人', 'AI卖点文案生成', '批量视频生产', '多平台一键分发']
  },
  {
    id: 'local',
    label: '本地生活推广',
    icon: LocationInformation,
    desc: '餐饮、商超、景区...一张门头照生成全套推广素材',
    benefits: ['门头/菜单识别', '批量AI推广视频', '本地平台适配', '区域精准投放']
  },
  {
    id: 'creator',
    label: '知识口播博主',
    icon: Microphone,
    desc: '真人/数字人分身，文案一键转专业口播视频',
    benefits: ['数字人分身克隆', '多风格音色选择', '一键字幕生成', '多平台一键分发']
  }
]
</script>

<template>
  <section id="solutions" class="py-24">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-16 scroll-animate">
        <span class="inline-block px-4 py-1.5 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-full text-sm mb-6">解决方案</span>
        <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">行业场景解决方案</h2>
        <p class="text-slate-400 max-w-2xl mx-auto">针对不同行业痛点，提供专属数字人视频解决方案</p>
      </div>

      <!-- 行业解决方案卡片 -->
      <div class="grid md:grid-cols-3 gap-6 scroll-animate">
        <div 
          v-for="sol in solutions"
          :key="sol.id"
          class="solution-card group relative unified-card p-6 cursor-pointer"
        >
          <!-- 半透明背景装饰图标 -->
          <div class="absolute -bottom-6 -right-6 text-[140px] opacity-[0.04] select-none pointer-events-none font-bold">
            {{ sol.id === 'ecommerce' ? '🛒' : sol.id === 'local' ? '📍' : '🎙️' }}
          </div>
          
          <!-- 卡片头部 -->
          <div class="flex items-center gap-3 mb-5">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3B82F6]/20 to-[#8B5CF6]/20 flex items-center justify-center border border-[#3B82F6]/30">
              <el-icon class="text-xl text-[#3B82F6]"><component :is="sol.icon" /></el-icon>
            </div>
            <h3 class="text-lg font-semibold text-white">{{ sol.label }}</h3>
          </div>
          
          <!-- 描述 -->
          <p class="text-slate-400 text-sm mb-5">{{ sol.desc }}</p>
          
          <!-- 卖点列表 -->
          <ul class="space-y-2.5 mb-6">
            <li v-for="benefit in sol.benefits" :key="benefit" class="flex items-center gap-2.5 text-slate-300 text-sm">
              <span class="w-5 h-5 rounded-full bg-[#3B82F6]/20 flex items-center justify-center flex-shrink-0">
                <Check class="w-3 h-3" style="color: #3B82F6" />
              </span>
              {{ benefit }}
            </li>
          </ul>
          
          <div class="flex items-center justify-end">
            <el-button text type="primary" class="text-[#06B6D4]">
              查看详情
              <el-icon class="ml-1"><ArrowRight /></el-icon>
            </el-button>
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

/* 解决方案卡片 */
.solution-card {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.3s ease;
}

.solution-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(59, 130, 246, 0.5);
  box-shadow: 0 8px 32px rgba(59, 130, 246, 0.2), 0 0 0 1px rgba(59, 130, 246, 0.15);
  transform: translateY(-4px);
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
