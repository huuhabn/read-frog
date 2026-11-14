import type { IChatAdapter } from "../../adapter/types"
import { attachTranslationSubline } from "./sub-line"
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
  let running = false

  const processVisibleMessages = () => {
    if (!running || !batcher) return
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

      processVisibleMessages()

      if (adapter.observeMessages) {
        disconnectObserver = adapter.observeMessages(() => {
          processVisibleMessages()
        })
      }
    },

    stop() {
      if (!running) return
      running = false
      if (disconnectObserver) {
        disconnectObserver()
        disconnectObserver = null
      }
      if (batcher) {
        batcher.destroy()
        batcher = null
      }
    },

    isStarted() {
      return running
    },
  }
}
