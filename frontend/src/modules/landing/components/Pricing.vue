<script setup lang="ts">
import { Check, ArrowRight } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const plans = [
  {
    name: 'free',
    label: '免费版',
    price: 0,
    credits: '5',
    features: ['3 个形象', '3 个声音', '基础模板', '720P 导出'],
    highlighted: false
  },
  {
    name: 'creator',
    label: '创作者',
    price: 99,
    credits: '30',
    features: ['10 个形象', '10 个声音', '高级模板', '1080P 导出', '优先队列'],
    highlighted: true
  },
  {
    name: 'studio',
    label: '工作室',
    price: 299,
    credits: '200',
    features: ['无限形象', '无限声音', '全部模板', '1080P 导出', '声音克隆', '批量生成', '优先队列'],
    highlighted: false
  },
  {
    name: 'enterprise',
    label: '企业版',
    price: 999,
    credits: '无限',
    features: ['无限形象', '无限声音', '全部模板', '1080P 导出', '声音克隆', '批量生成', 'API 接入', '专属客服'],
    highlighted: false
  }
]

function goToRegister(plan?: string) {
  if (plan) {
    router.push(`/register?plan=${plan}`)
  } else {
    router.push('/register')
  }
}
</script>

<template>
  <section id="pricing" class="py-24">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-16 scroll-animate">
        <span class="inline-block px-4 py-1.5 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-full text-sm mb-6">定价方案</span>
        <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">选择适合您的套餐</h2>
        <p class="text-slate-400">灵活定价，永久免费体验</p>
      </div>
      
      <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
        <div
          v-for="plan in plans"
          :key="plan.name"
          :class="[
            'unified-card p-6 flex flex-col scroll-animate relative',
            plan.highlighted ? 'ring-2 ring-[#3B82F6]/50' : ''
          ]"
        >
          <div v-if="plan.highlighted" class="absolute -top-3 left-1/2 -translate-x-1/2">
            <span class="px-4 py-1 bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white text-sm rounded-full font-medium shadow-lg shadow-primary-500/30">
              推荐
            </span>
          </div>
          <h3 class="text-xl font-semibold text-white mb-3 mt-2">{{ plan.label }}</h3>
          <div class="mb-4">
            <span class="text-4xl font-bold bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] bg-clip-text text-transparent">
              {{ plan.price === 0 ? '免费' : plan.price === 999 ? '企业定制' : '¥' + plan.price }}
            </span>
            <span class="text-slate-400" v-if="plan.price > 0 && plan.price < 999">/月</span>
          </div>
          <div class="text-sm text-slate-400 mb-5">
            {{ plan.credits === '无限' ? '不限量使用' : '每月 ' + plan.credits + ' 条视频' }}
          </div>
          <ul class="space-y-3 mb-6 flex-1">
            <li v-for="feature in plan.features" :key="feature" class="flex items-center gap-2 text-slate-300">
              <el-icon class="text-emerald-400"><Check /></el-icon>
              {{ feature }}
            </li>
          </ul>
          <el-button
            :type="plan.highlighted ? 'primary' : 'default'"
            @click="plan.price === 999 ? null : goToRegister(plan.name)"
            :class="[
              'w-full',
              !plan.highlighted && '!bg-white/5 !border-white/10 !text-white hover:!bg-white/10'
            ]"
          >
            {{ plan.price === 0 ? '免费试用' : plan.price === 999 ? '咨询定制' : '立即开通' }}
            <el-icon v-if="plan.price !== 999"><ArrowRight /></el-icon>
          </el-button>
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
