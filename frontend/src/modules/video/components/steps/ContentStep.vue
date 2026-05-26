<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const scripts = defineModel<string[]>('scripts', { default: () => [] })
const title = defineModel<string>('title', { default: '' })
defineProps<{
  loading?: boolean
}>()

const newScript = ref('')
const importDialogVisible = ref(false)
const importText = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

function addScript() {
  if (!newScript.value.trim()) return
  scripts.value.push(newScript.value.trim())
  newScript.value = ''
}

function removeScript(index: number) {
  scripts.value.splice(index, 1)
}

function showImportDialog() {
  importText.value = ''
  importDialogVisible.value = true
}

function handleImport() {
  if (!importText.value.trim()) {
    ElMessage.warning('请输入文案内容')
    return
  }

  // 支持多种分隔符：换行、序号+点号、逗号、分号
  const lines = importText.value
    .split(/[\n,;]/)
    .map(line => line.trim())
    .filter(line => {
      // 过滤掉空行和纯数字序号
      return line && !/^\d+[.、)）]?\s*$/.test(line)
    })
    .map(line => {
      // 移除开头的序号
      return line.replace(/^\d+[.、)）]\s*/, '')
    })

  if (lines.length === 0) {
    ElMessage.warning('未识别到有效文案')
    return
  }

  scripts.value.push(...lines)
  importDialogVisible.value = false
  ElMessage.success(`成功导入 ${lines.length} 条文案`)
}

function handleFileImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target?.result as string
    if (!content) {
      ElMessage.error('文件读取失败')
      return
    }

    // 将文件内容显示到文本区域
    importText.value = content
    ElMessage.success('文件读取成功，请检查内容后点击确认导入')
  }
  reader.readAsText(file)

  // 清空 input，允许重复选择同一文件
  input.value = ''
}

function clearAll() {
  scripts.value = []
}
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-white">选择或输入文案</h3>
      <div class="flex gap-2">
        <el-button @click="showImportDialog" type="info" plain>
          <el-icon class="mr-1"><DocumentCopy /></el-icon>
          批量导入
        </el-button>
        <el-button @click="clearAll" type="danger" plain :disabled="scripts.length === 0">
          <el-icon class="mr-1"><Delete /></el-icon>
          清空
        </el-button>
      </div>
    </div>

    <!-- 标题输入 -->
    <div class="mb-6">
      <label class="block text-sm text-slate-400 mb-2">视频标题（可选）</label>
      <el-input
        v-model="title"
        placeholder="为这批视频设置一个通用标题"
      />
    </div>

    <!-- 文案列表 -->
    <div v-if="scripts.length > 0" class="space-y-3 mb-4 max-h-[300px] overflow-y-auto">
      <div
        v-for="(script, index) in scripts"
        :key="index"
        class="glass-card p-4 flex items-start gap-3"
      >
        <span class="w-6 h-6 rounded-full bg-primary-500/20 text-primary-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
          {{ index + 1 }}
        </span>
        <p class="flex-1 text-sm text-slate-200 leading-relaxed">{{ script }}</p>
        <el-button
          @click="removeScript(index)"
          type="danger"
          size="small"
          circle
        >
          <el-icon><Close /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="glass-card p-8 text-center mb-4">
      <svg class="w-12 h-12 mx-auto text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p class="text-slate-400 mb-3">暂无文案，点击下方按钮添加</p>
      <el-button type="primary" @click="showImportDialog">
        <el-icon class="mr-1"><DocumentCopy /></el-icon>
        批量导入文案
      </el-button>
    </div>

    <!-- 添加文案输入 -->
    <div class="glass-card p-4">
      <label class="block text-sm text-slate-400 mb-2">添加文案</label>
      <div class="flex gap-2">
        <el-input
          v-model="newScript"
          type="textarea"
          :rows="3"
          placeholder="输入口播文案，每条文案将生成一个独立的视频..."
          @keydown.enter.ctrl="addScript"
        />
        
      </div>
      <div style="display: flex;justify-content: end;align-items: center;margin-top: 12px;">
        <p class="text-xs text-slate-500 mt-2" style="margin-right: 10px;">Ctrl+Enter 快速添加</p>
        <el-button
          type="primary"
          @click="addScript"
          class="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors self-end"
        >
          添加
        </el-button>
      </div>
    </div>

    <!-- 统计 -->
    <div class="mt-4 text-center">
      <span class="text-2xl font-bold gradient-text">{{ scripts.length }}</span>
      <span class="text-slate-400 ml-2">条文案</span>
      <span v-if="scripts.length > 0" class="text-slate-500 ml-2">（将创建 {{ scripts.length }} 个视频）</span>
    </div>

    <!-- 批量导入对话框 -->
    <el-dialog
      v-model="importDialogVisible"
      title="批量导入文案"
      width="600px"
      :close-on-click-modal="false"
      append-to-body
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm text-slate-400 mb-2">粘贴文案</label>
          <el-input
            v-model="importText"
            type="textarea"
            :rows="8"
            placeholder="支持多种格式：
• 每行一条文案
• 用逗号分隔
• 用分号分隔
• 带序号的列表（如 1. xxx）
会自动识别并批量导入"
          />
        </div>

        <div class="text-center text-slate-400">
          <span class="text-sm">或者</span>
        </div>

        <div>
          <label class="block text-sm text-slate-400 mb-2">从文件导入</label>
          <el-button type="info" plain @click="fileInputRef?.click()">
            <el-icon class="mr-1"><Upload /></el-icon>
            选择文件 (.txt, .csv)
          </el-button>
          <input
            ref="fileInputRef"
            type="file"
            accept=".txt,.csv,text/plain,text/csv"
            class="hidden"
            @change="handleFileImport"
          />
          <p class="text-xs text-slate-500 mt-2">支持 TXT、CSV 格式的纯文本文件</p>
        </div>
      </div>

      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleImport">确认导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>
