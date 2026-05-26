<script setup lang="ts">
import { ref, watch } from 'vue'
import { avatarApi } from '@/api'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  success: []
}>()

const formRef = ref()
const loading = ref(false)
const previewUrl = ref('')
const selectedFile = ref<File | null>(null)

const form = ref({
  name: '',
  image: '',
  type: 'custom' as 'preset' | 'custom'
})

const rules = {
  name: [{ required: true, message: '请输入形象名称', trigger: 'blur' }],
  image: [{ required: true, message: '请上传形象图片', trigger: 'change' }]
}

watch(() => props.visible, (val) => {
  if (!val) {
    form.value = { name: '', image: '', type: 'custom' }
    previewUrl.value = ''
    selectedFile.value = null
  }
})

function handleClose() {
  emit('update:visible', false)
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const isImage = file.type.startsWith('image/')
  const isLt5M = file.size / 1024 / 1024 < 5

  if (!isImage) {
    ElMessage.warning('只能上传图片文件')
    return
  }

  if (!isLt5M) {
    ElMessage.warning('图片大小不能超过 5MB')
    return
  }

  selectedFile.value = file
  previewUrl.value = URL.createObjectURL(file)
  form.value.image = file.name // 临时用于验证
}

async function handleSubmit() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  if (!selectedFile.value) {
    ElMessage.warning('请上传形象图片')
    return
  }

  loading.value = true
  try {
    // 将文件转换为 base64
    const imageUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(selectedFile.value!)
    })

    await avatarApi.create({
      name: form.value.name,
      image: imageUrl,
      type: form.value.type
    })
    ElMessage.success('创建成功')
    emit('success')
    handleClose()
  } catch (error) {
    console.error('上传失败:', error)
    ElMessage.error('创建失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    title="上传形象"
    width="500px"
    :close-on-click-modal="false"
    destroy-on-close
    append-to-body
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
      <el-form-item label="形象名称" prop="name">
        <el-input v-model="form.name" placeholder="请输入形象名称" />
      </el-form-item>

      <el-form-item label="形象图片" prop="image">
        <div class="border-2 border-dashed border-slate-600 rounded-xl p-6 text-center hover:border-primary-500 transition-colors cursor-pointer relative">
          <input
            type="file"
            accept="image/*"
            class="absolute inset-0 opacity-0 cursor-pointer"
            @change="handleFileChange"
          />

          <div v-if="previewUrl" class="relative">
            <img :src="previewUrl" class="max-h-48 mx-auto rounded-lg" />
            <p class="text-sm text-slate-400 mt-2">点击或拖拽更换图片</p>
          </div>

          <div v-else>
            <svg class="w-12 h-12 mx-auto text-slate-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p class="text-sm text-slate-400">点击或拖拽上传图片</p>
            <p class="text-xs text-slate-500 mt-1">支持 JPG、PNG，建议尺寸 512x512</p>
          </div>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">
        上传
      </el-button>
    </template>
  </el-dialog>
</template>
