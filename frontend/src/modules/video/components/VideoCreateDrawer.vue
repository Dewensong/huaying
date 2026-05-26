<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { videoApi, avatarApi, voiceApi, templateApi } from '@/api'
import { ElMessage } from 'element-plus'
import ContentStep from './steps/ContentStep.vue'
import AssemblyStep from './steps/AssemblyStep.vue'

const props = defineProps<{
  visible: boolean
  prefillScripts?: { text: string }[]
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  success: []
  opened: []
}>()

const currentStep = ref(0)
const loading = ref(false)
const submitting = ref(false)

// 窗口宽度（响应式）
const windowWidth = ref(window.innerWidth)

function updateWindowWidth() {
  windowWidth.value = window.innerWidth
}

onMounted(() => {
  window.addEventListener('resize', updateWindowWidth)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateWindowWidth)
})

// 模板相关
const showTemplateDialog = ref(false)
const showSaveTemplateDialog = ref(false)
const templateList = ref<any[]>([])
const templatesLoading = ref(false)

// 模板弹窗宽度：手机端90%，PC端600px
const templateDialogWidth = computed(() => {
  return windowWidth.value < 640 ? '90%' : '600px'
})
const saveTemplateName = ref('')

const form = ref({
  title: '',
  scripts: [] as string[],
  avatarId: null as number | null,
  voiceId: null as number | null,
  voiceType: '' as string,  // 音色类型
  background: '' as '' | { type: 'color' | 'image'; value: string },
  subtitleConfig: {
    enabled: true,
    fontSize: 24,
    color: '#FFFFFF'
  }
})

const avatars = ref<any[]>([])
const voices = ref<any[]>([])

watch(() => props.visible, async (val) => {
  if (val) {
    await fetchOptions()
    // 如果有预填充的文案，填充到表单
    if (props.prefillScripts && props.prefillScripts.length > 0) {
      form.value.scripts = props.prefillScripts.map(s => s.text)
    }
    emit('opened')
  }
})

async function fetchOptions() {
  loading.value = true
  try {
    const [avatarRes, voiceRes] = await Promise.all([
      avatarApi.list(),
      voiceApi.list()
    ])
    const avatarData = avatarRes as any
    const voiceData = voiceRes as any
    avatars.value = (avatarData?.list || []).filter((a: any) => a.enabled !== false)
    voices.value = voiceData?.list || []
  } catch (error) {
    console.error('[VideoCreateDrawer] 获取选项失败', error)
  } finally {
    loading.value = false
  }
}

// ============ 模板相关功能 ============

async function openTemplateDialog() {
  showTemplateDialog.value = true
  templatesLoading.value = true
  try {
    const res = await templateApi.list()
    templateList.value = (res as any)?.list || []
  } catch (error) {
    ElMessage.error('获取模板列表失败')
  } finally {
    templatesLoading.value = false
  }
}

function applyTemplate(template: any) {
  // 应用模板配置
  if (template.avatar_id) {
    form.value.avatarId = template.avatar_id
  }
  if (template.voice_type) {
    // 查找对应的 voice
    const voice = voices.value?.find(v => v.voice_type === template.voice_type || v.id === template.voice_id)
    if (voice) {
      form.value.voiceId = voice.id
      form.value.voiceType = voice.voice_type || template.voice_type
    } else {
      // 如果没找到匹配的声音，直接设置 voiceType
      form.value.voiceId = null
      form.value.voiceType = template.voice_type
    }
  }
  // 背景：后端存的是字符串，需要包装成对象
  if (template.background) {
    const bg = template.background
    form.value.background = {
      type: bg.startsWith('#') ? 'color' : 'image',
      value: bg
    }
  }
  // 字幕配置
  if (template.subtitle_config) {
    form.value.subtitleConfig = {
      enabled: true,
      fontSize: template.subtitle_config.fontSize || 24,
      color: template.subtitle_config.fontColor || template.subtitle_config.color || '#FFFFFF'
    }
  }
  
  showTemplateDialog.value = false
  ElMessage.success('已应用模板配置')
}

function openSaveTemplateDialog() {
  // 检查是否有可保存的配置
  if (!form.value.avatarId && !form.value.voiceType) {
    ElMessage.warning('请先选择形象或声音后再保存为模板')
    return
  }
  saveTemplateName.value = ''
  showSaveTemplateDialog.value = true
}

async function saveAsTemplate() {
  if (!saveTemplateName.value.trim()) {
    ElMessage.warning('请输入模板名称')
    return
  }
  
  try {
    // 背景：如果是对象则取 value，否则直接取字符串
    const bgValue = typeof form.value.background === 'object' && form.value.background !== null
      ? form.value.background.value
      : (form.value.background || '')
    await templateApi.create({
      name: saveTemplateName.value.trim(),
      avatar_id: form.value.avatarId,
      voice_type: form.value.voiceType,
      background: bgValue,
      subtitle_config: form.value.subtitleConfig?.enabled ? {
        fontSize: form.value.subtitleConfig.fontSize,
        fontColor: form.value.subtitleConfig.color
      } : undefined
    })
    ElMessage.success('模板保存成功')
    showSaveTemplateDialog.value = false
  } catch (error) {
    ElMessage.error('保存模板失败')
  }
}

// ============ 原有功能 ============

function handleNext() {
  if (currentStep.value === 0) {
    if (!form.value.scripts.length) {
      ElMessage.warning('请至少添加一条文案')
      return
    }
  } else if (currentStep.value === 1) {
    if (!form.value.avatarId) {
      ElMessage.warning('请选择数字人形象')
      return
    }
    if (!form.value.voiceId) {
      ElMessage.warning('请选择配音声音')
      return
    }
  }

  if (currentStep.value < 2) {
    currentStep.value++
  } else {
    handleSubmit()
  }
}

function handleBack() {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

function handleClose() {
  currentStep.value = 0
  form.value = {
    title: '',
    scripts: [],
    avatarId: null,
    voiceId: null,
    voiceType: '',
    background: '',
    subtitleConfig: { enabled: true, fontSize: 24, color: '#FFFFFF' }
  }
  emit('update:visible', false)
}

async function handleSubmit() {
  if (!form.value.avatarId) {
    ElMessage.warning('请选择数字人形象')
    return
  }

  submitting.value = true
  try {
    // 使用新的流水线 API 创建视频，传递所有配置项
    const results = []
    const videoIds: number[] = []
    
    for (let i = 0; i < form.value.scripts.length; i++) {
      const script = form.value.scripts[i]
      const result = await videoApi.createPipeline({
        avatarId: form.value.avatarId,
        script,
        title: form.value.title || undefined,
        voiceId: form.value.voiceId || undefined,
        voiceType: form.value.voiceType || undefined,
        // 背景配置
        background: form.value.background || undefined,
        // 字幕配置
        subtitleConfig: form.value.subtitleConfig?.enabled ? {
          fontSize: form.value.subtitleConfig.fontSize || 24,
          fontColor: form.value.subtitleConfig.color || '#FFFFFF'
        } : undefined
      })
      results.push(result)
      
      // 保存视频 ID 用于 WebSocket 订阅
      if ((result as any)?.videoId) {
        videoIds.push((result as any).videoId)
      }
      
      // 每条文案间隔 200ms 提交，避免并发过高
      if (i < form.value.scripts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    ElMessage.success(`已提交 ${results.length} 个视频生成任务`)

    emit('success')
    handleClose()
  } catch (error: any) {
    console.error('创建失败:', error)
    ElMessage.error(error?.response?.data?.message || '创建失败')
  } finally {
    submitting.value = false
  }
}

const steps = ['选择内容', '组装配置', '确认创建']
</script>

<template>
  <el-drawer
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    title="创建视频任务"
    size="100%"
    direction="rtl"
    :before-close="handleClose"
    append-to-body
    class="video-create-drawer"
  >
    <div class="h-full flex flex-col">
      <!-- 步骤指示器 -->
      <div class="px-8 py-4 border-b border-white/10">
        <el-steps :active="currentStep" finish-status="success" align-center>
          <el-step
            v-for="(step, index) in steps"
            :key="index"
            :title="step"
          />
        </el-steps>
      </div>

      <!-- 内容区 -->
      <div class="flex-1 overflow-y-auto p-8">
        <ContentStep
          v-if="currentStep === 0"
          v-model:scripts="form.scripts"
          v-model:title="form.title"
          :loading="loading"
        />

        <AssemblyStep
          v-else-if="currentStep === 1"
          v-model:avatarId="form.avatarId"
          v-model:voiceId="form.voiceId"
          v-model:voiceType="form.voiceType"
          v-model:background="form.background"
          v-model:subtitleConfig="form.subtitleConfig"
          :avatars="avatars"
          :voices="voices"
          :loading="loading"
        />

        <div v-else-if="currentStep === 2" class="max-w-2xl mx-auto">
          <h3 class="text-lg font-semibold text-white mb-6">确认创建</h3>

          <div class="glass-card p-6 space-y-4">
            <div class="flex justify-between">
              <span class="text-slate-400">视频标题</span>
              <span class="text-white">{{ form.title || '未设置' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">文案数量</span>
              <span class="text-white">{{ form.scripts.length }} 条</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">生成数量</span>
              <span class="text-primary-400">{{ form.scripts.length }} 条</span>
            </div>
          </div>

          <p class="text-sm text-slate-400 mt-4 text-center">
            点击「确认创建」后将开始生成视频，可在视频中心查看进度
          </p>
        </div>
      </div>

      <!-- 底部按钮 -->
      <div class="px-8 py-4 border-t border-white/10 flex justify-between items-center">
        <!-- 上一步按钮：type="default"，透明背景 + 灰色边框 -->
        <el-button 
          v-if="currentStep > 0" 
          @click="handleBack"
          type="default"
          class="!border-slate-600 !text-slate-400 hover:!border-slate-500 hover:!text-slate-300 !bg-transparent"
        >
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          上一步
        </el-button>
        <div v-else>
          <!-- 第一步显示"使用模板"按钮 -->
          <el-button
            @click="openTemplateDialog"
            type="default"
            class="!border-slate-600 !text-slate-400 hover:!border-slate-500 hover:!text-slate-300 !bg-transparent"
          >
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            使用模板
          </el-button>
        </div>

        <div class="flex gap-3">
          <!-- 取消按钮：type="text"，灰色文字无边框 -->
          <el-button 
            @click="handleClose"
            type="text"
            class="!text-slate-400 hover:!text-slate-200 !bg-transparent"
          >
            取消
          </el-button>
          
          <!-- 保存为模板按钮（仅在组装配置步骤显示） -->
          <el-button
            v-if="currentStep === 1"
            @click="openSaveTemplateDialog"
            type="default"
            class="!border-green-600 !text-green-400 hover:!border-green-500 hover:!text-green-300 !bg-transparent"
          >
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            保存为模板
          </el-button>
          
          <!-- 下一步/确认创建按钮：type="primary"，使用项目统一的蓝紫渐变样式 -->
          <el-button
            v-if="currentStep < 2"
            @click="handleNext"
            type="primary"
            class="!rounded-lg !font-medium"
          >
            下一步
            <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </el-button>
          
          <el-button
            v-else
            @click="handleSubmit"
            :disabled="submitting"
            type="primary"
            :loading="submitting"
            class="!rounded-lg !font-medium"
          >
            <span v-if="!submitting" class="inline-flex items-center">
              确认创建 ({{ form.scripts.length }})
              <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <span v-else>创建中...</span>
          </el-button>
        </div>
      </div>
    </div>

    <!-- 使用模板弹窗 -->
    <el-dialog
      v-model="showTemplateDialog"
      title="选择模板"
      :width="templateDialogWidth"
      append-to-body
    >
      <div v-if="templatesLoading" class="text-center py-8">
        <el-icon class="is-loading text-2xl text-primary-400">
          <Loading />
        </el-icon>
      </div>
      <div v-else-if="templateList.length === 0" class="text-center py-8 text-slate-400">
        暂无模板，请在视频创建过程中保存配置为模板
      </div>
      <div v-else class="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
        <div
          v-for="template in templateList"
          :key="template.id"
          @click="applyTemplate(template)"
          class="glass-card p-3 cursor-pointer hover:border-primary-500/50 transition-all"
        >
          <div
            class="aspect-[4/3] rounded mb-2 flex items-center justify-center overflow-hidden"
            :style="{ background: template.background || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }"
          >
            <img
              v-if="template.avatar_image"
              :src="template.avatar_image"
              class="h-full w-full object-cover object-top"
              alt="形象封面"
            />
            <svg v-else class="w-6 h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          </div>
          <h4 class="text-sm font-medium text-white truncate">{{ template.name }}</h4>
          <p class="text-xs text-slate-400 truncate">{{ template.avatar_name || '未选择形象' }}</p>
          <p class="text-xs text-slate-500 truncate">
            {{ template.voice_type?.startsWith('S_') ? '克隆音色' : (template.voice_type || '未选择声音') }}
          </p>
        </div>
      </div>
    </el-dialog>

    <!-- 保存为模板弹窗 -->
    <el-dialog
      v-model="showSaveTemplateDialog"
      title="保存为模板"
      width="400px"
      append-to-body
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm text-slate-400 mb-2">模板名称</label>
          <el-input
            v-model="saveTemplateName"
            placeholder="请输入模板名称"
            @keyup.enter="saveAsTemplate"
          />
        </div>
        <div class="text-sm text-slate-500">
          <p>将保存以下配置：</p>
          <ul class="list-disc list-inside mt-2 space-y-1">
            <li v-if="form.avatarId">形象：已选择</li>
            <li v-if="form.voiceType">声音：{{ form.voiceType.startsWith('S_') ? '克隆音色' : form.voiceType }}</li>
            <li v-if="form.background">背景：已设置</li>
            <li v-if="form.subtitleConfig?.enabled">字幕：已启用</li>
          </ul>
        </div>
      </div>
      <template #footer>
        <el-button @click="showSaveTemplateDialog = false">取消</el-button>
        <el-button type="primary" @click="saveAsTemplate">保存</el-button>
      </template>
    </el-dialog>
  </el-drawer>
</template>

<style scoped>
::deep(.video-create-drawer .el-drawer__body) {
  padding: 0;
}
</style>
