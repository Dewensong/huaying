import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// 扩展路由meta类型
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresAdmin?: boolean
    title?: string
    icon?: string
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Landing',
    component: () => import('@/modules/landing/views/LandingView.vue'),
    meta: { requiresAuth: false, title: '首页' }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/modules/auth/views/LoginView.vue'),
    meta: { requiresAuth: false, title: '登录' }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/modules/auth/views/RegisterView.vue'),
    meta: { requiresAuth: false, title: '注册' }
  },
  {
    path: '/',
    component: () => import('@/components/AppLayout.vue'),
    redirect: '/dashboard',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/modules/dashboard/views/DashboardView.vue'),
        meta: { title: '仪表盘', icon: 'House' }
      },
      {
        path: 'avatars',
        name: 'Avatars',
        component: () => import('@/modules/avatar/views/AvatarList.vue'),
        meta: { title: '形象管理', icon: 'User' }
      },
      {
        path: 'voices',
        name: 'Voices',
        component: () => import('@/modules/voice/views/VoiceList.vue'),
        meta: { title: '声音管理', icon: 'Microphone' }
      },
      {
        path: 'scripts',
        name: 'Scripts',
        component: () => import('@/modules/script/views/ScriptGenerator.vue'),
        meta: { title: 'AI 文案', icon: 'Document' }
      },
      {
        path: 'videos',
        name: 'Videos',
        component: () => import('@/modules/video/views/VideoCenter.vue'),
        meta: { title: '视频中心', icon: 'VideoCamera' }
      },
      {
        path: 'templates',
        name: 'Templates',
        component: () => import('@/modules/template/views/TemplateList.vue'),
        meta: { title: '模板管理', icon: 'Collection' }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()

  // 首页路由：已登录用户重定向到 dashboard
  if (to.path === '/' && to.name === 'Landing') {
    if (authStore.isAuthenticated) {
      return next('/dashboard')
    }
    return next()
  }

  if (to.meta.requiresAuth !== false && !authStore.isAuthenticated) {
    // 检查本地存储的 token
    const token = localStorage.getItem('token')
    if (token) {
      try {
        await authStore.fetchUserInfo()
      } catch {
        localStorage.removeItem('token')
        next('/login')
        return
      }
    } else {
      next('/login')
      return
    }
  }

  if ((to.path === '/login' || to.path === '/register') && authStore.isAuthenticated) {
    next('/dashboard')
  } else if (to.meta.requiresAdmin && authStore.userInfo?.is_admin !== 1) {
    // 管理员页面权限检查
    next('/dashboard')
  } else {
    next()
  }
})

// 全局后置守卫：每次路由变化后设置页面标题
router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  if (title) {
    document.title = `${title} - 智播坊`
  } else {
    document.title = '智播坊'
  }
})

export default router
