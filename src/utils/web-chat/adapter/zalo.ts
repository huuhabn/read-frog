import type { ChatMessage, ChatRoom, IChatAdapter } from "./types"
import { getPlatformSelectorConfig } from "../remote-config/loader"
import { extractCleanText, insertTextIntoElement, triggerDOMSend } from "./dom-utils"

export class ZaloChatAdapter implements IChatAdapter {
  readonly platform = "zalo"

  matches(url: string): boolean {
    return url.includes("chat.zalo.me") || url.includes("zalo.me")
  }

  getCurrentRoom(): ChatRoom | null {
    const config = getPlatformSelectorConfig("zalo")
    let name = ""

    const isValidName = (str: string | null | undefined): boolean => {
      if (!str) return false
      const trimmed = str.trim()
      return (
        trimmed.length > 0 &&
        trimmed !== "undefined" &&
        trimmed !== "null" &&
        trimmed.toLowerCase() !== "undefined" &&
        trimmed.toLowerCase() !== "null"
      )
    }

    // 1. Check richInput data-trailer / placeholder (Zalo sets recipient/group name here)
    const input = document.getElementById("richInput") || document.querySelector(".rich-input")
    const trailer = input?.getAttribute("data-trailer")
    if (isValidName(trailer)) {
      name = trailer!.trim()
    } else {
      const placeholder = input?.getAttribute("placeholder") || ""
      const match = placeholder.match(/tin nhắn tới\s+([^\n\r]+)/i)
      if (match?.[1] && isValidName(match[1])) {
        name = match[1].trim()
      }
    }

    // 2. Check title from header
    if (!isValidName(name) && config.roomTitleSelector) {
      const titleEl = document.querySelector(config.roomTitleSelector)
      if (titleEl) {
        const text = extractCleanText(titleEl as HTMLElement)
        if (isValidName(text)) {
          name = text
        }
      }
    }

    // 3. Check active conversation in sidebar
    if (!isValidName(name)) {
      const activeConv = document.querySelector(
        ".conv-item.active, .conv-item.selected, .chat-item.active",
      )
      const activeTitle = activeConv?.querySelector(".conv-item-title, .title, .truncate")
      if (activeTitle) {
        const text = extractCleanText(activeTitle as HTMLElement)
        if (isValidName(text)) {
          name = text
        }
      }
    }

    // 4. Extract conversation/group ID from data-qid in message container if available
    let convId = ""
    const container = this.getMessageContainer()
    if (container) {
      const sampleQid = container.querySelector("[data-qid]")?.getAttribute("data-qid")
      const match = sampleQid?.match(/_([^_]+)$/)
      if (match?.[1]) {
        convId = match[1]
      }
    }

    const roomId = convId
      ? `zalo-${convId}`
      : isValidName(name)
        ? `zalo-${name}`
        : "zalo-active-chat"

    return {
      id: roomId,
      name: isValidName(name) ? name : "Cuộc trò chuyện Zalo",
      platform: "zalo",
    }
  }

  getMessageContainer(): HTMLElement | null {
    const config = getPlatformSelectorConfig("zalo")
    return (
      document.getElementById("messageViewContainer") ||
      document.getElementById("messageViewScroll") ||
      document.getElementById("messageView") ||
      document.querySelector<HTMLElement>(config.messageListSelector) ||
      document.querySelector<HTMLElement>(".message-view") ||
      null
    )
  }

  getInputElement(): HTMLElement | null {
    const config = getPlatformSelectorConfig("zalo")
    const primary = document.querySelector<HTMLElement>(config.inputBoxSelector)
    if (primary) return primary

    return (
      document.getElementById("richInput") ||
      document.querySelector<HTMLElement>("#chat-input-content-id .rich-input") ||
      document.querySelector<HTMLElement>("#chat-input-container-id #richInput") ||
      document.querySelector<HTMLElement>("#chat-input-container-id [contenteditable]") ||
      document.querySelector<HTMLElement>("[data-keybinding-context*='mainChatInputFocus']") ||
      null
    )
  }

  insertText(text: string, options?: { autoSend?: boolean }): boolean {
    const input = this.getInputElement()
    if (!input) return false

    // Zalo sets contenteditable="false" on #richInput when idle/empty.
    // Ensure it is editable and focused before inserting text.
    if (input.getAttribute("contenteditable") === "false") {
      input.setAttribute("contenteditable", "true")
    }

    try {
      input.focus()
    } catch {
      // Focus may throw in some environments
    }

    const success = insertTextIntoElement(input, text)

    if (success && text.trim().length > 0) {
      input.classList.remove("empty")
    }

    if (success && options?.autoSend) {
      setTimeout(() => {
        this.submitSend()
      }, 150)
    }

    return success
  }

  submitSend(): boolean {
    const config = getPlatformSelectorConfig("zalo")
    const input = this.getInputElement()
    const sent = triggerDOMSend(input, config.sendButtonSelector)
    if (!sent && input) {
      setTimeout(() => {
        triggerDOMSend(input, config.sendButtonSelector)
      }, 120)
    }
    return sent
  }

  getMessages(limit = 50): ChatMessage[] {
    const config = getPlatformSelectorConfig("zalo")
    const container = this.getMessageContainer()
    // STRICT: Only extract messages from inside the active chat message container (#messageViewContainer)
    // Never query document globally to avoid picking up group/conversation items from the left sidebar!
    if (!container) return []

    const rawItems = Array.from(container.querySelectorAll(config.messageItemSelector))
    // Filter out nested items so parent and child are not double-counted
    const items = rawItems.filter((el) => !el.parentElement?.closest(config.messageItemSelector))
    const messages: ChatMessage[] = []
    const uidToName = new Map<string, string>()
    let lastOtherAuthor = ""

    items.forEach((item, index) => {
      const el = item as HTMLElement

      // Extract content
      let content = ""
      const contentEl = config.contentSelector ? el.querySelector(config.contentSelector) : null
      if (contentEl) {
        const clone = contentEl.cloneNode(true) as HTMLElement
        clone
          .querySelectorAll(
            ".card-send-time, .message-reaction-container, .floating-menu-wrapper, .message-quote-fragment__container",
          )
          .forEach((t) => t.remove())
        content = extractCleanText(clone)
      } else if (
        el.querySelector(
          "img.zimg-el, [data-component='photo'], .img-msg-v2, [data-id*='Msg_Photo'], .photo-message-v2",
        )
      ) {
        content = "[Hình ảnh]"
      }
      if (!content) return

      // Extract own message status
      const isOwn =
        el.classList.contains("me") ||
        Boolean(
          config.ownMessageSelector &&
          (el.matches(config.ownMessageSelector) ||
            el.querySelector(config.ownMessageSelector) !== null),
        ) ||
        Boolean(el.querySelector("[data-qid]")?.getAttribute("data-qid")?.includes("_0_"))

      // Extract author
      let author: string
      if (isOwn) {
        author = "Tôi"
      } else {
        const authorEl = config.authorSelector ? el.querySelector(config.authorSelector) : null
        const extracted = authorEl ? extractCleanText(authorEl as HTMLElement) : ""
        const qid = el.querySelector("[data-qid]")?.getAttribute("data-qid") || ""
        const uidMatch = qid.match(/@\d+_([^_]+)_/)
        const senderUid =
          uidMatch?.[1] || el.querySelector("[data-ava-uid]")?.getAttribute("data-ava-uid")

        if (extracted) {
          author = extracted
          if (senderUid) uidToName.set(senderUid, extracted)
          lastOtherAuthor = extracted
        } else if (senderUid && uidToName.has(senderUid)) {
          author = uidToName.get(senderUid)!
        } else if (lastOtherAuthor) {
          author = lastOtherAuthor
        } else {
          const room = this.getCurrentRoom()
          author =
            room?.name && room.name !== "Zalo Conversation" && room.name !== "Zalo Chat"
              ? room.name
              : "Đối phương"
        }
      }

      // Stable deterministic ID
      const id =
        el.querySelector("[id^='bb_msg_id_']")?.id ||
        el.querySelector("[data-qid]")?.getAttribute("data-qid") ||
        el.querySelector("[id^='message-frame_']")?.id ||
        el.getAttribute("data-msgid") ||
        `zalo-msg-${index}`

      // Extract time
      const timeEl = config.timestampSelector ? el.querySelector(config.timestampSelector) : null
      const timeText = timeEl ? extractCleanText(timeEl as HTMLElement) : undefined

      messages.push({
        id,
        author,
        content,
        timestamp: Date.now(),
        timeText,
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
    const getTargetContainer = () => this.getMessageContainer()
    let listContainer = getTargetContainer()

    let bodyObserver: MutationObserver | null = null
    let messageObserver: MutationObserver | null = null

    const attachMessageObserver = (target: HTMLElement) => {
      messageObserver?.disconnect()
      messageObserver = new MutationObserver(() => {
        callback(this.getMessages())
      })
      messageObserver.observe(target, { childList: true, subtree: true })
    }

    if (listContainer) {
      attachMessageObserver(listContainer)
    }

    // Watch for active chat room switches / container mount in body
    bodyObserver = new MutationObserver(() => {
      const current = getTargetContainer()
      if (current && current !== listContainer) {
        listContainer = current
        attachMessageObserver(listContainer)
        callback(this.getMessages())
      }
    })
    bodyObserver.observe(document.body, { childList: true, subtree: true })

    return () => {
      messageObserver?.disconnect()
      bodyObserver?.disconnect()
    }
  }
}
