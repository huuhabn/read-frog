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

  useEffect(() => {
    let isSubscribed = true

    const checkSelection = () => {
      if (globalThis.document?.hidden) return

      void getActiveTabSelectedText(false).then((text) => {
        if (!isSubscribed) return
        const trimmed = text.trim()
        if (trimmed) {
          if (trimmed !== dismissedRef.current) {
            setSelectedSnippet(trimmed)
          }
        } else if (dismissedRef.current) {
          // Reset dismissed tracking when page selection is cleared
          dismissedRef.current = null
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
    if (selectedSnippet) {
      dismissedRef.current = selectedSnippet
    }
    setSelectedSnippet(null)
  }, [selectedSnippet])

  return {
    selectedSnippet,
    clearSelection,
    setSelectedSnippet,
  }
}
