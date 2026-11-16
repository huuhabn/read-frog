import type { ChatMessage, ChatRoom } from "../web-chat/adapter/types"
import type { WebChatRemoteConfig } from "../web-chat/remote-config/types"
import { browser } from "#imports"
import { createLogger } from "@/utils/logging/logger"
import { urlMatchesPattern } from "@/utils/url-pattern"
import { DEFAULT_PLATFORM_SELECTORS } from "../web-chat/remote-config/types"

const log = createLogger("sidepanel:web-chat")

/**
 * Checks whether a URL matches one of the supported web chat platforms
 * (Zalo, Telegram, Slack, or user-configured generic chat patterns).
 */
export function isSupportedChatUrl(url?: string, genericPatterns: string[] = []): boolean {
  if (!url) return false
  if (url.includes("zalo.me")) return true
  if (url.includes("telegram.org")) return true
  if (url.includes("slack.com")) return true
  if (genericPatterns && genericPatterns.length > 0) {
    return genericPatterns.some((pattern) => urlMatchesPattern(url, pattern))
  }
  return false
}

export async function getActiveChatMessagesFromTab(
  tabId: number,
  genericMatchUrls: string[] = [],
): Promise<{
  room: ChatRoom | null
  messages: ChatMessage[]
}> {
  // 1. Try communicating with content script runtime first
  try {
    const response: { room: ChatRoom | null; messages: ChatMessage[] } | undefined =
      await browser.tabs.sendMessage(tabId, {
        type: "WEB_CHAT_GET_ACTIVE_DATA",
      })

    if (response) {
      if (response.room === null) {
        return { room: null, messages: [] }
      }
      if (response.room && Array.isArray(response.messages)) {
        const sanitizedName = response.room.name?.trim()
        if (
          !sanitizedName ||
          sanitizedName.toLowerCase() === "undefined" ||
          sanitizedName.toLowerCase() === "null"
        ) {
          response.room.name =
            response.room.platform === "zalo" ? "Cuộc trò chuyện Zalo" : "Active Chat"
        }
        return response
      }
    }
  } catch {
    // Content script not ready or not loaded on this tab, fallback to direct executeScript
  }

  // 2. Fallback to direct executeScript with robust selectors
  try {
    const results = await browser.scripting.executeScript({
      target: { tabId },
      args: [DEFAULT_PLATFORM_SELECTORS, genericMatchUrls],
      func: (remoteConfig: WebChatRemoteConfig, genericPatterns: string[]) => {
        const url = window.location.href
        let platform: "zalo" | "telegram" | "slack" | "generic" | null = null
        if (url.includes("zalo.me")) platform = "zalo"
        else if (url.includes("telegram.org")) platform = "telegram"
        else if (url.includes("slack.com")) platform = "slack"
        else if (
          Array.isArray(genericPatterns) &&
          genericPatterns.some(
            (p) => p && url.includes(p.replace(/^\*:\/\//, "").replace(/\/\*$/, "")),
          )
        ) {
          platform = "generic"
        }

        if (!platform) {
          return { room: null, messages: [] }
        }

        const isValidName = (str: string | null | undefined): boolean => {
          if (!str) return false
          const trimmed = str.trim()
          return (
            trimmed.length > 0 &&
            trimmed.toLowerCase() !== "undefined" &&
            trimmed.toLowerCase() !== "null"
          )
        }

        const cleanText = (node: Element | null): string => {
          if (!node) return ""
          return (node.textContent || "")
            .replace(/\r\n/g, "\n")
            .replace(/[ \t]+/g, " ")
            .replace(/\n\s*\n/g, "\n")
            .trim()
        }

        let roomName = ""
        let roomId: string
        const msgs: Array<{
          id: string
          author: string
          content: string
          timestamp: number
          timeText?: string
          isOwn: boolean
        }> = []

        if (platform === "zalo") {
          // --- ZALO EXTRACTION ---
          const input =
            document.getElementById("richInput") || document.querySelector(".rich-input")
          const trailer = input?.getAttribute("data-trailer")
          if (isValidName(trailer)) {
            roomName = trailer!.trim()
          } else {
            const placeholder = input?.getAttribute("placeholder") || ""
            const match = placeholder.match(/tin nhắn tới\s+([^\n\r]+)/i)
            if (match?.[1] && isValidName(match[1])) {
              roomName = match[1].trim()
            }
          }

          if (!isValidName(roomName)) {
            const titleEl = document.querySelector(
              remoteConfig.platforms.zalo.roomTitleSelector ||
                "#header-title, .header-title, .chat-title, #chatName, .conversation-header__title, #conversation-header .title, .chat-header .title",
            )
            const text = cleanText(titleEl)
            if (isValidName(text)) roomName = text
          }

          if (!isValidName(roomName)) {
            const activeConv = document.querySelector(
              ".conv-item.active, .conv-item.selected, .chat-item.active",
            )
            const activeTitle = activeConv?.querySelector(".conv-item-title, .title, .truncate")
            const text = cleanText(activeTitle ?? null)
            if (isValidName(text)) roomName = text
          }

          if (!isValidName(roomName)) {
            roomName = "Cuộc trò chuyện Zalo"
          }

          // STRICT: message container must be within message view
          const container =
            document.getElementById("messageViewContainer") ||
            document.getElementById("messageViewScroll") ||
            document.getElementById("messageView") ||
            document.querySelector<HTMLElement>(".message-view__scroll__inner") ||
            document.querySelector<HTMLElement>(".message-view") ||
            null

          if (!container) {
            // Container not mounted, do not scrape sidebar
            return {
              room: { id: "zalo-chat", name: roomName, platform: "zalo" },
              messages: [],
            }
          }

          const sampleQid = container.querySelector("[data-qid]")?.getAttribute("data-qid")
          const convMatch = sampleQid?.match(/_([^_]+)$/)
          roomId = convMatch?.[1] ? `zalo-${convMatch[1]}` : `zalo-${roomName}`

          const rawItems = Array.from(
            container.querySelectorAll(
              remoteConfig.platforms.zalo.messageItemSelector || ".chat-item, .msg-item",
            ),
          )
          const items = rawItems.filter(
            (el) =>
              !el.parentElement?.closest(
                remoteConfig.platforms.zalo.messageItemSelector || ".chat-item, .msg-item",
              ),
          )

          const uidToName = new Map<string, string>()
          let lastOtherAuthor = ""

          items.forEach((item, index) => {
            const el = item as HTMLElement
            let content = ""
            const contentEl = el.querySelector(
              remoteConfig.platforms.zalo.contentSelector ||
                "[data-component='message-text-content'], .text-message__container, span.text",
            )
            if (contentEl) {
              const clone = contentEl.cloneNode(true) as HTMLElement
              clone
                .querySelectorAll(
                  ".card-send-time, .message-reaction-container, .floating-menu-wrapper, .message-quote-fragment__container",
                )
                .forEach((t) => t.remove())
              content = cleanText(clone)
            } else if (
              el.querySelector(
                "img.zimg-el, [data-component='photo'], .img-msg-v2, [data-id*='Msg_Photo'], .photo-message-v2",
              )
            ) {
              content = "[Hình ảnh]"
            }

            if (!content) return

            const isOwn =
              el.classList.contains("me") ||
              el.matches(".me, .message-wrapper--me, [data-id*='SentMsg']") ||
              el.querySelector(".me, .message-wrapper--me, [data-id*='SentMsg']") !== null ||
              Boolean(el.querySelector("[data-qid]")?.getAttribute("data-qid")?.includes("_0_"))
            let author: string
            if (isOwn) {
              author = "Tôi"
            } else {
              const authorEl = el.querySelector(
                remoteConfig.platforms.zalo.authorSelector ||
                  ".message-sender-name-content, .message-sender-name-wrapper .truncate, .sender-name, .chat-content .title, .card-sender-name",
              )
              const extracted = cleanText(authorEl)
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
                author = roomName !== "Cuộc trò chuyện Zalo" ? roomName : "Đối phương"
              }
            }

            const id =
              el.querySelector("[id^='bb_msg_id_']")?.id ||
              el.querySelector("[data-qid]")?.getAttribute("data-qid") ||
              el.querySelector("[id^='message-frame_']")?.id ||
              el.getAttribute("data-msgid") ||
              `zalo-msg-${index}`

            const timeEl = el.querySelector(
              remoteConfig.platforms.zalo.timestampSelector ||
                ".card-send-time__sendTime, .bubble-message-time, .time",
            )
            const timeText = cleanText(timeEl) || undefined

            msgs.push({
              id,
              author,
              content,
              timestamp: Date.now(),
              timeText,
              isOwn,
            })
          })
        } else if (platform === "telegram") {
          // --- TELEGRAM EXTRACTION ---
          const titleEl = document.querySelector(
            remoteConfig.platforms.telegram.roomTitleSelector ||
              ".chat-info .peer-title, .top .person .title, .chat-info h3",
          )
          const text = cleanText(titleEl)
          roomName = isValidName(text) ? text : "Telegram Chat"
          roomId = window.location.hash || "telegram-active-chat"

          const container = document.querySelector<HTMLElement>(
            remoteConfig.platforms.telegram.messageListSelector ||
              ".bubbles-inner, .bubbles-scrollable, .bubbles, .messages-container",
          )

          if (!container) {
            return {
              room: { id: roomId, name: roomName, platform: "telegram" },
              messages: [],
            }
          }

          const items = container.querySelectorAll(
            remoteConfig.platforms.telegram.messageItemSelector ||
              ".bubble[data-mid], .bubble:not(.service), [role='article'][data-mid]",
          )

          items.forEach((item, index) => {
            const el = item as HTMLElement
            let content = ""
            const contentEl = el.querySelector(
              remoteConfig.platforms.telegram.contentSelector ||
                "[data-message-text-source], .message, .translatable-message, .text-content",
            )
            if (contentEl) {
              const clone = contentEl.cloneNode(true) as HTMLElement
              clone
                .querySelectorAll(".time, .bubble-tail, .bubble-gradient, .reply")
                .forEach((t) => t.remove())
              content = cleanText(clone)
            } else if (el.querySelector("img.media-photo")) {
              content = "[Hình ảnh]"
            } else if (el.querySelector(".document-name")) {
              content = `[Tài liệu: ${cleanText(el.querySelector(".document-name"))}]`
            }

            if (!content) return

            const isOwn =
              el.classList.contains("is-out") ||
              el.classList.contains("own") ||
              Boolean(
                remoteConfig.platforms.telegram.ownMessageSelector &&
                el.matches(remoteConfig.platforms.telegram.ownMessageSelector),
              )

            let author: string
            if (isOwn) {
              author = "Tôi"
            } else {
              const authorEl = el.querySelector(
                remoteConfig.platforms.telegram.authorSelector || ".peer-title, .message-title",
              )
              const extracted = cleanText(authorEl)
              author = extracted || (roomName !== "Telegram Chat" ? roomName : "Đối phương")
            }

            const id =
              el.getAttribute("data-mid") || el.getAttribute("data-message-id") || `tg-msg-${index}`
            const tsAttr = el.getAttribute("data-timestamp")
            const timestamp = tsAttr ? Number(tsAttr) * 1000 : Date.now()
            const timeEl = el.querySelector(
              remoteConfig.platforms.telegram.timestampSelector || ".time .i18n, .time",
            )
            const timeText = cleanText(timeEl) || undefined

            msgs.push({
              id,
              author,
              content,
              timestamp,
              timeText,
              isOwn,
            })
          })
        } else if (platform === "slack") {
          // --- SLACK EXTRACTION ---
          const threadPane = document.querySelector<HTMLElement>(
            ".p-view_contents--secondary, [data-qa='threads_flexpane'], .p-threads_flexpane",
          )
          const activeEl = document.activeElement
          const isThreadFocused = Boolean(
            activeEl?.closest(
              ".p-view_contents--secondary, [data-qa='threads_flexpane'], .p-threads_flexpane",
            ),
          )

          const activeContainer =
            (isThreadFocused && threadPane) ||
            document.querySelector<HTMLElement>(".p-view_contents--primary, .p-message_pane") ||
            threadPane ||
            document.body

          const isThread = Boolean(
            activeContainer === threadPane ||
            activeContainer.closest(".p-view_contents--secondary, [data-qa='threads_flexpane']"),
          )

          const channelTitleEl = document.querySelector(
            ".p-view_contents--primary [data-qa='channel_name'], [data-qa='channel_name'], .p-view_header__member_name, .p-view_header__title",
          )
          const channelName = cleanText(channelTitleEl)

          if (isThread) {
            const threadComposer = activeContainer.querySelector("[data-qa='message_input']")
            const threadKey =
              threadComposer?.getAttribute("data-thread-key") ||
              threadComposer?.getAttribute("data-thread-ts")
            const secondaryAria = threadPane?.getAttribute("aria-label")
            let threadName = channelName ? `${channelName} (Thread)` : "Slack Thread"
            if (secondaryAria?.toLowerCase().startsWith("thread")) {
              threadName = secondaryAria
                .replace(/^Thread in conversation with @?/i, "Thread with ")
                .trim()
            }
            roomName = threadName
            roomId = threadKey ? `slack-thread-${threadKey}` : "slack-thread"
          } else {
            roomName = isValidName(channelName) ? channelName : "Slack Channel"
            roomId = window.location.pathname || "slack-active-chat"
          }

          const container = activeContainer.querySelector<HTMLElement>(
            remoteConfig.platforms.slack.messageListSelector ||
              "[data-qa='slack_kit_list'], .c-virtual_list__scroll_container, [data-qa='virtual-list']",
          )

          if (!container) {
            return {
              room: { id: roomId, name: roomName, platform: "slack" },
              messages: [],
            }
          }

          const items = container.querySelectorAll(
            remoteConfig.platforms.slack.messageItemSelector ||
              "[data-qa='message_container'], .c-message_kit__message",
          )

          let lastAuthor = roomName || "Slack User"

          items.forEach((item, index) => {
            const el = item as HTMLElement
            const contentEl = el.querySelector(
              remoteConfig.platforms.slack.contentSelector ||
                "[data-qa='message-text'], .p-rich_text_section",
            )
            let content = cleanText(contentEl)
            if (
              !content &&
              el.querySelector(
                "[data-qa='message_file_image_thumbnail'], .c-message_kit__file, img",
              )
            ) {
              content = "[Hình ảnh]"
            }
            if (!content) return

            const isOwn = el.classList.contains("c-message--own")
            const authorEl = el.querySelector(
              remoteConfig.platforms.slack.authorSelector ||
                "[data-qa='message_sender_name'], .c-message__sender_button",
            )
            const extractedAuthor = cleanText(authorEl)
            let author = isOwn ? "Tôi" : extractedAuthor
            if (!author) {
              author = lastAuthor
            } else if (!isOwn) {
              lastAuthor = author
            }

            const tsAttr = el.getAttribute("data-msg-ts")
            const timestamp = tsAttr ? Math.round(parseFloat(tsAttr) * 1000) : Date.now()
            const id = tsAttr || el.getAttribute("data-qa") || `slack-msg-${index}`

            const timeEl = el.querySelector(
              remoteConfig.platforms.slack.timestampSelector ||
                ".c-timestamp, [data-qa='timestamp_label']",
            )
            const timeText = cleanText(timeEl) || undefined

            msgs.push({
              id,
              author,
              content,
              timestamp,
              timeText,
              isOwn,
            })
          })
        } else {
          // --- GENERIC EXTRACTION ---
          roomName = isValidName(document.title) ? document.title.trim() : "Web Chat"
          roomId = window.location.pathname || "generic-chat"

          const container =
            document.querySelector<HTMLElement>(
              remoteConfig.platforms.generic.messageListSelector ||
                "[role='log'], [aria-label*='messages' i], .messages, .chat-box",
            ) || document.body

          const items = container.querySelectorAll(
            remoteConfig.platforms.generic.messageItemSelector ||
              "[role='listitem'], .message, .chat-message",
          )

          items.forEach((item, index) => {
            const el = item as HTMLElement
            const text = cleanText(el)
            if (!text || text.length < 2) return

            msgs.push({
              id: `generic-msg-${index}`,
              author: "Participant",
              content: text,
              timestamp: Date.now(),
              isOwn: false,
            })
          })
        }

        return {
          room: { id: roomId, name: roomName, platform },
          messages: msgs.slice(-50),
        }
      },
    })

    return (
      (results?.[0]?.result as { room: ChatRoom | null; messages: ChatMessage[] } | undefined) ?? {
        room: null,
        messages: [],
      }
    )
  } catch (error) {
    log.warn("Failed to get chat messages from active tab via executeScript", { error })
    return { room: null, messages: [] }
  }
}

export async function insertTextToActiveChatTab(
  tabId: number,
  text: string,
  options?: { autoSend?: boolean },
): Promise<boolean> {
  const shouldSend = options?.autoSend ?? false

  // 1. Try communicating with content script runtime first
  try {
    const response: { success?: boolean } | undefined = await browser.tabs.sendMessage(tabId, {
      type: "WEB_CHAT_INSERT_TEXT",
      text,
      autoSend: shouldSend,
    })

    if (response?.success) {
      return true
    }
  } catch {
    // Content script not ready or not loaded, fallback to executeScript
  }

  // 2. Fallback to direct executeScript
  try {
    const results = await browser.scripting.executeScript({
      target: { tabId },
      args: [text, shouldSend],
      func: (textToInsert: string, autoSend: boolean) => {
        // Zalo specific input
        const zaloInput =
          document.getElementById("richInput") ||
          document.querySelector<HTMLElement>(".rich-input") ||
          document.querySelector<HTMLElement>("#chat-input-content-id .rich-input") ||
          document.querySelector<HTMLElement>("#chat-input-container-id #richInput")

        const telegramInput =
          document.getElementById("editable-message-text") ||
          document.querySelector<HTMLElement>(".input-message-input") ||
          document.querySelector<HTMLElement>(".composer-text") ||
          document.querySelector<HTMLElement>(".input-message-container [contenteditable='true']")

        // Slack specific input (respecting thread vs channel active pane)
        const threadPane = document.querySelector<HTMLElement>(
          ".p-view_contents--secondary, [data-qa='threads_flexpane'], .p-threads_flexpane",
        )
        const isThreadFocused = Boolean(
          document.activeElement?.closest(
            ".p-view_contents--secondary, [data-qa='threads_flexpane'], .p-threads_flexpane",
          ),
        )
        const slackContainer =
          (isThreadFocused && threadPane) ||
          document.querySelector<HTMLElement>(".p-view_contents--primary, .p-message_pane") ||
          threadPane
        const slackInput = slackContainer?.querySelector<HTMLElement>(
          "[data-qa='message_input'] div[role='textbox'][contenteditable='true'], [data-qa='message_input'] .ql-editor",
        )

        const target =
          zaloInput ||
          telegramInput ||
          slackInput ||
          document.querySelector<HTMLElement>(
            "[contenteditable='true'], [contenteditable], textarea, [role='textbox']",
          )

        if (!target) return false

        if (target.getAttribute("contenteditable") === "false") {
          target.setAttribute("contenteditable", "true")
        }

        try {
          target.focus()
        } catch {
          // Ignore focus errors
        }

        const triggerSend = () => {
          if (!autoSend) return
          setTimeout(() => {
            // First check if slackContainer has a scoped send button
            if (slackContainer) {
              const scopedSend = slackContainer.querySelector<HTMLElement>(
                "[data-qa='texty_send_button']",
              )
              if (scopedSend) {
                scopedSend.removeAttribute("data-disabled")
                scopedSend.removeAttribute("disabled")
                scopedSend.click()
                return
              }
            }

            const sendSelectors = [
              // Telegram Web
              ".btn-send.send",
              "button.btn-send.send",
              ".btn-send-container button.send",
              "button.send[aria-label='Send']",
              ".btn-send-container button",
              "button[aria-label='Send']",
              ".btn-send-icon-send",
              // Zalo
              ".send-msg-btn",
              "[icon='Sent-msg_24_Line']",
              "[data-id='btn_RTF_Send']",
              "[data-translate-title='STR_SEND']",
              // Slack
              "[data-qa='texty_send_button']",
              // Generic
              "button[type='submit']",
              "[data-testid='send-button']",
              "button[aria-label*='Send' i]",
              "button[aria-label*='Gửi' i]",
            ]

            let sendBtn: HTMLElement | null = null
            for (const sel of sendSelectors) {
              const el = document.querySelector<HTMLElement>(sel)
              if (el) {
                sendBtn = el.tagName.toLowerCase() === "button" ? el : el.closest("button") || el
                break
              }
            }

            if (sendBtn) {
              sendBtn.removeAttribute("data-disabled")
              sendBtn.removeAttribute("disabled")
              const mouseInit = { bubbles: true, cancelable: true, composed: true }
              try {
                sendBtn.dispatchEvent(new PointerEvent("pointerdown", mouseInit))
                sendBtn.dispatchEvent(new PointerEvent("pointerup", mouseInit))
              } catch {}
              sendBtn.dispatchEvent(new MouseEvent("mousedown", mouseInit))
              sendBtn.dispatchEvent(new MouseEvent("mouseup", mouseInit))
              sendBtn.click()
              return
            }

            // Fallback Enter key
            const enterOpts = {
              key: "Enter",
              code: "Enter",
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true,
              composed: true,
              shiftKey: false,
              ctrlKey: false,
              altKey: false,
              metaKey: false,
            }
            target.dispatchEvent(new KeyboardEvent("keydown", enterOpts))
            try {
              target.dispatchEvent(new KeyboardEvent("keypress", enterOpts))
            } catch {}
            target.dispatchEvent(new KeyboardEvent("keyup", enterOpts))
          }, 150)
        }

        if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
          const start = target.selectionStart ?? target.value.length
          const end = target.selectionEnd ?? target.value.length
          target.value =
            target.value.substring(0, start) + textToInsert + target.value.substring(end)
          target.selectionStart = target.selectionEnd = start + textToInsert.length
          target.dispatchEvent(new Event("input", { bubbles: true }))
          target.dispatchEvent(new Event("change", { bubbles: true }))
          triggerSend()
          return true
        }

        if (target.isContentEditable || target.getAttribute("contenteditable") === "true") {
          try {
            const success = document.execCommand?.("insertText", false, textToInsert)
            if (success) {
              target.classList.remove("empty")
              target.dispatchEvent(new Event("input", { bubbles: true }))
              target.dispatchEvent(new Event("change", { bubbles: true }))
              triggerSend()
              return true
            }
          } catch {
            // Fallback
          }

          try {
            const textNode = document.createTextNode(textToInsert)
            target.appendChild(textNode)
            target.classList.remove("empty")
            target.dispatchEvent(new Event("input", { bubbles: true }))
            target.dispatchEvent(new Event("change", { bubbles: true }))
            triggerSend()
            return true
          } catch {
            // Fallback
          }
        }

        return false
      },
    })

    return Boolean(results?.[0]?.result)
  } catch (error) {
    log.warn("Failed to insert text to active chat tab via executeScript", { error })
    return false
  }
}
