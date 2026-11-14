import type { ChatMessage, ChatRoom, IChatAdapter } from "./types"
import { getPlatformSelectorConfig } from "../remote-config/loader"
import { extractCleanText, insertTextIntoElement } from "./dom-utils"

export class TelegramChatAdapter implements IChatAdapter {
  readonly platform = "telegram"

  matches(url: string): boolean {
    return url.includes("web.telegram.org")
  }

  getCurrentRoom(): ChatRoom | null {
    const config = getPlatformSelectorConfig("telegram")
    const titleEl = config.roomTitleSelector
      ? document.querySelector(config.roomTitleSelector)
      : null
    const name = titleEl ? extractCleanText(titleEl as HTMLElement) : "Telegram Chat"

    return {
      id: window.location.hash || "telegram-active-chat",
      name: name || "Telegram Chat",
      platform: "telegram",
    }
  }

  getInputElement(): HTMLElement | null {
    const config = getPlatformSelectorConfig("telegram")
    return document.querySelector<HTMLElement>(config.inputBoxSelector)
  }

  insertText(text: string): boolean {
    const input = this.getInputElement()
    if (!input) return false
    return insertTextIntoElement(input, text)
  }

  getMessageContainer(): HTMLElement | null {
    const config = getPlatformSelectorConfig("telegram")
    return (
      document.querySelector<HTMLElement>(config.messageListSelector) ||
      document.querySelector<HTMLElement>(".bubbles-inner, .bubbles-scrollable, .bubbles") ||
      null
    )
  }

  getMessages(limit = 50): ChatMessage[] {
    const config = getPlatformSelectorConfig("telegram")
    const container = this.getMessageContainer()
    if (!container) return []

    const items = container.querySelectorAll(config.messageItemSelector)
    const messages: ChatMessage[] = []

    items.forEach((item, index) => {
      const el = item as HTMLElement

      // Extract content
      let content = ""
      const contentEl = config.contentSelector ? el.querySelector(config.contentSelector) : null
      if (contentEl) {
        const clone = contentEl.cloneNode(true) as HTMLElement
        clone
          .querySelectorAll(".time, .bubble-tail, .bubble-gradient, .reply")
          .forEach((t) => t.remove())
        content = extractCleanText(clone)
      } else if (el.querySelector("img.media-photo")) {
        content = "[Hình ảnh]"
      } else if (el.querySelector(".document-name")) {
        const docName = extractCleanText(el.querySelector(".document-name") as HTMLElement)
        content = `[Tài liệu: ${docName}]`
      }
      if (!content) return

      // Extract own message status
      const isOwn =
        el.classList.contains("is-out") ||
        el.classList.contains("own") ||
        Boolean(
          config.ownMessageSelector &&
          (el.matches(config.ownMessageSelector) ||
            el.querySelector(config.ownMessageSelector) !== null),
        )

      // Extract author
      let author: string
      if (isOwn) {
        author = "Tôi"
      } else {
        const authorEl = config.authorSelector ? el.querySelector(config.authorSelector) : null
        const extracted = authorEl ? extractCleanText(authorEl as HTMLElement) : ""
        if (extracted) {
          author = extracted
        } else {
          const room = this.getCurrentRoom()
          author = room?.name && room.name !== "Telegram Chat" ? room.name : "Đối phương"
        }
      }

      // Stable deterministic ID
      const id =
        el.getAttribute("data-mid") || el.getAttribute("data-message-id") || `tg-msg-${index}`

      const tsAttr = el.getAttribute("data-timestamp")
      const timestamp = tsAttr ? Number(tsAttr) * 1000 : Date.now()

      messages.push({
        id,
        author,
        content,
        timestamp,
        isOwn,
        element: el,
      })
    })

    return limit ? messages.slice(-limit) : messages
  }

  getRecentMessages(n = 5): ChatMessage[] {
    const all = this.getMessages(n * 2)
    return all.slice(-n)
  }

  observeMessages(callback: (messages: ChatMessage[]) => void): () => void {
    const config = getPlatformSelectorConfig("telegram")
    const listContainer =
      document.querySelector(config.messageListSelector) ||
      document.querySelector(".bubbles-inner") ||
      document.querySelector(".bubbles-scrollable") ||
      document.body

    const observer = new MutationObserver(() => {
      callback(this.getMessages())
    })

    observer.observe(listContainer, { childList: true, subtree: true })
    return () => observer.disconnect()
  }
}
