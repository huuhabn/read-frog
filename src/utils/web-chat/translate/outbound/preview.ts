/**
 * Floating preview above the input element showing outbound translation.
 */
export class OutboundTranslationPreview {
  private container: HTMLElement | null = null
  private shadow: ShadowRoot | null = null
  private onApplyCallback: ((translatedText: string) => void) | null = null

  create(anchorEl: HTMLElement): HTMLElement {
    this.destroy()

    const host = document.createElement("div")
    host.className = "wm-outbound-preview-host"
    host.style.position = "absolute"
    host.style.zIndex = "999999"

    const shadow = host.attachShadow({ mode: "open" })
    this.shadow = shadow
    this.container = host

    const style = document.createElement("style")
    style.textContent = `
      .wm-preview-box {
        background: #1e293b;
        color: #f8fafc;
        border: 1px solid #334155;
        border-radius: 8px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
        padding: 8px 12px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        max-width: 380px;
        animation: fadeIn 0.15s ease-out;
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .wm-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
        font-size: 11px;
        color: #94a3b8;
        font-weight: 500;
      }
      .wm-content {
        margin: 4px 0 8px 0;
        white-space: pre-wrap;
        word-break: break-word;
        color: #e2e8f0;
      }
      .wm-actions {
        display: flex;
        justify-content: flex-end;
        gap: 6px;
      }
      .wm-btn {
        background: #3b82f6;
        color: #fff;
        border: none;
        border-radius: 4px;
        padding: 3px 8px;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
      }
      .wm-btn:hover {
        background: #2563eb;
      }
      .wm-btn-cancel {
        background: transparent;
        color: #94a3b8;
      }
      .wm-btn-cancel:hover {
        background: #334155;
        color: #f1f5f9;
      }
    `
    shadow.appendChild(style)

    document.body.appendChild(host)
    this.updatePosition(anchorEl)
    return host
  }

  show(anchorEl: HTMLElement, translatedText: string, onApply: (text: string) => void): void {
    if (!this.container || !this.shadow) {
      this.create(anchorEl)
    }

    this.onApplyCallback = onApply

    const existingBox = this.shadow?.querySelector(".wm-preview-box")
    if (existingBox) existingBox.remove()

    const box = document.createElement("div")
    box.className = "wm-preview-box"

    const header = document.createElement("div")
    header.className = "wm-header"
    header.textContent = "Workmate AI Translation Preview"

    const content = document.createElement("div")
    content.className = "wm-content"
    content.textContent = translatedText

    const actions = document.createElement("div")
    actions.className = "wm-actions"

    const cancelBtn = document.createElement("button")
    cancelBtn.className = "wm-btn wm-btn-cancel"
    cancelBtn.textContent = "Bỏ qua"
    cancelBtn.onclick = () => this.destroy()

    const applyBtn = document.createElement("button")
    applyBtn.className = "wm-btn"
    applyBtn.textContent = "Chèn vào chat (Tab / Enter)"
    applyBtn.onclick = () => {
      this.onApplyCallback?.(translatedText)
      this.destroy()
    }

    actions.appendChild(cancelBtn)
    actions.appendChild(applyBtn)

    box.appendChild(header)
    box.appendChild(content)
    box.appendChild(actions)

    this.shadow?.appendChild(box)
    this.updatePosition(anchorEl)
  }

  updatePosition(anchorEl: HTMLElement): void {
    if (!this.container) return
    const rect = anchorEl.getBoundingClientRect()
    const top = Math.max(10, rect.top + window.scrollY - 80)
    const left = Math.max(10, rect.left + window.scrollX)

    this.container.style.top = `${top}px`
    this.container.style.left = `${left}px`
  }

  destroy(): void {
    if (this.container) {
      this.container.remove()
      this.container = null
      this.shadow = null
      this.onApplyCallback = null
    }
  }
}
