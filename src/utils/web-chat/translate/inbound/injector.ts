import type { IChatAdapter } from "../../adapter/types"
import { getRoomSettings, webChatRoomSettingsStorage } from "../../storage/room-settings"
import { attachTranslationSubline, removeTranslationSubline } from "./sub-line"
import { type BatchTranslateFunction, ViewportMessageBatcher } from "./viewport-batcher"

export interface InboundTranslationController {
  start(): void
  stop(): void
  isStarted(): boolean
}

export function createInboundTranslationController(options: {
  adapter: IChatAdapter
  targetLang: string
  translateFn: BatchTranslateFunction
}): InboundTranslationController {
  const { adapter, targetLang, translateFn } = options
  let batcher: ViewportMessageBatcher | null = null
  let disconnectObserver: (() => void) | null = null
  let unwatchStorage: (() => void) | null = null
  let running = false

  const cleanupAllSublines = () => {
    const messages = adapter.getMessages(50)
    for (const msg of messages) {
      if (msg.element) {
        removeTranslationSubline(msg.element)
      }
    }
  }

  const processVisibleMessages = async () => {
    if (!running || !batcher) return
    const currentRoom = adapter.getCurrentRoom()
    if (!currentRoom?.id) return

    const roomSettings = await getRoomSettings(currentRoom.id)
    if (!roomSettings?.sublineTranslate) {
      cleanupAllSublines()
      return
    }

    const messages = adapter.getMessages(50)
    for (const msg of messages) {
      if (msg.element && msg.content) {
        batcher.observe(msg.element, msg.id, msg.content)
      }
    }
  }

  return {
    start() {
      if (running) return
      running = true

      batcher = new ViewportMessageBatcher({
        targetLang,
        translateFn,
        onTranslated(item, translatedText) {
          attachTranslationSubline(item.element, translatedText)
        },
      })

      void processVisibleMessages()

      if (adapter.observeMessages) {
        disconnectObserver = adapter.observeMessages(() => {
          void processVisibleMessages()
        })
      }

      unwatchStorage = webChatRoomSettingsStorage.watch((allSettings) => {
        if (!running) return
        const currentRoom = adapter.getCurrentRoom()
        if (!currentRoom?.id) return
        const roomSetting = allSettings?.[currentRoom.id]
        if (!roomSetting?.sublineTranslate) {
          cleanupAllSublines()
        } else {
          void processVisibleMessages()
        }
      })
    },

    stop() {
      if (!running) return
      running = false
      if (disconnectObserver) {
        disconnectObserver()
        disconnectObserver = null
      }
      if (unwatchStorage) {
        unwatchStorage()
        unwatchStorage = null
      }
      if (batcher) {
        batcher.destroy()
        batcher = null
      }
      cleanupAllSublines()
    },

    isStarted() {
      return running
    },
  }
}
