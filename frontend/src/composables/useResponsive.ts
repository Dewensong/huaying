import { ref, onMounted, onUnmounted } from 'vue'

export function useResponsive() {
  const isMobile = ref(window.innerWidth < 768)
  const isTablet = ref(window.innerWidth >= 768 && window.innerWidth < 1024)
  const isDesktop = ref(window.innerWidth >= 1024)

  const handleResize = () => {
    const width = window.innerWidth
    isMobile.value = width < 768
    isTablet.value = width >= 768 && width < 1024
    isDesktop.value = width >= 1024
  }

  onMounted(() => {
    window.addEventListener('resize', handleResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
  })

  return {
    isMobile,
    isTablet,
    isDesktop,
    width: ref(window.innerWidth)
  }
}

export function useResponsiveDialog() {
  const { isMobile } = useResponsive()

  const dialogMode = ref<'dialog' | 'drawer'>('dialog')

  const toggleMode = () => {
    dialogMode.value = dialogMode.value === 'dialog' ? 'drawer' : 'dialog'
  }

  return {
    isMobile,
    dialogMode,
    toggleMode,
    isDrawer: isMobile
  }
}
