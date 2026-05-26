<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores'
import {
  House,
  User,
  Microphone,
  Document,
  VideoCamera,
  Collection,
  Fold,
  Expand,
  SwitchButton,
  Menu
} from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const isMobile = ref(window.innerWidth < 768)
const sidebarCollapsed = ref(false)
const drawerVisible = ref(false)

const activeMenu = computed(() => route.path)

const menuItems = computed(() => {
  const items = [
    { path: '/dashboard', label: '仪表盘', icon: House },
    { path: '/avatars', label: '形象管理', icon: User },
    { path: '/voices', label: '声音管理', icon: Microphone },
    { path: '/scripts', label: 'AI 文案', icon: Document },
    { path: '/videos', label: '视频中心', icon: VideoCamera },
    { path: '/templates', label: '模板管理', icon: Collection }
  ]
  return items
})

function handleResize() {
  isMobile.value = window.innerWidth < 768
  if (isMobile.value) {
    sidebarCollapsed.value = true
  }
}

function handleLogout() {
  ElMessageBox.confirm('确定要退出登录吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    authStore.logout()
    router.push('/login')
  }).catch(() => {})
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  handleResize()
})
</script>

<template>
  <div class="flex min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
    <!-- 桌面端侧边栏 -->
    <aside
      v-if="!isMobile"
      :class="[
        'fixed left-0 top-0 h-full glass-card transition-all duration-300 z-30 flex flex-col',
        sidebarCollapsed ? 'w-16' : 'w-64'
      ]"
    >
      <!-- Logo 区域 -->
      <div class="h-16 flex items-center px-4 border-b border-white/10">
        <div class="flex items-center gap-3 overflow-hidden">
          <div class="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
            <VideoCamera class="w-5 h-5 text-white" />
          </div>
          <span v-if="!sidebarCollapsed" class="text-lg font-bold gradient-text whitespace-nowrap">
            话映
          </span>
        </div>
      </div>

      <!-- 导航菜单 -->
      <nav class="flex-1 py-4 overflow-y-auto">
        <RouterLink
          v-for="item in menuItems"
          :key="item.path"
          :to="item.path"
          :class="[
            'flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg transition-all duration-200',
            activeMenu === item.path
              ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          ]"
        >
          <component :is="item.icon" class="w-5 h-5 flex-shrink-0" />
          <span v-if="!sidebarCollapsed" class="text-sm font-medium whitespace-nowrap">
            {{ item.label }}
          </span>
        </RouterLink>
      </nav>

      <!-- 用户信息 & 折叠按钮 -->
      <div class="p-4 border-t border-white/10">
        <div v-if="!sidebarCollapsed && authStore.userInfo" class="flex items-center gap-3 mb-3">
          <div class="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-white text-sm font-medium">
            {{ authStore.userInfo?.name?.charAt(0) || 'U' }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-white truncate">{{ authStore.userInfo?.name }}</p>
            <p class="text-xs text-slate-400 truncate">{{ authStore.userInfo?.email }}</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <el-button
            @click="handleLogout"
            :icon="SwitchButton"
            class="flex-1"
            text
          >
            <span v-if="!sidebarCollapsed">退出</span>
          </el-button>
          <el-button
            @click="sidebarCollapsed = !sidebarCollapsed"
            :icon="sidebarCollapsed ? Expand : Fold"
            text
          />
        </div>
      </div>
    </aside>

    <!-- 移动端顶部导航 -->
    <header v-if="isMobile" class="fixed top-0 left-0 right-0 h-14 glass-card z-30 flex items-center justify-between px-4">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-gradient-primary flex items-center justify-center">
          <VideoCamera class="w-4 h-4 text-white" />
        </div>
        <span class="text-lg font-bold gradient-text">话映</span>
      </div>

      <el-button
        @click="drawerVisible = true"
        :icon="Menu"
        text
      />
    </header>

    <!-- 移动端抽屉菜单 -->
    <el-drawer
      v-model="drawerVisible"
      direction="rtl"
      size="280px"
      :show-close="false"
      append-to-body
      class="mobile-menu-drawer"
    >
      <template #header>
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-white text-lg font-medium">
            {{ authStore.userInfo?.name?.charAt(0) || 'U' }}
          </div>
          <div>
            <p class="font-medium text-white">{{ authStore.userInfo?.name || '未登录' }}</p>
            <p class="text-xs text-slate-400">{{ authStore.userInfo?.email || '' }}</p>
          </div>
        </div>
      </template>

      <nav class="space-y-1">
        <RouterLink
          v-for="item in menuItems"
          :key="item.path"
          :to="item.path"
          @click="drawerVisible = false"
          :class="[
            'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
            activeMenu === item.path
              ? 'bg-primary-500/20 text-primary-400'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          ]"
        >
          <component :is="item.icon" class="w-5 h-5" />
          <span class="font-medium">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <template #footer>
        <el-button
          @click="handleLogout"
          type="danger"
          class="w-full"
        >
          <el-icon class="mr-1"><SwitchButton /></el-icon>
          退出登录
        </el-button>
      </template>
    </el-drawer>

    <!-- 主内容区 -->
    <main
      :class="[
        'flex-1 min-h-screen transition-all duration-300',
        isMobile ? 'pt-14' : (sidebarCollapsed ? 'ml-16' : 'ml-64')
      ]"
    >
      <div class="p-4 md:p-6 lg:p-8 main">
        <RouterView v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </RouterView>
      </div>
    </main>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

:deep(.mobile-menu-drawer) {
  background: #1E293B !important;
}

:deep(.el-drawer__body) {
  padding: 0 !important;
}
@media screen and (max-width: 768px) {
  .main{
    width: 100vw;
  }
}
</style>
