// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { applyTheme, getTextDirection, resolveThemeMode } from "../theme"
import {
  getThemeSettings,
  migrateLegacyThemeMode,
  resetThemeMigrationForTests,
  themeModeStorage,
  themeScaledStorage,
  themeStorage,
} from "../theme-storage"

describe("theme storage", () => {
  beforeEach(() => {
    fakeBrowser.reset()
    resetThemeMigrationForTests()
  })

  it("returns fallbacks without persisting defaults", async () => {
    expect(await getThemeSettings()).toEqual({ theme: "default", mode: "system", scaled: false })
    expect(await fakeBrowser.storage.sync.get()).toEqual({})
  })

  it("migrates a valid legacy mode and removes it after a successful write", async () => {
    await fakeBrowser.storage.local.set({ theme: "dark" })
    await migrateLegacyThemeMode()

    expect(await themeModeStorage.getValue()).toBe("dark")
    expect(await fakeBrowser.storage.local.get("theme")).toEqual({})
  })

  it("watches all theme settings", async () => {
    const values: unknown[] = []
    const unwatch = [
      themeStorage.watch((value) => values.push(value)),
      themeModeStorage.watch((value) => values.push(value)),
      themeScaledStorage.watch((value) => values.push(value)),
    ]
    await themeStorage.setValue("default")
    await themeModeStorage.setValue("light")
    await themeScaledStorage.setValue(true)
    expect(values).toEqual(["default", "light", true])
    unwatch.forEach((stop) => stop())
  })
})

describe("theme DOM helpers", () => {
  it.each([
    ["en", "ltr"],
    ["vi-VN", "ltr"],
    ["ar", "rtl"],
    ["he-IL", "rtl"],
    ["fa_IR", "rtl"],
    ["ur-PK", "rtl"],
  ] as const)("resolves %s direction", (locale, direction) => {
    expect(getTextDirection(locale)).toBe(direction)
  })

  it("applies the complete settings as one root state", () => {
    const root = document.createElement("div")
    applyTheme(root, { theme: "default", mode: "dark", scaled: true }, "ar-EG")
    expect(root.dataset.theme).toBe("default")
    expect(root.classList.contains("dark")).toBe(true)
    expect(root.classList.contains("theme-scaled")).toBe(true)
    expect(root.dir).toBe("rtl")
    expect(root.style.colorScheme).toBe("dark")
  })

  it("resolves system mode through matchMedia", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn<() => MediaQueryList>(() => ({ matches: true }) as MediaQueryList),
    })
    expect(resolveThemeMode("system")).toBe("dark")
  })
})
