import { browser } from "#imports"

export interface ActiveTabInfo {
  id?: number
  title?: string
  url?: string
}

export interface ActiveTabContent extends ActiveTabInfo {
  selectedText?: string
  pageText?: string
}

const MAX_PAGE_TEXT_CHARS = 10000

export async function getActiveTabInfo(): Promise<ActiveTabInfo | null> {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true })
    const activeTab = tabs[0]
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

export async function getActiveTabContent(): Promise<ActiveTabContent | null> {
  try {
    const tabInfo = await getActiveTabInfo()
    if (!tabInfo?.id || !tabInfo.url) {
      return null
    }

    // Skip restricted internal URLs
    if (
      tabInfo.url.startsWith("chrome://") ||
      tabInfo.url.startsWith("chrome-extension://") ||
      tabInfo.url.startsWith("edge://") ||
      tabInfo.url.startsWith("about:")
    ) {
      return tabInfo
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
      return tabInfo
    }

    return {
      ...tabInfo,
      selectedText: extracted.selection,
      pageText: extracted.cleanText.slice(0, MAX_PAGE_TEXT_CHARS),
    }
  } catch (error) {
    console.warn("[SidePanel] Failed to extract active tab content:", error)
    return await getActiveTabInfo()
  }
}
