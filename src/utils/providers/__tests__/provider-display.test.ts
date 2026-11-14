import type { SystemProviderSelectorItem } from "../provider-display"
import { describe, expect, it } from "vitest"
import {
  getProviderLogo,
  getProviderName,
  isProviderSelectorOptionDisabled,
  isSystemProviderSelectorItem,
} from "../provider-display"

describe("provider-display helpers null safety", () => {
  it("handles null safely in isSystemProviderSelectorItem without throwing", () => {
    expect(isSystemProviderSelectorItem(null)).toBe(false)
    expect(isSystemProviderSelectorItem(undefined)).toBe(false)
  })

  it("identifies valid SystemProviderSelectorItem correctly", () => {
    const item: SystemProviderSelectorItem = {
      kind: "system",
      id: "system-1",
      name: "System Provider",
      logo: () => "logo.svg",
    }
    expect(isSystemProviderSelectorItem(item)).toBe(true)
  })

  it("handles null and undefined safely in getProviderLogo", () => {
    expect(getProviderLogo(null, "light")).toBe("")
    expect(getProviderLogo(undefined, "dark")).toBe("")
  })

  it("handles null and undefined safely in getProviderName", () => {
    expect(getProviderName(null)).toBe("")
    expect(getProviderName(undefined)).toBe("")
  })

  it("handles null and undefined safely in isProviderSelectorOptionDisabled", () => {
    expect(isProviderSelectorOptionDisabled(null)).toBe(false)
    expect(isProviderSelectorOptionDisabled(undefined)).toBe(false)
  })
})
