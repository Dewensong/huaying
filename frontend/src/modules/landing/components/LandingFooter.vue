<script setup lang="ts">
function scrollTo(id: string) {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' })
  }
}
</script>

<template>
  <footer id="footer" class="py-16 border-t border-white/5">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid md:grid-cols-3 gap-12 mb-12">
        <!-- Logo & 简介 -->
        <div>
          <router-link to="/" class="flex items-center gap-2 mb-4">
            <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-[#14B8A6] to-[#F59E0B] flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <span class="text-lg font-bold text-white">话映</span>
          </router-link>
          <p class="text-slate-400 text-sm mb-4">新一代 AI 数字人视频创作平台</p>
          <!-- 联系我们 -->
          <div class="space-y-2 text-sm">
            <p class="text-slate-400">联系我们：</p>
            <p class="text-slate-300">📱 电话/微信：15383622603</p>
          </div>
        </div>

        <!-- 核心功能 -->
        <div>
          <h4 class="text-white font-semibold mb-4">核心功能</h4>
          <ul class="space-y-3 text-sm text-slate-400">
            <li><el-link @click="scrollTo('features')">核心功能</el-link></li>
            <li><el-link @click="scrollTo('pricing')">定价方案</el-link></li>
            <li><el-link @click="scrollTo('solutions')">解决方案</el-link></li>
          </ul>
        </div>

        <div>
          <h4 class="text-white font-semibold mb-4">帮助中心</h4>
          <ul class="space-y-3 text-sm text-slate-400">
            <li><el-link @click="scrollTo('faq')">常见问题</el-link></li>
          </ul>
        </div>

      </div>

      <!-- 底部 -->
      <div class="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div class="text-slate-400 text-sm">
          © 2026 话映. 保留所有权利.
        </div>
        <div class="text-slate-500 text-xs">
          备案号：京ICP备2026016299号-1
        </div>
      </div>
    </div>
  </footer>
</template>
