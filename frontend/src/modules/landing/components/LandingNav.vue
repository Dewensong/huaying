<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const navItems = [
  { label: '产品', id: 'features' },
  { label: '解决方案', id: 'solutions' }
]

function scrollTo(id: string) {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' })
  }
}

function goToRegister() {
  router.push('/register')
}
</script>

<template>
  <nav class="fixed top-0 left-0 right-0 z-50 bg-[#0F172A]/80 backdrop-blur-xl border-b border-white/5">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Logo -->
        <router-link to="/" class="flex items-center gap-2">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-[#14B8A6] to-[#F59E0B] flex items-center justify-center shadow-lg shadow-primary-500/30">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <span class="text-xl font-bold bg-gradient-to-r from-[#14B8A6] to-[#F59E0B] bg-clip-text text-transparent">话映</span>
        </router-link>

        <div class="hidden lg:flex items-center gap-1">
          <el-button 
            v-for="item in navItems" 
            :key="item.id"
            @click="scrollTo(item.id)" 
            text
          >
            {{ item.label }}
          </el-button>
        </div>

        <!-- 操作按钮 -->
        <div class="flex items-center gap-3">
          <router-link to="/login" class="hidden sm:block text-slate-400 hover:text-white transition-colors text-sm">
            登录
          </router-link>
          <el-button type="primary" @click="goToRegister()">
            免费试用
          </el-button>
        </div>
      </div>
    </div>
  </nav>
</template>
