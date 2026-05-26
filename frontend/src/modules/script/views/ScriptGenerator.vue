<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { scriptApi } from '@/api'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { useRouter } from 'vue-router'
import { useScriptStore } from '@/stores'

const router = useRouter()
const scriptStore = useScriptStore()
const formRef = ref<FormInstance>()
const form = reactive({
  source: '',
  count: 3,
  style: 'professional',
  duration: 60
})

const scripts = ref<string[]>([])
const loading = ref(false)
const selectedScripts = ref<Set<number>>(new Set())

const isAllSelected = computed(() => {
  return scripts.value.length > 0 && selectedScripts.value.size === scripts.value.length
})

const styleOptions = [
  { label: '专业正式', value: 'professional' },
  { label: '轻松活泼', value: 'casual' },
  { label: '简洁明了', value: 'concise' },
  { label: '情感丰富', value: 'emotional' }
]

const rules = {
  source: [{ required: true, message: '请输入产品描述', trigger: 'change' }]
}

async function handleGenerate() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    const res = await scriptApi.generate(form)
    const rawRes = res as any
    scripts.value = rawRes.data?.scripts ?? rawRes?.scripts ?? []
    selectedScripts.value.clear()
    ElMessage.success(`成功生成 ${scripts.value.length} 条文案`)
  } catch (error) {
    ElMessage.error('生成失败，请重试')
  } finally {
    loading.value = false
  }
}

function toggleScript(index: number) {
  if (selectedScripts.value.has(index)) {
    selectedScripts.value.delete(index)
  } else {
    selectedScripts.value.add(index)
  }
  selectedScripts.value = new Set(selectedScripts.value)
}

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedScripts.value.clear()
  } else {
    scripts.value.forEach((_, index) => selectedScripts.value.add(index))
  }
  selectedScripts.value = new Set(selectedScripts.value)
}

function handleExport() {
  const content = scripts.value
    .map((s, i) => selectedScripts.value.has(i) ? s : null)
    .filter(Boolean)
    .join('\n\n---\n\n')

  if (!content) {
    ElMessage.warning('请选择要导出的文案')
    return
  }

  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `文案_${Date.now()}.txt`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('导出成功')
}

function handleSendToVideo() {
  const selectedScriptsList = scripts.value
    .map((text, index) => selectedScripts.value.has(index) ? { id: String(index), text } : null)
    .filter(Boolean) as { id: string; text: string }[]

  if (selectedScriptsList.length === 0) {
    ElMessage.warning('请选择要送入视频生产的文案')
    return
  }

  scriptStore.setScripts(selectedScriptsList)
  router.push('/videos?openCreate=true')
}
</script>

<template>
  <div class="space-y-6 animate-fade-in">
    <div>
      <h1 class="text-2xl md:text-3xl font-bold text-white">AI 文案生成</h1>
      <p class="text-slate-400 mt-1">输入产品描述，让 AI 为您生成创意口播文案</p>
    </div>

    <!-- 输入表单 -->
    <div class="glass-card p-6">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="产品描述" prop="source">
          <el-input
            v-model="form.source"
            type="textarea"
            :rows="4"
            placeholder="请详细描述您的产品特点、优势、使用场景等..."
            class="bg-slate-800/50"
          />
        </el-form-item>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <el-form-item label="生成数量" class="md:col-span-1">
            <el-select v-model="form.count" class="w-full">
              <el-option :value="1" label="1 条" />
              <el-option :value="3" label="3 条" />
              <el-option :value="5" label="5 条" />
              <el-option :value="10" label="10 条" />
            </el-select>
          </el-form-item>

          <el-form-item label="文案风格" class="md:col-span-1">
            <el-select v-model="form.style" class="w-full">
              <el-option
                v-for="opt in styleOptions"
                :key="opt.value"
                :value="opt.value"
                :label="opt.label"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="预估时长" class="md:col-span-1">
            <el-select v-model="form.duration" class="w-full">
              <el-option :value="30" label="30 秒" />
              <el-option :value="60" label="60 秒" />
              <el-option :value="90" label="90 秒" />
              <el-option :value="120" label="120 秒" />
            </el-select>
          </el-form-item>
        </div>

        <div class="flex justify-end mt-4">
          <el-button
            type="primary"
            @click="handleGenerate"
            :disabled="loading"
            class="px-6 py-3 bg-gradient-primary text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
          >
            <svg v-if="loading" class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            {{ loading ? '生成中...' : '生成文案' }}
          </el-button>
        </div>
      </el-form>
    </div>

    <!-- 生成结果 -->
    <div v-if="scripts.length > 0" class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-white">生成结果</h2>
        <div class="flex items-center gap-2">
          <el-button @click="toggleSelectAll" text>
            {{ isAllSelected ? '取消全选' : '全选' }}
          </el-button>
          <el-button type="success" size="small" @click="handleExport">
            <el-icon class="mr-1"><Download /></el-icon>
            导出 TXT
          </el-button>
          <el-button type="primary" size="small" @click="handleSendToVideo">
            <el-icon class="mr-1"><VideoPlay /></el-icon>
            送入视频生产
          </el-button>
        </div>
      </div>

      <div class="space-y-3">
        <div
          v-for="(script, index) in scripts"
          :key="index"
          @click="toggleScript(index)"
          :class="[
            'glass-card p-4 cursor-pointer transition-all hover:border-primary-500/30',
            selectedScripts.has(index) && 'border-primary-500 bg-primary-500/5'
          ]"
        >
          <div class="flex items-start gap-3">
            <div
              :class="[
                'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
                selectedScripts.has(index) ? 'bg-primary-500 border-primary-500' : 'border-slate-600'
              ]"
            >
              <svg v-if="selectedScripts.has(index)" class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div class="flex-1">
              <p class="text-sm text-slate-200 leading-relaxed">{{ script }}</p>
              <p class="text-xs text-slate-500 mt-2">约 {{ Math.ceil(script.length / 5) }} 秒</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
