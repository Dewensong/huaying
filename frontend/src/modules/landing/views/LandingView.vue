<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { ArrowUp } from '@element-plus/icons-vue'

// 导入所有组件
import LandingNav from '@/modules/landing/components/LandingNav.vue'
import HeroSection from '@/modules/landing/components/HeroSection.vue'
import StatsBar from '@/modules/landing/components/StatsBar.vue'
import CoreTech from '@/modules/landing/components/CoreTech.vue'
import CoreFeatures from '@/modules/landing/components/CoreFeatures.vue'
// import TechEcosystem from '@/modules/landing/components/TechEcosystem.vue'
import Solutions from '@/modules/landing/components/Solutions.vue'
// import CustomerCases from '@/modules/landing/components/CustomerCases.vue'
import InteractiveDemo from '@/modules/landing/components/InteractiveDemo.vue'
import HowItWorks from '@/modules/landing/components/HowItWorks.vue'
import FAQ from '@/modules/landing/components/FAQ.vue'
import BottomCTA from '@/modules/landing/components/BottomCTA.vue'
import LandingFooter from '@/modules/landing/components/LandingFooter.vue'

const showBackToTop = ref(false)

function handleScroll() {
  showBackToTop.value = window.scrollY > 600
}

function backToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// 滚动动画观察器
let observer: IntersectionObserver | null = null

onMounted(() => {
  document.documentElement.style.scrollBehavior = 'smooth'
  window.addEventListener('scroll', handleScroll)
  
  // 初始化滚动动画观察器
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
        }
      })
    },
    { threshold: 0.1 }
  )
  
  document.querySelectorAll('.scroll-animate').forEach((el) => {
    observer?.observe(el)
  })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  observer?.disconnect()
})
</script>

<template>
  <div class="landing-page">
    <!-- 全局网格背景 -->
    <div class="global-grid"></div>
    
    <!-- 导航栏 -->
    <LandingNav />
    
    <!-- 英雄区 -->
    <HeroSection />
    
    <!-- 数据背书条 -->
    <StatsBar />
    
    <!-- 核心技术 -->
    <CoreTech />
    
    <!-- 核心功能 -->
    <CoreFeatures />
    
    <!-- 技术生态合作伙伴 -->
    <!-- <TechEcosystem /> -->
    
    <!-- 行业解决方案 -->
    <Solutions />
    
    <!-- 客户案例 -->
    <!-- <CustomerCases /> -->
    
    <!-- 3D数字人演示区 -->
    <InteractiveDemo />
    
    <!-- 三步创建流程 -->
    <HowItWorks />
    <!-- 常见问题 -->
    <FAQ />
    
    <!-- 底部CTA -->
    <BottomCTA />
    
    <!-- 页脚 -->
    <LandingFooter />
    
    <!-- 返回顶部 -->
    <transition name="fade">
      <el-button
        v-show="showBackToTop"
        @click="backToTop"
        circle
        type="primary"
        class="fixed bottom-8 right-8 z-50 !w-12 !h-12 !rounded-full !p-0"
      >
        <el-icon :size="28"><ArrowUp /></el-icon>
      </el-button>
    </transition>
  </div>
</template>

<style scoped>
/* 全局页面背景 */
.landing-page {
  min-height: 100vh;
  background: #0F172A;
}

/* 全局网格背景 */
.global-grid {
  position: fixed;
  inset: 0;
  background-image: 
    radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.03) 1px, transparent 0);
  background-size: 40px 40px;
  pointer-events: none;
  z-index: 0;
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
