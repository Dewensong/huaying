<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { templateApi } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const templates = ref<any[]>([])
const loading = ref(false)
const editingId = ref<number | null>(null)
const editingName = ref('')

async function fetchTemplates() {
  loading.value = true
  try {
    const res = await templateApi.list()
    templates.value = (res as any)?.list || []
  } catch (error) {
    ElMessage.error('获取模板列表失败')
  } finally {
    loading.value = false
  }
}

function startEdit(template: any) {
  editingId.value = template.id
  editingName.value = template.name
}

async function saveEdit() {
  if (!editingId.value) return
  if (!editingName.value.trim()) {
    ElMessage.warning('模板名称不能为空')
    return
  }
  try {
    await templateApi.update(editingId.value, { name: editingName.value.trim() })
    ElMessage.success('修改成功')
    editingId.value = null
    fetchTemplates()
  } catch (error) {
    ElMessage.error('修改失败')
  }
}

function cancelEdit() {
  editingId.value = null
  editingName.value = ''
}

async function handleDelete(template: any) {
  try {
    await ElMessageBox.confirm(
      `确定要删除模板「${template.name}」吗？`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await templateApi.delete(template.id)
    ElMessage.success('删除成功')
    fetchTemplates()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getVoiceDisplay(voiceType: string) {
  if (!voiceType) return '未选择'
  // 如果是克隆音色（S_开头），显示为"克隆音色"
  if (voiceType.startsWith('S_')) return '克隆音色'
  // 系统预设音色直接返回
  return voiceType
}

onMounted(() => {
  fetchTemplates()
})
</script>

<template>
  <div class="space-y-6 animate-fade-in">
    <div>
      <h1 class="text-2xl md:text-3xl font-bold text-white">模板管理</h1>
      <p class="text-slate-400 mt-1">保存常用的配置组合，快速创建相似风格的视频</p>
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && templates.length === 0" class="glass-card p-12 text-center">
      <svg class="w-16 h-16 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
      <h3 class="text-lg font-medium text-white mb-2">暂无模板</h3>
      <p class="text-slate-400">在视频创建过程中保存配置为模板</p>
    </div>

    <!-- 模板列表 -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="template in templates"
        :key="template.id"
        class="glass-card p-4 hover:border-primary-500/30 transition-all group"
      >
        <!-- 模板预览区域 -->
        <div
          class="aspect-[4/3] rounded-lg mb-3 flex items-center justify-center overflow-hidden"
          :style="{ background: template.background || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }"
        >
          <img
            v-if="template.avatar_image"
            :src="template.avatar_image"
            class="h-full w-full object-cover object-top"
            alt="形象封面"
          />
          <svg v-else class="w-8 h-8 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
        </div>

        <!-- 模板信息 -->
        <div class="space-y-2">
          <!-- 名称（可编辑） -->
          <div v-if="editingId === template.id" class="flex items-center gap-2">
            <el-input
              v-model="editingName"
              size="small"
              @keyup.enter="saveEdit"
              @keyup.escape="cancelEdit"
              class="flex-1"
            />
            <el-button size="small" type="primary" @click="saveEdit">保存</el-button>
            <el-button size="small" @click="cancelEdit">取消</el-button>
          </div>
          <h3
            v-else
            class="text-sm font-medium text-white truncate cursor-pointer hover:text-primary-400"
            @click="startEdit(template)"
            :title="template.name"
          >
            {{ template.name }}
          </h3>

          <!-- 配置信息 -->
          <div class="text-xs text-slate-400 space-y-1">
            <p class="flex items-center gap-2">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {{ template.avatar_name || '未选择形象' }}
            </p>
            <p class="flex items-center gap-2">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              {{ getVoiceDisplay(template.voice_type) }}
            </p>
            <p v-if="template.speed_ratio !== 1" class="flex items-center gap-2">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              语速: {{ template.speed_ratio }}x
            </p>
          </div>

          <!-- 时间 -->
          <p class="text-xs text-slate-500">{{ formatDate(template.created_at) }}</p>

          <!-- 操作按钮 -->
          <div class="flex gap-2 pt-2 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
            <el-button
              size="small"
              type="primary"
              plain
              @click="startEdit(template)"
            >
              重命名
            </el-button>
            <el-button
              @click="handleDelete(template)"
              type="danger"
              size="small"
              plain
            >
              删除
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
