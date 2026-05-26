<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores'
import { ElMessage } from 'element-plus'

const router = useRouter()
const authStore = useAuthStore()

const registerForm = reactive({
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  agreeTerms: false
})

const loading = ref(false)

async function handleRegister() {
  if (!registerForm.agreeTerms) {
    ElMessage.warning('请同意用户协议')
    return
  }

  if (registerForm.password !== registerForm.confirmPassword) {
    ElMessage.warning('两次输入的密码不一致')
    return
  }

  if (registerForm.password.length < 6) {
    ElMessage.warning('密码长度不能少于6位')
    return
  }

  loading.value = true

  try {
    await authStore.register({
      name: registerForm.name,
      email: registerForm.email,
      password: registerForm.password
    })

    ElMessage.success('注册成功')
    router.push('/dashboard')
  } catch (error) {
    // 错误已在拦截器处理
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
    <!-- 背景装饰 -->
    <div class="fixed inset-0 overflow-hidden pointer-events-none">
      <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl animate-pulse" />
      <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-500/20 rounded-full blur-3xl animate-pulse" style="animation-delay: 1s;" />
    </div>

    <!-- 注册卡片 -->
    <div class="w-full max-w-md relative animate-fade-in">
      <!-- Logo -->
      <div class="text-center mb-8">
        <router-link to="/" class="inline-block">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-primary mb-4 shadow-glow">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 class="text-3xl font-bold gradient-text">话映</h1>
          <p class="text-slate-400 mt-2">数字人生产工厂</p>
        </router-link>
      </div>

      <div class="glass-card p-8">
        <h2 class="text-xl font-semibold text-white mb-6">创建账号</h2>

        <el-form class="space-y-4">
          <el-form-item>
            <el-input
              v-model="registerForm.name"
              placeholder="请输入昵称"
              size="large"
              prefix-icon="User"
            />
          </el-form-item>

          <el-form-item>
            <el-input
              v-model="registerForm.email"
              type="email"
              placeholder="请输入邮箱"
              size="large"
              prefix-icon="Message"
            />
          </el-form-item>

          <el-form-item>
            <el-input
              v-model="registerForm.password"
              type="password"
              placeholder="请输入密码（至少6位）"
              size="large"
              prefix-icon="Lock"
              show-password
            />
          </el-form-item>

          <el-form-item>
            <el-input
              v-model="registerForm.confirmPassword"
              type="password"
              placeholder="请确认密码"
              size="large"
              prefix-icon="Lock"
              show-password
            />
          </el-form-item>
        </el-form>

        <!-- 用户协议 -->
        <div class="flex items-start gap-2 mt-4">
          <input
            type="checkbox"
            v-model="registerForm.agreeTerms"
            id="terms"
            class="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-primary-500 focus:ring-primary-500"
          />
          <label for="terms" class="text-sm text-slate-400">
            我已阅读并同意
            <a href="#" class="text-primary-400 hover:text-primary-300">《用户协议》</a>
            和
            <a href="#" class="text-primary-400 hover:text-primary-300">《隐私政策》</a>
          </label>
        </div>

        <!-- 注册按钮 -->
        <el-button
          type="primary"
          size="large"
          :loading="loading"
          @click="handleRegister"
          class="w-full mt-6"
        >
          {{ loading ? '注册中...' : '注册' }}
        </el-button>

        <!-- 登录链接 -->
        <p class="text-center text-sm text-slate-400 mt-6">
          已有账号？
          <router-link to="/login" class="text-primary-400 hover:text-primary-300 font-medium">
            立即登录
          </router-link>
        </p>
      </div>
    </div>
  </div>
</template>
