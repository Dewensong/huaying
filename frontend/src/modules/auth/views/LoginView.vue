<script setup lang="ts">
import { ref, reactive, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores'
import { ElMessage } from 'element-plus'
import { authApi } from '@/api'

const router = useRouter()
const authStore = useAuthStore()

const loginForm = reactive({
  loginType: 'email' as 'email' | 'phone',
  email: '',
  phone: '',
  password: '',
  code: '',
  remember: false
})

const countdown = ref(0)
const loading = ref(false)
const sendingCode = ref(false)
let countdownTimer: ReturnType<typeof setInterval> | null = null

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }
})

async function handleSendCode() {
  if (!loginForm.phone || loginForm.phone.length !== 11) {
    ElMessage.warning('请输入正确的手机号')
    return
  }

  sendingCode.value = true
  try {
    await authApi.sendCode(loginForm.phone)
    ElMessage.success('验证码已发送')

    // 开始倒计时
    countdown.value = 60
    countdownTimer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        clearInterval(countdownTimer!)
        countdownTimer = null
      }
    }, 1000)
  } catch (error: any) {
    ElMessage.error(error.message || '发送失败')
  } finally {
    sendingCode.value = false
  }
}

async function handleLogin() {
  loading.value = true

  try {
    if (loginForm.loginType === 'email') {
      if (!loginForm.email || !loginForm.password) {
        ElMessage.warning('请输入邮箱和密码')
        return
      }
      await authStore.login({
        email: loginForm.email,
        password: loginForm.password
      })
    } else {
      if (!loginForm.phone || !loginForm.code) {
        ElMessage.warning('请输入手机号和验证码')
        return
      }
      await authStore.login({
        phone: loginForm.phone,
        code: loginForm.code
      })
    }

    ElMessage.success('登录成功')
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

    <!-- 登录卡片 -->
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
          <p class="text-slate-400 mt-2">AI 口播视频自动生成平台</p>
        </router-link>
      </div>

      <div class="glass-card p-8">
        <!-- 登录方式切换 -->
        <div class="flex rounded-lg bg-slate-800 p-1 mb-6">
          <el-button
            @click="loginForm.loginType = 'email'"
            :type="loginForm.loginType === 'email' ? 'primary' : 'default'"
            class="flex-1"
          >
            邮箱登录
          </el-button>
          <el-button
            @click="loginForm.loginType = 'phone'"
            :type="loginForm.loginType === 'phone' ? 'primary' : 'default'"
            class="flex-1"
          >
            验证码登录
          </el-button>
        </div>

        <!-- 邮箱登录表单 -->
        <el-form v-if="loginForm.loginType === 'email'" class="space-y-4">
          <el-form-item>
            <el-input
              v-model="loginForm.email"
              placeholder="请输入邮箱"
              size="large"
              prefix-icon="Message"
            />
          </el-form-item>
          <el-form-item>
            <el-input
              v-model="loginForm.password"
              type="password"
              placeholder="请输入密码"
              size="large"
              prefix-icon="Lock"
              show-password
            />
          </el-form-item>
        </el-form>

        <!-- 手机登录表单 -->
        <div v-else class="space-y-4">
          <el-input
            v-model="loginForm.phone"
            placeholder="请输入手机号"
            size="large"
            prefix-icon="Phone"
          />
          <div class="flex gap-2">
            <el-input
              v-model="loginForm.code"
              placeholder="请输入验证码"
              size="large"
              prefix-icon="Key"
              class="flex-1"
            />
            <el-button
              @click="handleSendCode"
              :disabled="countdown > 0"
              :loading="sendingCode"
              class="whitespace-nowrap"
              size="large"
            >
              {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
            </el-button>
          </div>
        </div>

        <!-- 登录按钮 -->
        <el-button
          type="primary"
          size="large"
          :loading="loading"
          @click="handleLogin"
          class="w-full mt-6"
        >
          {{ loading ? '登录中...' : '登录' }}
        </el-button>

        <!-- 注册链接 -->
        <p class="text-center text-sm text-slate-400 mt-6">
          还没有账号？
          <router-link to="/register" class="text-primary-400 hover:text-primary-300 font-medium">
            立即注册
          </router-link>
        </p>
      </div>
    </div>
  </div>
</template>
