import { webChatTranslationCache } from "../cache/translation-cache"
import { extractPlaceholders, restorePlaceholders } from "../placeholder/extractor"

export interface MessageBatchItem {
  id: string
  text: string
  element: HTMLElement
}

export type BatchTranslateFunction = (texts: string[], targetLang: string) => Promise<string[]>

function isLikelyVietnamese(text: string): boolean {
  return /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(text)
}

export class ViewportMessageBatcher {
  private queue: MessageBatchItem[] = []
  private observer: IntersectionObserver | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private processedIds = new Set<string>()

  private batchSize = 12
  private debounceMs = 250
  private translateFn: BatchTranslateFunction
  private targetLang: string
  private onTranslated: (item: MessageBatchItem, translatedText: string) => void

  constructor(options: {
    batchSize?: number
    debounceMs?: number
    targetLang: string
    translateFn: BatchTranslateFunction
    onTranslated: (item: MessageBatchItem, translatedText: string) => void
  }) {
    this.batchSize = options.batchSize || 12
    this.debounceMs = options.debounceMs || 250
    this.targetLang = options.targetLang
    this.translateFn = options.translateFn
    this.onTranslated = options.onTranslated

    if (typeof IntersectionObserver !== "undefined") {
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const el = entry.target as HTMLElement
              const id = el.getAttribute("data-wm-msg-id")
              const text = el.getAttribute("data-wm-msg-text")
              if (id && text && !this.processedIds.has(id)) {
                this.add({ id, text, element: el })
                this.observer?.unobserve(el)
              }
            }
          }
        },
        { rootMargin: "100px 0px" },
      )
    }
  }

  observe(element: HTMLElement, id: string, text: string): void {
    if (this.processedIds.has(id)) return

    // Quick filter: skip purely numbers, emoji or single words
    const trimmed = text.trim()
    if (!trimmed || trimmed.length < 2 || /^[\d\s.,:;!?@#$%^&*()_+=-]+$/.test(trimmed)) {
      return
    }

    // Language guard: if target is Vietnamese and text is already in Vietnamese, skip
    if (this.targetLang === "vi" && isLikelyVietnamese(trimmed)) {
      this.processedIds.add(id)
      return
    }

    element.setAttribute("data-wm-msg-id", id)
    element.setAttribute("data-wm-msg-text", text)

    if (this.observer) {
      this.observer.observe(element)
    } else {
      // Fallback if IntersectionObserver not available
      this.add({ id, text, element })
    }
  }

  add(item: MessageBatchItem): void {
    if (this.processedIds.has(item.id)) return
    this.processedIds.add(item.id)

    // Check cache first
    const cached = webChatTranslationCache.get(item.text, this.targetLang)
    if (cached) {
      this.onTranslated(item, cached)
      return
    }

    this.queue.push(item)

    if (this.queue.length >= this.batchSize) {
      void this.flush()
    } else {
      if (this.timer) clearTimeout(this.timer)
      this.timer = setTimeout(() => void this.flush(), this.debounceMs)
    }
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    if (this.queue.length === 0) return

    const itemsToProcess = [...this.queue]
    this.queue = []

    // Extract placeholders for each text
    const extractedList = itemsToProcess.map((item) => extractPlaceholders(item.text))
    const cleanTexts = extractedList.map((e) => e.text)

    try {
      const results = await this.translateFn(cleanTexts, this.targetLang)
      results.forEach((res, index) => {
        const item = itemsToProcess[index]
        if (!item) return
        const placeholders = extractedList[index]?.placeholders ?? {}
        const restored = restorePlaceholders(res, placeholders)
        webChatTranslationCache.set(item.text, this.targetLang, restored)
        this.onTranslated(item, restored)
      })
    } catch {
      // Do not delete failed IDs from processedIds to prevent infinite retry storms (e.g. on 429)
    }
  }

  destroy(): void {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.queue = []
    this.processedIds.clear()
  }
}
