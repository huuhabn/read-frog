import type { ChatMessage, ChatRoom, IChatAdapter } from "./types"
import { getPlatformSelectorConfig } from "../remote-config/loader"
import { extractCleanText, insertTextIntoElement } from "./dom-utils"

export class GenericChatAdapter implements IChatAdapter {
  readonly platform = "generic"
  private lastFocusedInput: HTMLElement | null = null

  constructor() {
    if (typeof document !== "undefined") {
      document.addEventListener("focusin", (e) => {
        const target = e.target as HTMLElement
        if (
          target &&
          (target.tagName === "TEXTAREA" ||
            target.getAttribute("contenteditable") === "true" ||
            target.getAttribute("role") === "textbox")
        ) {
          this.lastFocusedInput = target
        }
      })
    }
  }

  matches(_url: string): boolean {
    // Generic matches any page as a universal fallback
    return true
  }

  getCurrentRoom(): ChatRoom | null {
    return {
      id: window.location.hostname + window.location.pathname,
      name: document.title || "Web Chat",
      platform: "generic",
    }
  }

  getInputElement(): HTMLElement | null {
    if (this.lastFocusedInput && document.contains(this.lastFocusedInput)) {
      return this.lastFocusedInput
    }

    const config = getPlatformSelectorConfig("generic")
    const candidate = document.querySelector<HTMLElement>(config.inputBoxSelector)
    if (candidate) return candidate

    // Heuristic: check activeElement
    const active = document.activeElement as HTMLElement
    if (
      active &&
      (active.tagName === "TEXTAREA" ||
        active.getAttribute("contenteditable") === "true" ||
        active.getAttribute("role") === "textbox")
    ) {
      return active
    }

    return null
  }

  insertText(text: string): boolean {
    const input = this.getInputElement()
    if (!input) return false
    return insertTextIntoElement(input, text)
  }

  getMessages(limit = 50): ChatMessage[] {
    const config = getPlatformSelectorConfig("generic")
    const items = document.querySelectorAll(config.messageItemSelector)
    const messages: ChatMessage[] = []

    if (items.length > 0) {
      items.forEach((item, index) => {
        const el = item as HTMLElement
        const content = extractCleanText(el)
        if (!content) return

        messages.push({
          id: `generic-msg-${index}-${Date.now()}`,
          author: "User",
          content,
          timestamp: Date.now(),
          isOwn: false,
          element: el,
        })
      })
      return limit ? messages.slice(-limit) : messages
    }

    // Heuristic: If no explicit message items found, search around input element
    const input = this.getInputElement()
    if (input) {
      let scrollContainer: HTMLElement | null = input.parentElement
      while (scrollContainer && scrollContainer !== document.body) {
        if (
          scrollContainer.scrollHeight > scrollContainer.clientHeight &&
          scrollContainer.clientHeight > 100
        ) {
          break
        }
        scrollContainer = scrollContainer.parentElement
      }

      if (scrollContainer) {
        const paragraphs = scrollContainer.querySelectorAll("p, div, li")
        paragraphs.forEach((p, index) => {
          const el = p as HTMLElement
          const text = extractCleanText(el)
          if (text && text.length > 3 && text.length < 2000 && !el.contains(input)) {
            messages.push({
              id: `generic-p-${index}-${Date.now()}`,
              author: "Participant",
              content: text,
              timestamp: Date.now(),
              isOwn: false,
              element: el,
            })
          }
        })
      }
    }

    return limit ? messages.slice(-limit) : messages
  }

  getRecentMessages(n = 5): ChatMessage[] {
    const all = this.getMessages(n * 2)
    return all.slice(-n)
  }
}
