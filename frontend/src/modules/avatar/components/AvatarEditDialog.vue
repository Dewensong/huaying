<script setup lang="ts">
import { ref, watch } from 'vue'
import { avatarApi } from '@/api'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  visible: boolean
  avatar: any
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  success: []
}>()

const formRef = ref()
const loading = ref(false)

const form = ref({
  name: '',
  config: {} as any
})

watch(() => props.visible, (val) => {
  if (val && props.avatar) {
    form.value.name = props.avatar.name || ''
    form.value.config = props.avatar.config || {}
  }
})

function handleClose() {
  emit('update:visible', false)
}

async function handleSubmit() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await avatarApi.update(props.avatar.id, {
      name: form.value.name,
      config: form.value.config
    })
    ElMessage.success('更新成功')
    emit('success')
    handleClose()
  } catch (error) {
    ElMessage.error('更新失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    title="编辑形象"
    width="500px"
    :close-on-click-modal="false"
    destroy-on-close
    append-to-body
  >
    <el-form ref="formRef" :model="form" label-position="top">
      <el-form-item label="形象名称">
        <el-input v-model="form.name" placeholder="请输入形象名称" />
      </el-form-item>

      <el-form-item label="配置信息">
        <div class="bg-slate-800 rounded-lg p-4 font-mono text-sm">
          <pre class="text-slate-300 whitespace-pre-wrap">{{ JSON.stringify(form.config, null, 2) }}</pre>
        </div>
        <p class="text-xs text-slate-500 mt-2">高级配置，修改需谨慎</p>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">
        保存
      </el-button>
    </template>
  </el-dialog>
</template>
