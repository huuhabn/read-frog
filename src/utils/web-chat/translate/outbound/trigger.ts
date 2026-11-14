import type { IChatAdapter } from "../../adapter/types"
import { OutboundTranslationPreview } from "./preview"

export interface OutboundTriggerOptions {
  adapter: IChatAdapter
  targetLang: string
  debounceMs?: number
  autoTranslateOnPause?: boolean
  translateFn: (text: string, targetLang: string) => Promise<string>
}

export class OutboundTranslationTrigger {
  private adapter: IChatAdapter
  private targetLang: string
  private debounceMs: number
  private autoTranslateOnPause: boolean
  private translateFn: (text: string, targetLang: string) => Promise<string>

  private preview = new OutboundTranslationPreview()
  private timer: ReturnType<typeof setTimeout> | null = null
  private listeningEl: HTMLElement | null = null
  private cleanups: (() => void)[] = []

  constructor(options: OutboundTriggerOptions) {
    this.adapter = options.adapter
    this.targetLang = options.targetLang
    this.debounceMs = options.debounceMs ?? 400
    this.autoTranslateOnPause = options.autoTranslateOnPause ?? false
    this.translateFn = options.translateFn
  }

  start(): void {
    const handleKeydown = (e: KeyboardEvent) => {
      // Ctrl+Shift+E or Cmd+Shift+E
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyE") {
        e.preventDefault()
        void this.triggerTranslateCurrentInput()
      }
    }

    window.addEventListener("keydown", handleKeydown, true)
    this.cleanups.push(() => window.removeEventListener("keydown", handleKeydown, true))

    if (this.autoTranslateOnPause) {
      const handleInput = () => {
        if (this.timer) clearTimeout(this.timer)
        this.timer = setTimeout(() => {
          void this.triggerTranslateCurrentInput()
        }, this.debounceMs)
      }

      const input = this.adapter.getInputElement()
      if (input) {
        this.listeningEl = input
        input.addEventListener("input", handleInput)
        this.cleanups.push(() => input.removeEventListener("input", handleInput))
      }
    }
  }

  async triggerTranslateCurrentInput(): Promise<void> {
    const input = this.adapter.getInputElement()
    if (!input) return

    const rawText =
      input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement
        ? input.value
        : input.innerText || input.textContent || ""

    const trimmed = rawText.trim()
    if (!trimmed || trimmed.startsWith("/")) return // Don't translate slash commands automatically

    try {
      const translated = await this.translateFn(trimmed, this.targetLang)
      this.preview.show(input, translated, (appliedText) => {
        this.adapter.insertText(appliedText)
      })
    } catch {
      // Ignore translation failure
    }
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.preview.destroy()
    this.cleanups.forEach((c) => c())
    this.cleanups = []
  }
}
