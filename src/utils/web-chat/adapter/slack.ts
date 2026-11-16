import type { ChatMessage, ChatRoom, IChatAdapter } from "./types"
import { getPlatformSelectorConfig } from "../remote-config/loader"
import { extractCleanText, insertTextIntoElement, triggerDOMSend } from "./dom-utils"

export type SlackPaneType = "channel" | "thread"

export class SlackChatAdapter implements IChatAdapter {
  readonly platform = "slack"

  private lastActivePane: SlackPaneType = "channel"
  private cleanupListeners?: () => void

  constructor() {
    this.initFocusTracker()
  }

  /**
   * Initializes event listeners to track user focus/clicks between Channel and Thread panes.
   */
  private initFocusTracker(): void {
    if (typeof document === "undefined") return

    const handleInteraction = (e: Event) => {
      const target = e.target as HTMLElement | null
      if (!target) return

      if (
        target.closest(
          ".p-view_contents--secondary, [data-qa='threads_flexpane'], .p-threads_flexpane",
        )
      ) {
        this.lastActivePane = "thread"
      } else if (target.closest(".p-view_contents--primary, .p-message_pane")) {
        this.lastActivePane = "channel"
      }
    }

    document.addEventListener("focusin", handleInteraction, { capture: true, passive: true })
    document.addEventListener("pointerdown", handleInteraction, { capture: true, passive: true })

    this.cleanupListeners = () => {
      document.removeEventListener("focusin", handleInteraction, { capture: true })
      document.removeEventListener("pointerdown", handleInteraction, { capture: true })
    }
  }

  destroy(): void {
    this.cleanupListeners?.()
  }

  matches(url: string): boolean {
    return url.includes("app.slack.com") || url.includes("slack.com")
  }

  /**
   * Determines active pane based on user interaction/focus and current DOM state.
   */
  getActivePane(): SlackPaneType {
    if (typeof document === "undefined") return "channel"

    const threadPane = document.querySelector(
      ".p-view_contents--secondary, [data-qa='threads_flexpane'], .p-threads_flexpane",
    )
    if (!threadPane) {
      this.lastActivePane = "channel"
      return "channel"
    }

    // Check if the currently focused element is explicitly inside one of the panes
    const activeEl = document.activeElement
    if (activeEl) {
      if (
        activeEl.closest(
          ".p-view_contents--secondary, [data-qa='threads_flexpane'], .p-threads_flexpane",
        )
      ) {
        this.lastActivePane = "thread"
        return "thread"
      }
      if (activeEl.closest(".p-view_contents--primary, .p-message_pane")) {
        this.lastActivePane = "channel"
        return "channel"
      }
    }

    return this.lastActivePane
  }

  /**
   * Gets the root DOM container for the active pane (Primary Channel vs Secondary Thread).
   */
  getActiveContainer(): HTMLElement | null {
    if (typeof document === "undefined") return null

    const pane = this.getActivePane()
    if (pane === "thread") {
      return (
        document.querySelector<HTMLElement>(
          ".p-view_contents--secondary, [data-qa='threads_flexpane'], .p-threads_flexpane",
        ) || null
      )
    }

    return document.querySelector<HTMLElement>(".p-view_contents--primary, .p-message_pane") || null
  }

  getCurrentRoom(): ChatRoom | null {
    if (typeof document === "undefined") return null

    const pane = this.getActivePane()
    const container = this.getActiveContainer()

    // Extract base Channel Name
    const channelTitleEl = document.querySelector(
      ".p-view_contents--primary [data-qa='channel_name'], [data-qa='channel_name'], .p-view_header__member_name, .p-view_header__title",
    )
    const channelName = channelTitleEl ? extractCleanText(channelTitleEl as HTMLElement) : ""

    if (pane === "thread" && container) {
      // Thread Mode
      const threadComposer = container.querySelector("[data-qa='message_input']")
      const channelId =
        threadComposer?.getAttribute("data-channel-id") ||
        this.extractChannelIdFromUrl() ||
        "slack-channel"
      const threadTs = threadComposer?.getAttribute("data-thread-ts") || ""
      const threadKey =
        threadComposer?.getAttribute("data-thread-key") ||
        (threadTs ? `${channelId}-${threadTs}` : "")

      // Thread title from container aria-label or fallback to Channel Name (Thread)
      const secondaryAria = container.getAttribute("aria-label")
      let threadName = channelName ? `${channelName} (Thread)` : "Slack Thread"

      if (secondaryAria?.toLowerCase().startsWith("thread")) {
        threadName = secondaryAria
          .replace(/^Thread in conversation with @?/i, "Thread with ")
          .trim()
      }

      return {
        id: threadKey ? `slack-thread-${threadKey}` : `slack-thread-${channelId}`,
        name: threadName || "Slack Thread",
        platform: "slack",
      }
    }

    // Channel Mode
    const channelId = this.extractChannelIdFromUrl() || window.location.pathname || "slack-channel"

    return {
      id: channelId,
      name: channelName || "Slack Channel",
      platform: "slack",
    }
  }

  private extractChannelIdFromUrl(): string | null {
    if (typeof window === "undefined") return null
    // e.g. /client/T1234/C5678 or /archives/D0A7XP6J00J
    const match = window.location.pathname.match(/\/(?:client\/[^/]+\/|archives\/)([A-Z0-9]+)/i)
    return match?.[1] ?? null
  }

  getInputElement(): HTMLElement | null {
    const container =
      this.getActiveContainer() || (typeof document !== "undefined" ? document : null)
    if (!container) return null

    return (
      container.querySelector<HTMLElement>(
        "[data-qa='message_input'] div[role='textbox'][contenteditable='true']",
      ) ||
      container.querySelector<HTMLElement>("[data-qa='message_input'] .ql-editor") ||
      container.querySelector<HTMLElement>("div[role='textbox'][contenteditable='true']") ||
      null
    )
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
    const container =
      this.getActiveContainer() || (typeof document !== "undefined" ? document : null)
    const input = this.getInputElement()
    const config = getPlatformSelectorConfig("slack")
    const sendButtonSelector = config.sendButtonSelector || "[data-qa='texty_send_button']"

    // Prioritize clicking send button within active container
    let sent: boolean
    const scopedSendButton = container?.querySelector<HTMLElement>(sendButtonSelector)
    if (scopedSendButton) {
      scopedSendButton.removeAttribute("disabled")
      scopedSendButton.removeAttribute("data-disabled")
      scopedSendButton.click()
      sent = true
    } else {
      sent = triggerDOMSend(input, sendButtonSelector)
    }

    if (!sent && input) {
      setTimeout(() => {
        const retryBtn = container?.querySelector<HTMLElement>(sendButtonSelector)
        if (retryBtn) {
          retryBtn.removeAttribute("disabled")
          retryBtn.click()
        } else {
          triggerDOMSend(input, sendButtonSelector)
        }
      }, 120)
    }

    return sent
  }

  getMessageContainer(): HTMLElement | null {
    const container =
      this.getActiveContainer() || (typeof document !== "undefined" ? document : null)
    if (!container) return null

    return (
      container.querySelector<HTMLElement>(
        "[data-qa='slack_kit_list'], .c-virtual_list__scroll_container, #message-list",
      ) ||
      container.querySelector<HTMLElement>("[data-qa='virtual-list']") ||
      null
    )
  }

  getMessages(limit = 50): ChatMessage[] {
    const container = this.getMessageContainer()
    if (!container) return []

    const config = getPlatformSelectorConfig("slack")
    const itemSelector =
      config.messageItemSelector || "[data-qa='message_container'], .c-message_kit__message"
    const items = container.querySelectorAll(itemSelector)
    const messages: ChatMessage[] = []
    let lastAuthor = "Slack User"

    items.forEach((item, index) => {
      const el = item as HTMLElement
      const contentEl = el.querySelector(
        config.contentSelector || "[data-qa='message-text'], .p-rich_text_section",
      )
      let content = contentEl ? extractCleanText(contentEl as HTMLElement) : ""

      // If no text, check for image or file attachment
      if (
        !content &&
        el.querySelector("[data-qa='message_file_image_thumbnail'], .c-message_kit__file, img")
      ) {
        const fileNameEl = el.querySelector("[data-qa='file_name']")
        content = fileNameEl
          ? `[File: ${extractCleanText(fileNameEl as HTMLElement)}]`
          : "[Hình ảnh]"
      }

      if (!content) return

      const authorEl = el.querySelector(
        config.authorSelector || "[data-qa='message_sender_name'], .c-message__sender_button",
      )
      let author = authorEl ? extractCleanText(authorEl as HTMLElement) : ""
      if (author) {
        lastAuthor = author
      } else {
        // Compact layout adjacent message by the same sender
        author = lastAuthor
      }

      const isOwn =
        Boolean(config.ownMessageSelector && el.matches(config.ownMessageSelector)) ||
        el.classList.contains("c-message--own")

      // Extract precise timestamp from data-msg-ts (seconds float, e.g. "1794384937.794189")
      const tsAttr = el.getAttribute("data-msg-ts")
      const timestamp = tsAttr ? Math.round(parseFloat(tsAttr) * 1000) : Date.now()

      const timeEl = el.querySelector(
        config.timestampSelector || ".c-timestamp, [data-qa='timestamp_label']",
      )
      const timeText = timeEl ? extractCleanText(timeEl as HTMLElement) : undefined

      const id =
        tsAttr ||
        el.closest(".c-virtual_list__item")?.id ||
        el.getAttribute("data-qa-message-id") ||
        `slack-msg-${index}`

      messages.push({
        id,
        author: author || "Slack User",
        content,
        timestamp,
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
    if (typeof document === "undefined") return () => {}

    const emit = () => {
      callback(this.getMessages())
    }

    const observer = new MutationObserver(() => {
      emit()
    })

    // Observe document body with subtree to capture changes in either channel or thread
    const target =
      document.querySelector(".p-client_workspace__layout, .p-view_contents") || document.body

    observer.observe(target, { childList: true, subtree: true })

    // Also trigger update on focus/click transitions between channel and thread
    const onPaneSwitch = () => {
      setTimeout(emit, 50)
    }

    document.addEventListener("focusin", onPaneSwitch, { capture: true, passive: true })

    return () => {
      observer.disconnect()
      document.removeEventListener("focusin", onPaneSwitch, { capture: true })
    }
  }
}
