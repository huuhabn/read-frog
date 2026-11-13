import { browser } from "#imports"

export interface ActiveTabInfo {
  id?: number
  title?: string
  url?: string
}

export interface ActiveTabContent extends ActiveTabInfo {
  selectedText?: string
  pageText?: string
  isRestricted?: boolean
}

const MAX_PAGE_TEXT_CHARS = 10000

/**
 * Checks if a URL is an internal/restricted page where content scripts
 * cannot run (e.g. settings, chrome://, edge://, about:).
 */
export function isRestrictedUrl(url?: string): boolean {
  if (!url) return true
  const lower = url.toLowerCase().trim()
  return (
    lower.startsWith("chrome://") ||
    lower.startsWith("chrome-extension://") ||
    lower.startsWith("edge://") ||
    lower.startsWith("about:") ||
    lower.startsWith("devtools://") ||
    lower.startsWith("view-source:") ||
    lower === "about:blank"
  )
}

/**
 * Retrieves info for the active tab.
 * If fallbackToNonRestricted is true and the current active tab is a restricted
 * page (such as extension options/settings or chrome://), it will attempt to find
 * the most recently active non-restricted tab in the current window.
 */
export async function getActiveTabInfo(
  fallbackToNonRestricted = true,
): Promise<ActiveTabInfo | null> {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true })
    const activeTab = tabs[0]

    // If active tab exists and is NOT restricted, return it directly
    if (activeTab?.id && activeTab.url && !isRestrictedUrl(activeTab.url)) {
      return {
        id: activeTab.id,
        title: activeTab.title,
        url: activeTab.url,
      }
    }

    // If active tab is restricted (e.g. extension settings, chrome://, etc.),
    // try to find the most recently accessed non-restricted web tab
    if (fallbackToNonRestricted) {
      const windowTabs = await browser.tabs.query({ currentWindow: true })
      const validTabs = windowTabs.filter((tab) => tab.id && tab.url && !isRestrictedUrl(tab.url))

      if (validTabs.length > 0) {
        validTabs.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))
        const fallbackTab = validTabs[0]
        if (fallbackTab?.id && fallbackTab.url) {
          return {
            id: fallbackTab.id,
            title: fallbackTab.title,
            url: fallbackTab.url,
          }
        }
      }

      // If no valid tab in current window, check the last focused window
      const allTabs = await browser.tabs.query({ lastFocusedWindow: true })
      const allValidTabs = allTabs.filter((tab) => tab.id && tab.url && !isRestrictedUrl(tab.url))
      if (allValidTabs.length > 0) {
        allValidTabs.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))
        const fallbackTab = allValidTabs[0]
        if (fallbackTab?.id && fallbackTab.url) {
          return {
            id: fallbackTab.id,
            title: fallbackTab.title,
            url: fallbackTab.url,
          }
        }
      }
    }

    if (!activeTab?.id) {
      return null
    }

    return {
      id: activeTab.id,
      title: activeTab.title,
      url: activeTab.url,
    }
  } catch (error) {
    console.error("[SidePanel] Failed to get active tab info:", error)
    return null
  }
}

export async function getActiveTabContent(
  fallbackToNonRestricted = true,
): Promise<ActiveTabContent | null> {
  try {
    const tabInfo = await getActiveTabInfo(fallbackToNonRestricted)
    if (!tabInfo?.id || !tabInfo.url) {
      return null
    }

    // Skip restricted internal URLs
    if (isRestrictedUrl(tabInfo.url)) {
      return {
        ...tabInfo,
        isRestricted: true,
      }
    }

    const results = await browser.scripting.executeScript({
      target: { tabId: tabInfo.id },
      func: () => {
        const selection = window.getSelection()?.toString().trim() || ""

        // Clone and clean body text to remove scripts, styles and noise
        const bodyClone = document.body.cloneNode(true) as HTMLElement
        const unwanted = bodyClone.querySelectorAll(
          "script, style, noscript, svg, nav, footer, iframe",
        )
        unwanted.forEach((node) => node.remove())

        const rawText = bodyClone.innerText || ""
        const cleanText = rawText.replace(/\n\s*\n/g, "\n\n").trim()

        return {
          selection,
          cleanText,
        }
      },
    })

    const extracted = results?.[0]?.result
    if (!extracted) {
      return {
        ...tabInfo,
        isRestricted: false,
      }
    }

    return {
      ...tabInfo,
      selectedText: extracted.selection,
      pageText: extracted.cleanText.slice(0, MAX_PAGE_TEXT_CHARS),
      isRestricted: false,
    }
  } catch (error) {
    console.warn("[SidePanel] Failed to extract active tab content:", error)
    const fallback = await getActiveTabInfo(fallbackToNonRestricted)
    return fallback
      ? {
          ...fallback,
          isRestricted: isRestrictedUrl(fallback.url),
        }
      : null
  }
}
