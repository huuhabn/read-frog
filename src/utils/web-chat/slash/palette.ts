import type { IChatAdapter } from "../adapter/types"
import type { SlashCommandDefinition } from "./types"
import { getAllSlashCommands, parseSlashCommandInput } from "./registry"

export class SlashCommandPalette {
  private adapter: IChatAdapter
  private host: HTMLElement | null = null
  private shadow: ShadowRoot | null = null
  private selectedIndex = 0
  private isOpen = false
  private activeInput: HTMLElement | null = null
  private filteredCommands: SlashCommandDefinition[] = []
  private cleanups: (() => void)[] = []

  constructor(adapter: IChatAdapter) {
    this.adapter = adapter
  }

  attach(): void {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement
      if (
        target &&
        (target.tagName === "TEXTAREA" ||
          target.getAttribute("contenteditable") === "true" ||
          target.getAttribute("role") === "textbox" ||
          target.id === "richInput" ||
          target.classList.contains("rich-input") ||
          target.closest?.("#richInput, .rich-input") !== null)
      ) {
        const inputTarget = (target.closest?.("#richInput, .rich-input") as HTMLElement) || target
        this.bindInput(inputTarget)
      }
    }

    document.addEventListener("focusin", handleFocusIn)
    this.cleanups.push(() => document.removeEventListener("focusin", handleFocusIn))

    // Check if input is already active
    const input = this.adapter.getInputElement()
    if (input) {
      this.bindInput(input)
    }
  }

  private bindInput(input: HTMLElement): void {
    if (this.activeInput === input) return
    this.activeInput = input

    const handleInput = () => {
      const rawText = this.getInputText(input)
      // Check if starts with / or has space before /
      if (rawText.startsWith("/") || /\s\/[a-zA-Z0-9]*$/.test(rawText)) {
        const lastSlashIdx = rawText.lastIndexOf("/")
        const query =
          rawText
            .substring(lastSlashIdx + 1)
            .split(/\s/)[0]
            ?.toLowerCase() ?? ""
        this.open(input, query)
      } else {
        this.close()
      }
    }

    const handleKeyDownCapture = (e: KeyboardEvent) => {
      if (!this.isOpen) return

      if (e.key === "ArrowDown") {
        e.preventDefault()
        e.stopPropagation()
        this.selectedIndex = (this.selectedIndex + 1) % Math.max(1, this.filteredCommands.length)
        this.renderList()
        return
      }

      if (e.key === "ArrowUp") {
        e.preventDefault()
        e.stopPropagation()
        this.selectedIndex =
          (this.selectedIndex - 1 + this.filteredCommands.length) %
          Math.max(1, this.filteredCommands.length)
        this.renderList()
        return
      }

      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault()
        e.stopPropagation()
        void this.executeSelectedCommand()
        return
      }

      if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        this.close()
      }
    }

    input.addEventListener("input", handleInput)
    // Critical: capture phase to preempt host web's Enter key handler
    input.addEventListener("keydown", handleKeyDownCapture, true)

    this.cleanups.push(() => {
      input.removeEventListener("input", handleInput)
      input.removeEventListener("keydown", handleKeyDownCapture, true)
    })
  }

  private getInputText(el: HTMLElement): string {
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      return el.value
    }
    return el.innerText || el.textContent || ""
  }

  open(anchorEl: HTMLElement, query: string): void {
    const all = getAllSlashCommands()
    this.filteredCommands = query
      ? all.filter(
          (c) => c.name.includes(query) || Boolean(c.aliases?.some((a) => a.includes(query))),
        )
      : [...all]

    if (this.filteredCommands.length === 0) {
      this.close()
      return
    }

    this.selectedIndex = 0
    this.isOpen = true
    this.ensureHost()
    this.renderList()
    this.positionAt(anchorEl)
  }

  private ensureHost(): ShadowRoot {
    if (this.host && this.shadow) return this.shadow

    const host = document.createElement("div")
    host.className = "wm-slash-palette-host"
    host.style.position = "absolute"
    host.style.zIndex = "2147483647"

    const shadow = host.attachShadow({ mode: "open" })
    const style = document.createElement("style")
    style.textContent = `
      .wm-palette {
        background: #0f172a;
        color: #f8fafc;
        border: 1px solid #334155;
        border-radius: 8px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
        width: 320px;
        max-height: 260px;
        overflow-y: auto;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        padding: 4px;
      }
      .wm-item {
        padding: 6px 10px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .wm-item.active {
        background: #2563eb;
        color: #ffffff;
      }
      .wm-cmd-name {
        font-weight: 600;
        font-size: 13px;
      }
      .wm-cmd-desc {
        font-size: 11px;
        opacity: 0.8;
      }
      .wm-cmd-usage {
        font-size: 10px;
        opacity: 0.6;
        font-family: monospace;
      }
    `
    shadow.appendChild(style)

    const list = document.createElement("div")
    list.className = "wm-palette"
    shadow.appendChild(list)

    document.body.appendChild(host)
    this.host = host
    this.shadow = shadow
    return shadow
  }

  private renderList(): void {
    if (!this.shadow) return
    const list = this.shadow.querySelector(".wm-palette")
    if (!list) return

    list.innerHTML = ""

    this.filteredCommands.forEach((cmd, idx) => {
      const item = document.createElement("div")
      item.className = `wm-item ${idx === this.selectedIndex ? "active" : ""}`

      const name = document.createElement("div")
      name.className = "wm-cmd-name"
      name.textContent = `/${cmd.name}`

      const desc = document.createElement("div")
      desc.className = "wm-cmd-desc"
      desc.textContent = cmd.description

      const usage = document.createElement("div")
      usage.className = "wm-cmd-usage"
      usage.textContent = cmd.usage

      item.appendChild(name)
      item.appendChild(desc)
      item.appendChild(usage)

      item.onmouseenter = () => {
        this.selectedIndex = idx
        this.renderList()
      }

      item.onclick = () => {
        void this.executeSelectedCommand()
      }

      list.appendChild(item)
    })
  }

  private positionAt(anchorEl: HTMLElement): void {
    if (!this.host) return
    const rect = anchorEl.getBoundingClientRect()
    const height = Math.min(260, this.filteredCommands.length * 60 + 20)
    let top = rect.top + window.scrollY - height - 8

    if (top < 10) {
      top = rect.bottom + window.scrollY + 8
    }

    const left = Math.max(10, Math.min(rect.left + window.scrollX, window.innerWidth - 340))

    this.host.style.top = `${top}px`
    this.host.style.left = `${left}px`
    this.host.style.display = "block"
  }

  private async executeSelectedCommand(): Promise<void> {
    const cmd = this.filteredCommands[this.selectedIndex]
    if (!cmd || !this.activeInput) {
      this.close()
      return
    }

    const rawInput = this.getInputText(this.activeInput)
    const parsed = parseSlashCommandInput(rawInput)

    this.close()

    const result = await cmd.execute({
      adapter: this.adapter,
      inputElement: this.activeInput,
      rawInput,
      commandName: parsed.commandName || cmd.name,
      args: parsed.args,
      langModifier: parsed.langModifier,
    })

    if (result.success && result.insertText) {
      // Insert without auto-submitting
      this.adapter.insertText(result.insertText)
    }
  }

  close(): void {
    this.isOpen = false
    if (this.host) {
      this.host.style.display = "none"
    }
  }

  destroy(): void {
    this.close()
    this.cleanups.forEach((c) => c())
    this.cleanups = []
    if (this.host) {
      this.host.remove()
      this.host = null
      this.shadow = null
    }
  }
}
