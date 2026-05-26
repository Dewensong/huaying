<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { avatarApi, aiApi } from '@/api'
import { ElMessage, ElDialog, ElForm, ElFormItem, ElInput, ElButton, ElUpload, ElIcon } from 'element-plus'
import { Plus, MagicStick, Upload, Delete, Picture } from '@element-plus/icons-vue'
import AvatarCard from '../components/AvatarCard.vue'
import AvatarEditDialog from '../components/AvatarEditDialog.vue'

const avatars = ref<any[]>([])
const loading = ref(false)
const uploadDialogVisible = ref(false)
const editDialogVisible = ref(false)
const currentAvatar = ref<any>(null)

// 创建形象对话框
const createDialogVisible = ref(false)
const createForm = ref({
  name: '',
  image: '',
  description: ''
})
const createLoading = ref(false)
const createFileList = ref<any[]>([])

// AI 生成对话框
const aiDialogVisible = ref(false)
const aiForm = ref({
  prompt: '',
  style: '商务',
  name: ''
})
const aiGenerating = ref(false)
const aiServiceAvailable = ref(true)

let isFetching = false

// 风格选项
const styleOptions = [
  { label: '商务', value: '商务' },
  { label: '亲和', value: '亲和' },
  { label: '年轻', value: '年轻' },
  { label: '权威', value: '权威' }
]

async function fetchAvatars() {
  if (isFetching) return
  isFetching = true
  
  loading.value = true
  try {
    const res = await avatarApi.list()
    avatars.value = (res as any)?.list || []
  } catch (error) {
    ElMessage.error('获取形象列表失败')
  } finally {
    loading.value = false
    isFetching = false
  }
}

// 检查 AI 服务状态
async function checkAiStatus() {
  try {
    const res = await aiApi.getStatus() as any
    aiServiceAvailable.value = res?.seedreamConfigured || false
  } catch (error) {
    aiServiceAvailable.value = false
  }
}

function handleUploadSuccess() {
  uploadDialogVisible.value = false
  fetchAvatars()
}

function handleEdit(avatar: any) {
  currentAvatar.value = avatar
  editDialogVisible.value = true
}

async function handleDelete(avatar: any) {
  try {
    await avatarApi.delete(avatar.id)
    ElMessage.success('删除成功')
    fetchAvatars()
  } catch (error: any) {
    const message = error?.response?.data?.message || '删除失败'
    ElMessage.error(message)
  }
}

async function handleToggleStatus(avatar: any) {
  const previousEnabled = avatar.enabled

  try {
    const newEnabled = !previousEnabled

    // 乐观更新 UI
    avatar.enabled = newEnabled

    const response = await avatarApi.update(avatar.id, { enabled: newEnabled })

    // 使用后端返回的最新值更新本地状态
    if (response.data?.enabled !== undefined) {
      avatar.enabled = !!response.data.enabled
    }

    ElMessage.success('状态更新成功')
  } catch (error) {
    // 回滚到之前的状态
    avatar.enabled = previousEnabled
    ElMessage.error('更新失败')
  }
}

// 打开创建形象对话框
function openCreateDialog() {
  createForm.value = {
    name: '',
    image: '',
    description: ''
  }
  createFileList.value = []
  createDialogVisible.value = true
}

// 文件上传前检查
function beforeAvatarUpload(file: any) {
  const isImage = file.type.startsWith('image/')
  const isLt5M = file.size / 1024 / 1024 < 5

  if (!isImage) {
    ElMessage.error('只能上传图片文件!')
    return false
  }
  if (!isLt5M) {
    ElMessage.error('图片大小不能超过 5MB!')
    return false
  }
  return true
}

// 文件上传成功
function handleUploadChange(file: any) {
  createFileList.value = [file]
  // 读取文件为 base64
  const reader = new FileReader()
  reader.onload = (e) => {
    createForm.value.image = e.target?.result as string
  }
  reader.readAsDataURL(file.raw)
}

// 移除文件
function handleRemoveFile() {
  createFileList.value = []
  createForm.value.image = ''
}

// 提交创建形象
async function submitCreate() {
  if (!createForm.value.name.trim()) {
    ElMessage.warning('请输入形象名称')
    return
  }

  if (!createForm.value.image) {
    ElMessage.warning('请上传形象图片')
    return
  }

  createLoading.value = true

  try {
    await avatarApi.create({
      name: createForm.value.name,
      image: createForm.value.image,
      type: 'custom',
      config: {
        description: createForm.value.description
      }
    })

    ElMessage.success('形象创建成功')
    createDialogVisible.value = false
    fetchAvatars()
  } catch (error: any) {
    const message = error?.response?.data?.message || '创建失败'
    ElMessage.error(message)
  } finally {
    createLoading.value = false
  }
}

// 打开 AI 生成对话框
function openAiDialog() {
  aiForm.value = {
    prompt: '',
    style: '商务',
    name: ''
  }
  aiDialogVisible.value = true
}

// 提交 AI 生成
async function submitAiGenerate() {
  if (!aiForm.value.prompt.trim()) {
    ElMessage.warning('请输入形象描述')
    return
  }

  if (aiForm.value.prompt.length < 5) {
    ElMessage.warning('形象描述太短，请提供更详细的描述')
    return
  }

  aiGenerating.value = true

  try {
    const res = await aiApi.generateAvatar({
      prompt: aiForm.value.prompt,
      style: aiForm.value.style,
      name: aiForm.value.name || undefined
    }) as any

    ElMessage.success(res?.message || '形象生成成功')
    aiDialogVisible.value = false
    fetchAvatars()
  } catch (error: any) {
    const message = error?.response?.data?.message || '生成失败，请稍后重试'
    ElMessage.error(message)
  } finally {
    aiGenerating.value = false
  }
}

onMounted(() => {
  fetchAvatars()
  checkAiStatus()
})
</script>

<template>
  <div class="space-y-6 animate-fade-in">
    <!-- 页面标题和操作 -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold text-white">形象管理</h1>
        <p class="text-slate-400 mt-1">创建和管理您的数字人形象</p>
      </div>

      <div class="flex gap-2 flex-wrap">
        <el-button 
          type="primary"
          @click="openCreateDialog"
        >
          <el-icon class="mr-1"><Plus /></el-icon>
          创建形象
        </el-button>
        <el-button 
          v-if="aiServiceAvailable"
          type="success" 
          @click="openAiDialog"
        >
          <el-icon class="mr-1"><MagicStick /></el-icon>
          AI 生成
        </el-button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      <div v-for="i in 8" :key="i" class="glass-card p-4 animate-pulse">
        <div class="aspect-[3/4] bg-slate-700 rounded-lg mb-3" />
        <div class="h-4 bg-slate-700 rounded w-3/4" />
      </div>
    </div>

    <!-- 形象网格 -->
    <div v-else-if="avatars.length > 0" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      <AvatarCard
        v-for="avatar in avatars"
        :key="avatar.id"
        :avatar="avatar"
        @edit="handleEdit"
        @delete="handleDelete"
        @toggle="handleToggleStatus"
      />
    </div>

    <!-- 空状态 -->
    <div v-else class="glass-card p-12 text-center">
      <div class="w-20 h-20 mx-auto bg-slate-800 rounded-full flex items-center justify-center mb-4">
        <el-icon :size="40" class="text-slate-600"><Picture /></el-icon>
      </div>
      <h3 class="text-lg font-medium text-white mb-2">暂无形象</h3>
      <p class="text-slate-400 mb-6">开始创建您的第一个数字人形象</p>
      <div class="flex gap-3 justify-center">
        <el-button type="primary" @click="openCreateDialog">
          <el-icon class="mr-1"><Plus /></el-icon>
          创建形象
        </el-button>
        <el-button 
          v-if="aiServiceAvailable"
          type="success" 
          @click="openAiDialog"
        >
          <el-icon class="mr-1"><MagicStick /></el-icon>
          AI 生成
        </el-button>
      </div>
    </div>

    <!-- 上传对话框（保留原有功能） -->
    <AvatarUploadDialog
      v-model:visible="uploadDialogVisible"
      @success="handleUploadSuccess"
    />

    <!-- 编辑对话框 -->
    <AvatarEditDialog
      v-model:visible="editDialogVisible"
      :avatar="currentAvatar"
      @success="handleUploadSuccess"
    />

    <!-- 创建形象对话框 -->
    <el-dialog
      v-model="createDialogVisible"
      title="创建形象"
      width="500px"
      :close-on-click-modal="false"
      :append-to-body="true"
    >
      <el-form :model="createForm" label-position="top">
        <el-form-item label="形象名称" required>
          <el-input
            v-model="createForm.name"
            placeholder="请输入形象名称"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="形象图片" required>
          <div class="w-full">
            <!-- 图片预览 -->
            <div 
              v-if="createForm.image" 
              class="relative inline-block mb-3"
            >
              <el-image
                :src="createForm.image"
                class="w-40 h-40 object-cover rounded-lg border border-slate-600"
                fit="cover"
              />
              <el-button
                class="absolute -top-2 -right-2"
                type="danger"
                circle
                size="small"
                @click="handleRemoveFile"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>

            <!-- 上传按钮 -->
            <el-upload
              v-else
              class="avatar-uploader"
              action="#"
              :auto-upload="false"
              :show-file-list="false"
              :before-upload="beforeAvatarUpload"
              :on-change="handleUploadChange"
              accept="image/*"
            >
              <div class="w-40 h-40 border-2 border-dashed border-slate-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-colors">
                <el-icon :size="32" class="text-slate-500 mb-2"><Upload /></el-icon>
                <span class="text-sm text-slate-500">点击上传图片</span>
                <span class="text-xs text-slate-600 mt-1">支持 JPG/PNG，最大 5MB</span>
              </div>
            </el-upload>
          </div>
        </el-form-item>

        <el-form-item label="形象描述（选填）">
          <el-input
            v-model="createForm.description"
            type="textarea"
            :rows="3"
            placeholder="描述这个形象的特点，如：专业、亲和、年轻等"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button 
          type="primary" 
          :loading="createLoading"
          @click="submitCreate"
        >
          {{ createLoading ? '创建中...' : '创建' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- AI 生成形象对话框 -->
    <el-dialog
      v-model="aiDialogVisible"
      title="AI 生成形象"
      width="600px"
      :close-on-click-modal="false"
      append-to-body
    >
      <div class="space-y-4">
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-white">形象描述</label>
            <span class="text-xs text-slate-500">描述越详细，效果越好</span>
          </div>
          <el-input
            v-model="aiForm.prompt"
            type="textarea"
            :rows="4"
            placeholder="例如：专业商务女性，30岁，短发，微笑，白色衬衫，办公室背景"
            maxlength="500"
            show-word-limit
          />
        </div>

        <div>
          <label class="text-sm font-medium text-white mb-2 block">风格选择</label>
          <div class="flex gap-2 flex-wrap">
            <el-tag
              v-for="style in styleOptions"
              :key="style.value"
              :type="aiForm.style === style.value ? 'success' : 'info'"
              class="cursor-pointer px-4 py-2"
              @click="aiForm.style = style.value"
            >
              {{ style.label }}
            </el-tag>
          </div>
        </div>

        <div>
          <label class="text-sm font-medium text-white mb-2 block">形象名称（可选）</label>
          <el-input
            v-model="aiForm.name"
            placeholder="留空则使用默认名称"
            maxlength="50"
          />
        </div>

        <div class="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-400">
          <p class="mb-1">💡 提示：</p>
          <ul class="list-disc list-inside space-y-0.5">
            <li>描述越具体，生成效果越好</li>
            <li>建议包含：性别、年龄、外貌特征、服装、表情、场景等</li>
            </ul>
        </div>
      </div>

      <template #footer>
        <el-button @click="aiDialogVisible = false">取消</el-button>
        <el-button 
          type="success" 
          :loading="aiGenerating"
          @click="submitAiGenerate"
        >
          <el-icon v-if="!aiGenerating" class="mr-1"><MagicStick /></el-icon>
          {{ aiGenerating ? '生成中...' : '开始生成' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.avatar-uploader :deep(.el-upload) {
  border: none;
}
</style>
