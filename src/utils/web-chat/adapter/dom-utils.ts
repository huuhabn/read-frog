/**
 * DOM utilities for web chat adapters: text insertion and event dispatching.
 */

/**
 * Robustly inserts text into a target input element (textarea, input, or contenteditable).
 * Attempts multiple methods to ensure compatibility with React/DraftJS/Slate/ProseMirror.
 */
export function insertTextIntoElement(el: HTMLElement, text: string): boolean {
  if (!el) return false

  try {
    el.focus()
  } catch {
    // Focus may fail in test environments
  }

  // 1. For standard input / textarea
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const val = el.value

    // Try document.execCommand first (preserves undo stack)
    try {
      const execSuccess = document.execCommand?.("insertText", false, text)
      if (execSuccess) {
        return true
      }
    } catch {
      // Fallback
    }

    // Direct value assignment fallback
    el.value = val.substring(0, start) + text + val.substring(end)
    el.selectionStart = el.selectionEnd = start + text.length
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
    return true
  }

  // 2. For contenteditable elements
  const isContentEditable =
    el.isContentEditable ||
    el.getAttribute("contenteditable") === "true" ||
    el.contentEditable === "true" ||
    el.getAttribute("role") === "textbox" ||
    el.hasAttribute("contenteditable") ||
    el.classList.contains("rich-input") ||
    el.id === "richInput"

  if (isContentEditable) {
    if (el.getAttribute("contenteditable") === "false") {
      el.setAttribute("contenteditable", "true")
    }

    // Ensure selection is inside el if window.getSelection is supported
    const selection = typeof window !== "undefined" ? window.getSelection?.() : null
    if (selection && (selection.rangeCount === 0 || !el.contains(selection.anchorNode))) {
      try {
        const range = document.createRange()
        const targetLine = el.querySelector("div[id^='input_line_']") || el
        range.selectNodeContents(targetLine)
        range.collapse(false)
        selection.removeAllRanges()
        selection.addRange(range)
      } catch {
        // Selection range manipulation failed
      }
    }

    const dispatchInputEvents = () => {
      try {
        if (typeof InputEvent !== "undefined") {
          el.dispatchEvent(
            new InputEvent("beforeinput", {
              bubbles: true,
              cancelable: true,
              inputType: "insertText",
              data: text,
            }),
          )
          el.dispatchEvent(
            new InputEvent("input", {
              bubbles: true,
              cancelable: true,
              inputType: "insertText",
              data: text,
            }),
          )
        } else {
          el.dispatchEvent(new Event("input", { bubbles: true }))
        }
      } catch {
        el.dispatchEvent(new Event("input", { bubbles: true }))
      }
      el.dispatchEvent(new Event("change", { bubbles: true }))
      el.classList.remove("empty")
      el.classList.remove("is-empty")
    }

    // Method A: execCommand
    try {
      const execSuccess = document.execCommand?.("insertText", false, text)
      if (execSuccess) {
        dispatchInputEvents()
        return true
      }
    } catch {
      // Ignore and fallback
    }

    // Method B: Synthetic paste event
    try {
      if (typeof DataTransfer !== "undefined") {
        const dataTransfer = new DataTransfer()
        dataTransfer.setData("text/plain", text)
        const pasteEvent = new ClipboardEvent("paste", {
          clipboardData: dataTransfer,
          bubbles: true,
          cancelable: true,
        })
        const handled = !el.dispatchEvent(pasteEvent)
        if (handled) {
          dispatchInputEvents()
          return true
        }
      }
    } catch {
      // Ignore and fallback
    }

    // Method C: Selection Range insertion
    try {
      const sel = window.getSelection?.()
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        range.deleteContents()
        const textNode = document.createTextNode(text)
        range.insertNode(textNode)
        range.setStartAfter(textNode)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
        dispatchInputEvents()
        return true
      }
    } catch {
      // Ignore and fallback
    }

    // Method D: Direct DOM node appending
    try {
      const targetLine = (el.querySelector("div[id^='input_line_']") as HTMLElement) || el
      if (
        (el.classList.contains("is-empty") ||
          el.classList.contains("empty") ||
          !el.innerText?.trim()) &&
        targetLine === el
      ) {
        el.innerHTML = ""
      } else {
        const br = targetLine.querySelector("br")
        if (br && targetLine.childNodes.length === 1) {
          br.remove()
        }
      }
      const textNode = document.createTextNode(text)
      targetLine.appendChild(textNode)

      try {
        const range = document.createRange()
        range.selectNodeContents(targetLine)
        range.collapse(false)
        const sel = window.getSelection()
        if (sel) {
          sel.removeAllRanges()
          sel.addRange(range)
        }
      } catch {}

      dispatchInputEvents()
      return true
    } catch {
      // Fallback
    }
  }

  return false
}

/**
 * Extracts visible text content from an element, removing hidden subelements.
 */
export function extractCleanText(el: HTMLElement): string {
  if (!el) return ""
  return (el.innerText || el.textContent || "").trim()
}

/**
 * Triggers message submission across Telegram, Zalo, Slack, and generic web chats.
 * Dispatches pointer/mouse event sequences on send buttons, and dispatches Enter keyboard events on input.
 */
export function triggerDOMSend(input?: HTMLElement | null, customButtonSelector?: string): boolean {
  const sendButtonSelectors = [
    ...(customButtonSelector ? customButtonSelector.split(",").map((s) => s.trim()) : []),
    // Telegram Web (Web A, Web K, Web Z)
    ".btn-send.send",
    "button.btn-send.send",
    ".btn-send-container button.send",
    "button.send[aria-label='Send']",
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

  let sendButton: HTMLElement | null = null
  for (const sel of sendButtonSelectors) {
    if (!sel) continue
    try {
      const el = document.querySelector<HTMLElement>(sel)
      if (el) {
        sendButton = el.tagName.toLowerCase() === "button" ? el : el.closest("button") || el
        break
      }
    } catch {
      // Ignore selector syntax error if any
    }
  }

  if (sendButton) {
    try {
      sendButton.removeAttribute("disabled")
      sendButton.removeAttribute("data-disabled")

      const mouseInit: MouseEventInit = {
        bubbles: true,
        cancelable: true,
        composed: true,
      }
      if (typeof PointerEvent !== "undefined") {
        try {
          sendButton.dispatchEvent(new PointerEvent("pointerdown", mouseInit))
          sendButton.dispatchEvent(new PointerEvent("pointerup", mouseInit))
        } catch {
          // PointerEvent fallback
        }
      }
      sendButton.dispatchEvent(new MouseEvent("mousedown", mouseInit))
      sendButton.dispatchEvent(new MouseEvent("mouseup", mouseInit))
      sendButton.click()
      return true
    } catch {
      // Fallback to Enter key
    }
  }

  // Fallback: Dispatch Enter key on target input
  const targetInput =
    input || (typeof document !== "undefined" ? (document.activeElement as HTMLElement) : null)
  if (targetInput) {
    try {
      targetInput.focus()
      const enterOpts: KeyboardEventInit = {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
        composed: true,
      }
      targetInput.dispatchEvent(new KeyboardEvent("keydown", enterOpts))
      try {
        targetInput.dispatchEvent(new KeyboardEvent("keypress", enterOpts))
      } catch {
        // Fallback
      }
      targetInput.dispatchEvent(new KeyboardEvent("keyup", enterOpts))
      return true
    } catch {
      // Fallback
    }
  }

  return false
}
