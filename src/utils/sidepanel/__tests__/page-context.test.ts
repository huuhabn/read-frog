import { beforeEach, describe, expect, it, vi } from "vitest"
import { browser } from "#imports"
import { getActiveTabContent, getActiveTabInfo, isRestrictedUrl } from "../page-context"

describe("page-context", () => {
  describe("isRestrictedUrl", () => {
    it("returns true for restricted and browser internal URLs", () => {
      expect(isRestrictedUrl(undefined)).toBe(true)
      expect(isRestrictedUrl("")).toBe(true)
      expect(isRestrictedUrl("chrome://settings")).toBe(true)
      expect(isRestrictedUrl("chrome://extensions")).toBe(true)
      expect(
        isRestrictedUrl("chrome-extension://difoiogjjojoaoomphldepapgpbgkhkb/options.html"),
      ).toBe(true)
      expect(isRestrictedUrl("edge://settings")).toBe(true)
      expect(isRestrictedUrl("about:blank")).toBe(true)
      expect(isRestrictedUrl("about:config")).toBe(true)
      expect(isRestrictedUrl("devtools://devtools/bundled/inspector.html")).toBe(true)
      expect(isRestrictedUrl("view-source:https://example.com")).toBe(true)
    })

    it("returns false for valid web URLs", () => {
      expect(isRestrictedUrl("https://example.com")).toBe(false)
      expect(isRestrictedUrl("http://localhost:3000/dashboard")).toBe(false)
      expect(isRestrictedUrl("https://news.ycombinator.com/item?id=123")).toBe(false)
    })
  })

  describe("getActiveTabInfo", () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it("returns the active tab directly if it is a valid web URL", async () => {
      const mockTab = {
        id: 1,
        title: "Example Domain",
        url: "https://example.com",
      }
      vi.spyOn(browser.tabs, "query").mockImplementation(async (queryInfo) => {
        if (queryInfo.active) {
          return [mockTab] as any
        }
        return [mockTab] as any
      })

      const tabInfo = await getActiveTabInfo()
      expect(tabInfo).toEqual(mockTab)
    })

    it("falls back to the most recent web tab if current active tab is an extension settings page", async () => {
      const activeSettingsTab = {
        id: 2,
        title: "Workmate AI Settings",
        url: "chrome-extension://my-extension/options.html",
        lastAccessed: 200,
      }
      const webTab = {
        id: 1,
        title: "VnExpress Tin tức",
        url: "https://vnexpress.net/tin-tuc",
        lastAccessed: 150,
      }

      vi.spyOn(browser.tabs, "query").mockImplementation(async (queryInfo) => {
        if (queryInfo.active) {
          return [activeSettingsTab] as any
        }
        return [activeSettingsTab, webTab] as any
      })

      const tabInfo = await getActiveTabInfo(true)
      expect(tabInfo).toEqual({
        id: 1,
        title: "VnExpress Tin tức",
        url: "https://vnexpress.net/tin-tuc",
      })
    })

    it("returns the restricted active tab if no valid web tab exists", async () => {
      const activeSettingsTab = {
        id: 2,
        title: "Settings",
        url: "chrome://settings",
      }

      vi.spyOn(browser.tabs, "query").mockImplementation(async (queryInfo) => {
        if (queryInfo.active) {
          return [activeSettingsTab] as any
        }
        return [activeSettingsTab] as any
      })

      const tabInfo = await getActiveTabInfo(true)
      expect(tabInfo).toEqual({
        id: 2,
        title: "Settings",
        url: "chrome://settings",
      })
    })
  })

  describe("getActiveTabContent", () => {
    it("marks isRestricted true when active tab is a restricted URL", async () => {
      const activeSettingsTab = {
        id: 2,
        title: "Settings",
        url: "chrome://settings",
      }

      vi.spyOn(browser.tabs, "query").mockImplementation(async () => [activeSettingsTab] as any)

      const content = await getActiveTabContent(false)
      expect(content?.isRestricted).toBe(true)
      expect(content?.pageText).toBeUndefined()
    })
  })
})
