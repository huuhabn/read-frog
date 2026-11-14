import { useCallback, useEffect, useRef, useState } from "react"
import { browser } from "#imports"
import { getActiveTabSelectedText } from "./page-context"

/**
 * Hook to automatically detect and capture selected text from the active tab.
 * When text is highlighted on a webpage, it captures it.
 * If the user explicitly dismisses the snippet, it won't re-appear
 * until a new selection is made.
 */
export function useActiveTabSelection() {
  const [selectedSnippet, setSelectedSnippet] = useState<string | null>(null)
  const dismissedRef = useRef<string | null>(null)
  const currentSnippetRef = useRef<string | null>(null)

  useEffect(() => {
    let isSubscribed = true

    const checkSelection = () => {
      if (globalThis.document?.hidden) return

      void getActiveTabSelectedText(false).then((text) => {
        if (!isSubscribed) return
        const trimmed = text.trim()
        if (trimmed) {
          if (trimmed !== dismissedRef.current) {
            currentSnippetRef.current = trimmed
            setSelectedSnippet(trimmed)
          }
        }
      })
    }

    // Defer initial check to ensure sidepanel paints immediately
    const initialTimer = setTimeout(checkSelection, 200)

    window.addEventListener("focus", checkSelection)
    document.addEventListener("visibilitychange", checkSelection)

    // Periodic check while tab is open to catch live selections
    const interval = setInterval(checkSelection, 1000)

    const handleTabActivated = () => {
      dismissedRef.current = null
      currentSnippetRef.current = null
      checkSelection()
    }

    browser.tabs?.onActivated?.addListener(handleTabActivated)

    return () => {
      isSubscribed = false
      clearTimeout(initialTimer)
      clearInterval(interval)
      window.removeEventListener("focus", checkSelection)
      document.removeEventListener("visibilitychange", checkSelection)
      browser.tabs?.onActivated?.removeListener(handleTabActivated)
    }
  }, [])

  const clearSelection = useCallback(() => {
    const toDismiss = currentSnippetRef.current || selectedSnippet
    if (toDismiss) {
      dismissedRef.current = toDismiss
    }
    currentSnippetRef.current = null
    setSelectedSnippet(null)
  }, [selectedSnippet])

  return {
    selectedSnippet,
    clearSelection,
    setSelectedSnippet,
  }
}
