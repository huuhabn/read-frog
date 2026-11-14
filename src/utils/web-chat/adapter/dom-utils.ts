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

    // Method A: execCommand
    try {
      const execSuccess = document.execCommand?.("insertText", false, text)
      if (execSuccess) {
        el.dispatchEvent(new Event("input", { bubbles: true }))
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
          el.dispatchEvent(new Event("input", { bubbles: true }))
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
        el.dispatchEvent(new Event("input", { bubbles: true }))
        return true
      }
    } catch {
      // Ignore and fallback
    }

    // Method D: Direct DOM node appending
    try {
      const targetLine = (el.querySelector("div[id^='input_line_']") as HTMLElement) || el
      const br = targetLine.querySelector("br")
      if (br && targetLine.childNodes.length === 1) {
        br.remove()
      }
      const textNode = document.createTextNode(text)
      targetLine.appendChild(textNode)
      el.classList.remove("empty")
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
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
