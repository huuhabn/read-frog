/**
 * Injects a Shadow DOM sub-line under a message element displaying its translation.
 */
export function attachTranslationSubline(
  messageEl: HTMLElement,
  translatedText: string,
  options?: {
    langLabel?: string
    fontSize?: string
    color?: string
  },
): HTMLElement {
  // Check if sub-line already exists
  const existing = messageEl.querySelector<HTMLElement>(".wm-chat-subline-host")
  if (existing) {
    const textSpan = existing.shadowRoot?.querySelector(".wm-subline-text")
    if (textSpan) {
      textSpan.textContent = translatedText
      return existing
    }
  }

  const host = document.createElement("div")
  host.className = "wm-chat-subline-host"
  host.setAttribute("data-wm-subline", "true")

  const shadow = host.attachShadow({ mode: "open" })

  const style = document.createElement("style")
  style.textContent = `
    :host {
      display: block;
      margin-top: 4px;
      margin-bottom: 2px;
      line-height: 1.4;
      font-size: ${options?.fontSize || "0.85em"};
      opacity: 0.85;
      font-family: inherit;
      clear: both;
      user-select: text;
    }
    .wm-subline-container {
      display: inline-flex;
      align-items: baseline;
      gap: 5px;
      border-left: 2px solid #3b82f6;
      padding-left: 6px;
      color: ${options?.color || "inherit"};
    }
    .wm-subline-badge {
      font-size: 0.75em;
      text-transform: uppercase;
      font-weight: 600;
      opacity: 0.7;
      background: rgba(59, 130, 246, 0.15);
      color: #3b82f6;
      border-radius: 3px;
      padding: 1px 4px;
      user-select: none;
    }
    .wm-subline-text {
      word-break: break-word;
    }
  `

  const container = document.createElement("div")
  container.className = "wm-subline-container"

  if (options?.langLabel) {
    const badge = document.createElement("span")
    badge.className = "wm-subline-badge"
    badge.textContent = options.langLabel
    container.appendChild(badge)
  }

  const textSpan = document.createElement("span")
  textSpan.className = "wm-subline-text"
  textSpan.textContent = translatedText
  container.appendChild(textSpan)

  shadow.appendChild(style)
  shadow.appendChild(container)

  // Position: insert before timestamp if found, else append to messageEl
  const timestampEl = messageEl.querySelector(
    "[data-time], [class*='time'], [class*='timestamp'], time",
  )
  if (timestampEl?.parentElement === messageEl) {
    messageEl.insertBefore(host, timestampEl)
  } else {
    messageEl.appendChild(host)
  }

  return host
}

export function removeTranslationSubline(messageEl: HTMLElement): void {
  const existing = messageEl.querySelector(".wm-chat-subline-host")
  if (existing) {
    existing.remove()
  }
}
