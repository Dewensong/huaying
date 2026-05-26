// 简单的全局事件总线，用于组件间通信
type EventCallback = (...args: any[]) => void

class EventBus {
  private listeners: Map<string, EventCallback[]> = new Map()
  private expiredDialogShown = false

  on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  off(event: string, callback: EventCallback) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  emit(event: string, ...args: any[]) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(cb => cb(...args))
    }
  }

  // 专门用于 401 弹窗，确保只弹一次
  showTokenExpiredOnce() {
    if (this.expiredDialogShown) return
    this.expiredDialogShown = true
    this.emit('show-token-expired')
  }

  // 重置状态（退出登录后调用）
  resetExpiredDialog() {
    this.expiredDialogShown = false
  }
}

export const eventBus = new EventBus()
