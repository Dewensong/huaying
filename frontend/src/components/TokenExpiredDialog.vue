<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const visible = ref(false)
const router = useRouter()
const authStore = useAuthStore()

function handleReLogin() {
  visible.value = false
  authStore.logout()
  router.push('/login')
}

// 暴露给外部调用的方法
defineExpose({
  show() {
    visible.value = true
  }
})
</script>

<template>
  <el-dialog
    v-model="visible"
    title="登录已过期"
    width="400px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    class="token-expired-dialog"
  >
    <div class="flex flex-col items-center py-4">
      <div class="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mb-4">
        <svg class="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p class="text-slate-300 text-center">您的登录状态已过期</p>
      <p class="text-slate-400 text-sm text-center">请重新登录以继续使用</p>
    </div>
    <template #footer>
      <el-button type="primary" class="w-full" @click="handleReLogin">
        重新登录
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.token-expired-dialog :deep(.el-dialog) {
  background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}

.token-expired-dialog :deep(.el-dialog__header) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.token-expired-dialog :deep(.el-dialog__title) {
  color: #fff;
  font-weight: 600;
}

.token-expired-dialog :deep(.el-dialog__body) {
  padding: 20px 24px;
}

.token-expired-dialog :deep(.el-dialog__footer) {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 16px 24px;
}
</style>
