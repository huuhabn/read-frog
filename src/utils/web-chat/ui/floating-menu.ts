import { i18n } from "@/utils/i18n"
import { getAdapterForUrl } from "../adapter/registry"
import {
  generateSmartReply,
  rewriteChatText,
  type RewriteTone,
  translateChatText,
} from "../ai/service"

export class FloatingChatMenu {
  private host: HTMLElement | null = null
  private shadow: ShadowRoot | null = null
  private selectedText = ""
  private currentRange: Range | null = null
  private isPopoverOpen = false
  private cleanups: (() => void)[] = []

  init(): void {
    const handleMouseUp = (e: MouseEvent) => {
      // Ignore clicks inside our own menu
      if (this.host?.contains(e.target as Node)) {
        return
      }

      setTimeout(() => {
        const selection = window.getSelection()
        if (!selection || selection.isCollapsed) {
          if (!this.isPopoverOpen) this.hide()
          return
        }

        const text = selection.toString().trim()
        if (text.length < 2) {
          if (!this.isPopoverOpen) this.hide()
          return
        }

        this.selectedText = text
        this.currentRange = selection.getRangeAt(0).cloneRange()
        this.showCompactBar(this.currentRange)
      }, 50)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        this.hide()
      }
    }

    const handleScroll = () => {
      if (!this.isPopoverOpen) {
        this.hide()
      }
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (this.host && !this.host.contains(e.target as Node) && !this.isPopoverOpen) {
        this.hide()
      }
    }

    document.addEventListener("mouseup", handleMouseUp)
    document.addEventListener("keydown", handleKeyDown)
    window.addEventListener("scroll", handleScroll, true)
    document.addEventListener("mousedown", handleMouseDown)

    this.cleanups.push(() => {
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("scroll", handleScroll, true)
      document.removeEventListener("mousedown", handleMouseDown)
    })
  }

  private ensureHost(): ShadowRoot {
    if (this.host && this.shadow) {
      return this.shadow
    }

    const host = document.createElement("div")
    host.className = "wm-floating-chat-menu-host"
    host.style.position = "absolute"
    host.style.zIndex = "2147483647" // Max z-index
    host.style.display = "none"

    const shadow = host.attachShadow({ mode: "open" })
    const style = document.createElement("style")
    style.textContent = `
      * { box-sizing: border-box; }
      .wm-bar {
        display: flex;
        align-items: center;
        background: #0f172a;
        color: #f8fafc;
        border: 1px solid #334155;
        border-radius: 8px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
        padding: 4px;
        gap: 2px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 12px;
        white-space: nowrap;
        user-select: none;
      }
      .wm-btn {
        background: transparent;
        color: #e2e8f0;
        border: none;
        border-radius: 6px;
        padding: 5px 8px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        font-weight: 500;
        transition: background 0.15s;
      }
      .wm-btn:hover {
        background: #1e293b;
        color: #38bdf8;
      }
      .wm-popover {
        margin-top: 6px;
        background: #0f172a;
        color: #f8fafc;
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 10px 12px;
        width: 320px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
        font-size: 13px;
        line-height: 1.45;
      }
      .wm-popover-title {
        font-size: 11px;
        text-transform: uppercase;
        color: #94a3b8;
        font-weight: 600;
        margin-bottom: 6px;
        display: flex;
        justify-content: space-between;
      }
      .wm-popover-body {
        margin-bottom: 8px;
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 180px;
        overflow-y: auto;
      }
      .wm-popover-footer {
        display: flex;
        justify-content: flex-end;
        gap: 6px;
        padding-top: 6px;
        border-top: 1px solid #1e293b;
      }
      .wm-action-btn {
        background: #2563eb;
        color: #ffffff;
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 11px;
        cursor: pointer;
        font-weight: 500;
      }
      .wm-action-btn:hover {
        background: #1d4ed8;
      }
      .wm-secondary-btn {
        background: #334155;
        color: #cbd5e1;
      }
      .wm-secondary-btn:hover {
        background: #475569;
      }
      .wm-loading {
        color: #94a3b8;
        font-style: italic;
      }
    `
    shadow.appendChild(style)

    document.body.appendChild(host)
    this.host = host
    this.shadow = shadow
    return shadow
  }

  showCompactBar(range: Range): void {
    const shadow = this.ensureHost()
    if (!this.host) return

    this.isPopoverOpen = false

    // Clean old elements
    const oldBar = shadow.querySelector(".wm-bar")
    const oldPopover = shadow.querySelector(".wm-popover")
    if (oldBar) oldBar.remove()
    if (oldPopover) oldPopover.remove()

    const bar = document.createElement("div")
    bar.className = "wm-bar"

    // 1. Dịch
    const translateBtn = document.createElement("button")
    translateBtn.className = "wm-btn"
    translateBtn.innerHTML = i18n.t("options.webChat.floatingMenu.translate")
    translateBtn.onclick = () => void this.handleTranslateAction()

    // 2. Viết lại
    const rewriteBtn = document.createElement("button")
    rewriteBtn.className = "wm-btn"
    rewriteBtn.innerHTML = i18n.t("options.webChat.floatingMenu.rewrite")
    rewriteBtn.onclick = () => void this.handleRewriteAction()

    // 3. Trả lời
    const replyBtn = document.createElement("button")
    replyBtn.className = "wm-btn"
    replyBtn.innerHTML = i18n.t("options.webChat.floatingMenu.reply")
    replyBtn.onclick = () => void this.handleReplyAction()

    // 4. Hỏi AI
    const askBtn = document.createElement("button")
    askBtn.className = "wm-btn"
    askBtn.innerHTML = i18n.t("options.webChat.floatingMenu.askAi")
    askBtn.onclick = () => void this.handleAskAction()

    bar.appendChild(translateBtn)
    bar.appendChild(rewriteBtn)
    bar.appendChild(replyBtn)
    bar.appendChild(askBtn)

    shadow.appendChild(bar)

    this.positionAtRange(range)
    this.host.style.display = "block"
  }

  private positionAtRange(range: Range): void {
    if (!this.host) return

    const rect = range.getBoundingClientRect()
    let top = rect.top + window.scrollY - 42
    let left = rect.left + window.scrollX + rect.width / 2 - 120

    // Auto-flip if too close to top
    if (rect.top < 50) {
      top = rect.bottom + window.scrollY + 8
    }

    // Horizontal boundary clamping
    left = Math.max(10, Math.min(left, window.innerWidth - 320))

    this.host.style.top = `${top}px`
    this.host.style.left = `${left}px`
  }

  private showPopover(
    title: string,
    initialContent: string,
  ): {
    setContent: (content: string) => void
    setFooter: (actions: HTMLElement[]) => void
  } {
    const shadow = this.ensureHost()
    this.isPopoverOpen = true

    const oldPopover = shadow.querySelector(".wm-popover")
    if (oldPopover) oldPopover.remove()

    const popover = document.createElement("div")
    popover.className = "wm-popover"

    const header = document.createElement("div")
    header.className = "wm-popover-title"
    header.innerHTML = `<span>${title}</span><span style="cursor:pointer;" id="wm-close">✕</span>`

    const body = document.createElement("div")
    body.className = "wm-popover-body"
    body.textContent = initialContent

    const footer = document.createElement("div")
    footer.className = "wm-popover-footer"

    popover.appendChild(header)
    popover.appendChild(body)
    popover.appendChild(footer)

    shadow.appendChild(popover)

    header.querySelector("#wm-close")?.addEventListener("click", () => {
      this.hide()
    })

    return {
      setContent(text: string) {
        body.textContent = text
      },
      setFooter(actionElements: HTMLElement[]) {
        footer.innerHTML = ""
        actionElements.forEach((el) => footer.appendChild(el))
      },
    }
  }

  private async handleTranslateAction(): Promise<void> {
    const pop = this.showPopover(
      i18n.t("options.webChat.floatingMenu.translate"),
      i18n.t("options.webChat.floatingMenu.translating"),
    )
    try {
      const adapter = getAdapterForUrl()
      const res = await translateChatText({
        text: this.selectedText,
        targetLang: "vi",
        sourceFeature: "Web Chat (Floating Menu Translate)",
      })

      pop.setContent(res)

      const replaceBtn = document.createElement("button")
      replaceBtn.className = "wm-action-btn wm-secondary-btn"
      replaceBtn.textContent = i18n.t("options.webChat.floatingMenu.replace")
      replaceBtn.onclick = () => {
        this.replaceSelectedText(res)
        this.hide()
      }

      const insertBtn = document.createElement("button")
      insertBtn.className = "wm-action-btn"
      insertBtn.textContent = i18n.t("options.webChat.floatingMenu.insertToChat")
      insertBtn.onclick = () => {
        adapter?.insertText(res)
        this.hide()
      }

      pop.setFooter([replaceBtn, insertBtn])
    } catch {
      pop.setContent(i18n.t("options.webChat.floatingMenu.error"))
    }
  }

  private async handleRewriteAction(tone: RewriteTone = "professional"): Promise<void> {
    const pop = this.showPopover(
      i18n.t("options.webChat.floatingMenu.rewrite"),
      i18n.t("options.webChat.floatingMenu.rewriting"),
    )
    try {
      const rewritten = await rewriteChatText(this.selectedText, tone, {
        sourceFeature: `Web Chat (Floating Menu Rewrite - ${tone})`,
      })
      pop.setContent(rewritten)

      const replaceBtn = document.createElement("button")
      replaceBtn.className = "wm-action-btn wm-secondary-btn"
      replaceBtn.textContent = i18n.t("options.webChat.floatingMenu.replace")
      replaceBtn.onclick = () => {
        this.replaceSelectedText(rewritten)
        this.hide()
      }

      const insertBtn = document.createElement("button")
      insertBtn.className = "wm-action-btn"
      insertBtn.textContent = i18n.t("options.webChat.floatingMenu.insertToChat")
      insertBtn.onclick = () => {
        const adapter = getAdapterForUrl()
        adapter?.insertText(rewritten)
        this.hide()
      }

      pop.setFooter([replaceBtn, insertBtn])
    } catch {
      pop.setContent(i18n.t("options.webChat.floatingMenu.error"))
    }
  }

  private async handleReplyAction(): Promise<void> {
    const pop = this.showPopover(
      i18n.t("options.webChat.floatingMenu.reply"),
      i18n.t("options.webChat.floatingMenu.generatingReply"),
    )
    try {
      const adapter = getAdapterForUrl()
      const context = adapter?.getRecentMessages(5) || []

      const reply = await generateSmartReply({
        contextMessages: context,
        customInstruction: `Last message from other party: "${this.selectedText}"`,
        sourceFeature: "Web Chat (Floating Menu Quick Reply)",
      })

      const displayText = reply.viGloss
        ? `${reply.replyText}\n\n(${i18n.t("options.webChat.floatingMenu.glossPrefix")} ${reply.viGloss})`
        : reply.replyText

      pop.setContent(displayText)

      const insertBtn = document.createElement("button")
      insertBtn.className = "wm-action-btn"
      insertBtn.textContent = i18n.t("options.webChat.floatingMenu.insertToChat")
      insertBtn.onclick = () => {
        adapter?.insertText(reply.replyText)
        this.hide()
      }

      pop.setFooter([insertBtn])
    } catch {
      pop.setContent(i18n.t("options.webChat.floatingMenu.error"))
    }
  }

  private async handleAskAction(): Promise<void> {
    const pop = this.showPopover(
      i18n.t("options.webChat.floatingMenu.askAi"),
      i18n.t("options.webChat.floatingMenu.askingAi"),
    )
    try {
      const reply = await generateSmartReply({
        contextMessages: [],
        customInstruction: `Explain or summarize the key point of this text briefly in 2 sentences: "${this.selectedText}"`,
        sourceFeature: "Web Chat (Floating Menu Ask AI)",
      })

      pop.setContent(reply.replyText)
    } catch {
      pop.setContent(i18n.t("options.webChat.floatingMenu.error"))
    }
  }

  private replaceSelectedText(newText: string): void {
    if (!this.currentRange) return
    try {
      this.currentRange.deleteContents()
      this.currentRange.insertNode(document.createTextNode(newText))
    } catch {
      // Fallback
    }
  }

  hide(): void {
    if (this.host) {
      this.host.style.display = "none"
    }
    this.isPopoverOpen = false
    this.selectedText = ""
    this.currentRange = null
  }

  destroy(): void {
    this.hide()
    this.cleanups.forEach((c) => c())
    this.cleanups = []
    if (this.host) {
      this.host.remove()
      this.host = null
      this.shadow = null
    }
  }
}

export const floatingChatMenu = new FloatingChatMenu()
