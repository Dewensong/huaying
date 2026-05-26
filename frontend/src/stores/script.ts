import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface SelectedScript {
  id: string
  text: string
}

export const useScriptStore = defineStore('script', () => {
  const selectedScripts = ref<SelectedScript[]>([])

  function setScripts(scripts: SelectedScript[]) {
    selectedScripts.value = scripts
  }

  function consumeScripts(): SelectedScript[] {
    const scripts = [...selectedScripts.value]
    selectedScripts.value = []
    return scripts
  }

  return {
    selectedScripts,
    setScripts,
    consumeScripts
  }
})
