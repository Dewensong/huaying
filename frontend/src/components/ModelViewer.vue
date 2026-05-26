<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

interface Props {
  modelUrl: string
  autoRotate?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  autoRotate: true
})

const containerRef = ref<HTMLDivElement | null>(null)
const isLoading = ref(true)
const hasError = ref(false)

let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let animationId: number | null = null
let model: THREE.Object3D | null = null
let resizeObserver: ResizeObserver | null = null

// 初始化 Three.js 场景
function initScene() {
  if (!containerRef.value) return

  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight

  // 创建场景
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a2e)

  // 创建相机
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
  camera.position.set(0, 1, 5)

  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.shadowMap.enabled = true
  containerRef.value.appendChild(renderer.domElement)

  // 添加环境光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambientLight)

  // 添加定向光
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
  directionalLight.position.set(5, 10, 7.5)
  directionalLight.castShadow = true
  scene.add(directionalLight)

  // 添加补光
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3)
  fillLight.position.set(-5, 0, -5)
  scene.add(fillLight)

  // 创建控制器
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.minDistance = 2
  controls.maxDistance = 10
  controls.target.set(0, 1, 0)

  // 加载模型
  loadModel()
}

// 加载 GLTF 模型
function loadModel() {
  if (!scene || !props.modelUrl) return

  isLoading.value = true
  hasError.value = false

  const loader = new GLTFLoader()

  loader.load(
    props.modelUrl,
    (gltf) => {
      model = gltf.scene

      // 计算模型边界并居中
      const box = new THREE.Box3().setFromObject(model)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())

      // 将模型居中到 (0, 1, 0)
      model.position.x = -center.x
      model.position.y = 1 - center.y
      model.position.z = -center.z

      // 根据模型大小调整相机位置
      const maxDim = Math.max(size.x, size.y, size.z)
      const fov = camera!.fov * (Math.PI / 180)
      let cameraZ = Math.abs(maxDim / Math.tan(fov / 2)) * 0.8
      camera!.position.z = cameraZ

      scene!.add(model)

      // 如果启用自动旋转
      if (props.autoRotate && model) {
        model.rotation.y = 0
      }

      isLoading.value = false
    },
    undefined,
    (error) => {
      console.warn('模型加载失败:', props.modelUrl, error)
      hasError.value = true
      isLoading.value = false
    }
  )
}

// 渲染循环
function animate() {
  animationId = requestAnimationFrame(animate)

  // 自动旋转
  if (props.autoRotate && model) {
    model.rotation.y += 0.005
  }

  // 更新控制器
  if (controls) {
    controls.update()
  }

  // 渲染
  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}

// 处理窗口大小变化
function handleResize() {
  if (!containerRef.value || !camera || !renderer) return

  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight

  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

// 清理资源
function cleanup() {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }

  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }

  if (controls) {
    controls.dispose()
    controls = null
  }

  if (renderer) {
    renderer.dispose()
    if (containerRef.value && renderer.domElement.parentNode === containerRef.value) {
      containerRef.value.removeChild(renderer.domElement)
    }
    renderer = null
  }

  if (model) {
    model.traverse((child) => {
      if ((child as THREE.Mesh).geometry) {
        (child as THREE.Mesh).geometry.dispose()
      }
      if ((child as THREE.Mesh).material) {
        const material = (child as THREE.Mesh).material
        if (Array.isArray(material)) {
          material.forEach(m => m.dispose())
        } else {
          material.dispose()
        }
      }
    })
    model = null
  }

  scene = null
  camera = null
}

// 监听容器大小变化
function setupResizeObserver() {
  if (!containerRef.value) return

  resizeObserver = new ResizeObserver(() => {
    handleResize()
  })
  resizeObserver.observe(containerRef.value)
}

onMounted(() => {
  initScene()
  animate()
  setupResizeObserver()
})

onUnmounted(() => {
  cleanup()
})

// 监听模型 URL 变化
watch(() => props.modelUrl, () => {
  // 移除旧模型
  if (model && scene) {
    scene.remove(model)
    model = null
  }
  // 加载新模型
  loadModel()
})
</script>

<template>
  <div ref="containerRef" class="w-full h-full relative">
    <!-- 加载状态 -->
    <div
      v-if="isLoading"
      class="absolute inset-0 flex items-center justify-center bg-slate-800/50"
    >
      <div class="flex flex-col items-center gap-2">
        <div class="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-sm text-slate-400">加载中...</span>
      </div>
    </div>

    <!-- 错误状态 -->
    <div
      v-if="hasError"
      class="absolute inset-0 flex items-center justify-center bg-slate-800"
    >
      <div class="flex flex-col items-center gap-2 text-slate-500">
        <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span class="text-sm">模型加载失败</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 确保容器正确显示 */
div {
  overflow: hidden;
}
</style>
