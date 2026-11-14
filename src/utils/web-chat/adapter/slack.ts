import type { ChatMessage, ChatRoom, IChatAdapter } from "./types"
import { getPlatformSelectorConfig } from "../remote-config/loader"
import { extractCleanText, insertTextIntoElement, triggerDOMSend } from "./dom-utils"

export class SlackChatAdapter implements IChatAdapter {
  readonly platform = "slack"

  matches(url: string): boolean {
    return url.includes("app.slack.com")
  }

  getCurrentRoom(): ChatRoom | null {
    const config = getPlatformSelectorConfig("slack")
    const titleEl = config.roomTitleSelector
      ? document.querySelector(config.roomTitleSelector)
      : null
    const name = titleEl ? extractCleanText(titleEl as HTMLElement) : "Slack Channel"

    return {
      id: window.location.pathname || "slack-active-channel",
      name: name || "Slack Channel",
      platform: "slack",
    }
  }

  getInputElement(): HTMLElement | null {
    const config = getPlatformSelectorConfig("slack")
    return document.querySelector<HTMLElement>(config.inputBoxSelector)
  }

  insertText(text: string, options?: { autoSend?: boolean }): boolean {
    const input = this.getInputElement()
    if (!input) return false
    const success = insertTextIntoElement(input, text)
    if (success && options?.autoSend) {
      setTimeout(() => {
        this.submitSend()
      }, 150)
    }
    return success
  }

  submitSend(): boolean {
    const config = getPlatformSelectorConfig("slack")
    const input = this.getInputElement()
    const sent = triggerDOMSend(input, config.sendButtonSelector)
    if (!sent && input) {
      setTimeout(() => {
        triggerDOMSend(input, config.sendButtonSelector)
      }, 120)
    }
    return sent
  }

  getMessageContainer(): HTMLElement | null {
    const config = getPlatformSelectorConfig("slack")
    return (
      document.querySelector<HTMLElement>(config.messageListSelector) ||
      document.querySelector<HTMLElement>("[data-qa='virtual-list']") ||
      null
    )
  }

  getMessages(limit = 50): ChatMessage[] {
    const config = getPlatformSelectorConfig("slack")
    const container = this.getMessageContainer()
    if (!container) return []

    const items = container.querySelectorAll(config.messageItemSelector)
    const messages: ChatMessage[] = []

    items.forEach((item, index) => {
      const el = item as HTMLElement
      const contentEl = config.contentSelector ? el.querySelector(config.contentSelector) : el
      const content = extractCleanText((contentEl || el) as HTMLElement)
      if (!content) return

      const authorEl = config.authorSelector ? el.querySelector(config.authorSelector) : null
      const author = authorEl ? extractCleanText(authorEl as HTMLElement) : "Slack User"

      const isOwn =
        Boolean(config.ownMessageSelector) &&
        (el.matches(config.ownMessageSelector!) || el.closest(config.ownMessageSelector!) !== null)

      const id = el.getAttribute("data-qa-message-id") || `slack-msg-${index}-${Date.now()}`

      messages.push({
        id,
        author,
        content,
        timestamp: Date.now(),
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
    const config = getPlatformSelectorConfig("slack")
    const listContainer = document.querySelector(config.messageListSelector) || document.body

    const observer = new MutationObserver(() => {
      callback(this.getMessages())
    })

    observer.observe(listContainer, { childList: true, subtree: true })
    return () => observer.disconnect()
  }
}
