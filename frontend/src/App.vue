<script setup lang="ts">
import { RouterView } from 'vue-router'
import { ref, onMounted, onUnmounted } from 'vue'
import TokenExpiredDialog from '@/components/TokenExpiredDialog.vue'
import { eventBus } from '@/utils/eventBus'

const tokenExpiredRef = ref<InstanceType<typeof TokenExpiredDialog>>()

function handleShowTokenExpired() {
  tokenExpiredRef.value?.show()
}

onMounted(() => {
  eventBus.on('show-token-expired', handleShowTokenExpired)
})

onUnmounted(() => {
  eventBus.off('show-token-expired', handleShowTokenExpired)
})
</script>

<template>
  <RouterView />
  <TokenExpiredDialog ref="tokenExpiredRef" />
</template>

<style>
#app {
  min-height: 100vh;
  background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
}
</style>
