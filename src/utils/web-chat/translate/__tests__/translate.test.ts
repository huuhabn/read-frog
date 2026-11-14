// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { webChatTranslationCache } from "../cache/translation-cache"
import { ViewportMessageBatcher } from "../inbound/viewport-batcher"
import { extractPlaceholders, restorePlaceholders } from "../placeholder/extractor"

describe("Web Chat Translation Utilities", () => {
  it("should extract mentions, URLs, and code blocks with placeholders", () => {
    const raw = "Hi @alex, please check https://example.com/api and run `npm test`"
    const { text, placeholders } = extractPlaceholders(raw)

    expect(text).toContain("__MENTION_")
    expect(text).toContain("__URL_")
    expect(text).toContain("__CODE_")
    expect(text).not.toContain("@alex")
    expect(text).not.toContain("https://example.com/api")
    expect(text).not.toContain("`npm test`")

    const restored = restorePlaceholders(text, placeholders)
    expect(restored).toBe(raw)
  })

  it("should cache translation results and return from cache", () => {
    const original = "Good morning!"
    const lang = "vi"
    const translated = "Chào buổi sáng!"

    webChatTranslationCache.set(original, lang, translated)
    const cached = webChatTranslationCache.get(original, lang)
    expect(cached).toBe(translated)

    const uncached = webChatTranslationCache.get("Something else", lang)
    expect(uncached).toBeNull()
  })

  it("should guard and skip Vietnamese text if target is Vietnamese", () => {
    let called = false
    const batcher = new ViewportMessageBatcher({
      targetLang: "vi",
      translateFn: async () => {
        called = true
        return []
      },
      onTranslated: () => {},
    })

    const el = document.createElement("div")
    batcher.observe(el, "msg-vn-1", "Chào bạn, hôm nay thế nào rồi?")
    expect(called).toBe(false)
    batcher.destroy()
  })

  it("should not retry failed items indefinitely on translation error", async () => {
    let callCount = 0
    const batcher = new ViewportMessageBatcher({
      targetLang: "vi",
      debounceMs: 5,
      translateFn: async () => {
        callCount++
        throw new Error("HTTP 429 Too Many Requests")
      },
      onTranslated: () => {},
    })

    const el = document.createElement("div")
    batcher.observe(el, "msg-fail-1", "Hello there, how are you?")
    await batcher.flush()
    expect(callCount).toBe(1)

    // Re-observing the same element should be ignored because it remains in processedIds
    batcher.observe(el, "msg-fail-1", "Hello there, how are you?")
    await batcher.flush()
    expect(callCount).toBe(1)
    batcher.destroy()
  })
})
