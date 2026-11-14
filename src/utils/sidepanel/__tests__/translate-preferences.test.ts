import { beforeEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"
import {
  buildTranslateInstructions,
  DEFAULT_TRANSLATE_PREFERENCES,
  getLocalTranslatePreferences,
  isDefaultPreferences,
  setLocalTranslatePreferences,
  TRANSLATE_PREFERENCES_STORAGE_KEY,
  type TranslatePreferences,
} from "../translate-preferences"

describe("translate-preferences", () => {
  const store = new Map<string, unknown>()
  const getItemMock = vi.fn<typeof storage.getItem>(async (key: string) => store.get(key) ?? null)
  const setItemMock = vi.fn<typeof storage.setItem>(async (key: string, value: unknown) => {
    store.set(key, value)
  })

  beforeEach(() => {
    vi.clearAllMocks()
    store.clear()
    getItemMock.mockImplementation(async (key: string) => store.get(key) ?? null)
    setItemMock.mockImplementation(async (key: string, value: unknown) => {
      store.set(key, value)
    })
    storage.getItem = getItemMock
    storage.setItem = setItemMock
  })

  it("returns default preferences when storage is empty", async () => {
    const result = await getLocalTranslatePreferences()
    expect(result).toEqual(DEFAULT_TRANSLATE_PREFERENCES)
    expect(getItemMock).toHaveBeenCalledWith(`local:${TRANSLATE_PREFERENCES_STORAGE_KEY}`)
  })

  it("returns default preferences when stored value is invalid", async () => {
    store.set(`local:${TRANSLATE_PREFERENCES_STORAGE_KEY}`, { length: "unknown-val" })
    const result = await getLocalTranslatePreferences()
    expect(result).toEqual(DEFAULT_TRANSLATE_PREFERENCES)
  })

  it("saves and retrieves custom preferences", async () => {
    const custom: TranslatePreferences = {
      length: "concise",
      tone: "formal",
      style: "literal",
      complexity: "expert",
      customPrompt: "Keep technical terms intact",
    }
    await setLocalTranslatePreferences(custom)
    expect(setItemMock).toHaveBeenCalledWith(`local:${TRANSLATE_PREFERENCES_STORAGE_KEY}`, custom)
    const result = await getLocalTranslatePreferences()
    expect(result).toEqual(custom)
  })

  it("detects whether preferences are default", () => {
    expect(isDefaultPreferences(DEFAULT_TRANSLATE_PREFERENCES)).toBe(true)
    expect(
      isDefaultPreferences({
        ...DEFAULT_TRANSLATE_PREFERENCES,
        tone: "casual",
      }),
    ).toBe(false)
    expect(
      isDefaultPreferences({
        ...DEFAULT_TRANSLATE_PREFERENCES,
        customPrompt: "custom note",
      }),
    ).toBe(false)
  })

  it("builds translate instructions correctly with custom prompt", () => {
    const prompt = buildTranslateInstructions("Tiếng Việt", "English", {
      length: "concise",
      tone: "formal",
      style: "literal",
      complexity: "expert",
      customPrompt: "Do not translate API names.",
    })

    expect(prompt).toContain("Hãy dịch văn bản từ English sang Tiếng Việt")
    expect(prompt).toContain("Ngắn gọn, súc tích")
    expect(prompt).toContain("Trang trọng")
    expect(prompt).toContain("Dịch sát nghĩa")
    expect(prompt).toContain("Chuyên sâu")
    expect(prompt).toContain("Do not translate API names.")
    expect(prompt).toContain("Chỉ trả về duy nhất bản dịch hoàn chỉnh")
  })
})
