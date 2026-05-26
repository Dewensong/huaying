<script setup lang="ts">
import { ref, onMounted } from 'vue'

const stats = [
  { value: 10000, suffix: '+', label: '服务商家', display: '0' },
  { value: 500000, suffix: '+', label: '生成视频', display: '0' },
  { value: 30, suffix: '+', label: '覆盖行业', display: '0' },
  { value: '7×24h', suffix: '', label: '自动化生产', display: '7×24h' }
]

const statsAnimated = ref(false)
let statsObserver: IntersectionObserver | null = null

function animateNumber(target: number, suffix: string): string {
  if (target >= 10000) {
    return (target / 10000).toFixed(1) + '万' + suffix
  }
  return target.toLocaleString() + suffix
}

function animateStats() {
  stats.forEach((stat, index) => {
    if (stat.suffix === '') return
    let current = 0
    const target = stat.value as number
    const duration = 2000
    const step = target / (duration / 16)
    
    const timer = setInterval(() => {
      current += step
      if (current >= target) {
        current = target
        clearInterval(timer)
      }
      stats[index].display = animateNumber(Math.floor(current), stat.suffix)
    }, 16)
  })
}

onMounted(() => {
  statsObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !statsAnimated.value) {
          statsAnimated.value = true
          animateStats()
        }
      })
    },
    { threshold: 0.3 }
  )
  
  const statsSection = document.querySelector('.stats-section')
  if (statsSection) {
    statsObserver.observe(statsSection)
  }
})
</script>

<template>
  <section class="stats-section py-16 relative">
    <div class="absolute inset-0 bg-gradient-to-r from-[#3B82F6]/5 via-transparent to-[#8B5CF6]/5"></div>
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-8">
        <div v-for="stat in stats" :key="stat.label" class="text-center scroll-animate">
          <div class="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] bg-clip-text text-transparent mb-2">{{ stat.display }}</div>
          <div class="text-sm text-slate-400">{{ stat.label }}</div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
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
