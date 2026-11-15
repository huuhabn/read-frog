import { beforeEach, describe, expect, it } from "vitest"
import { initAllChatAdapters } from "../init"
import { clearAdapters, getAdapterForUrl } from "../registry"

describe("Chat Adapter Registry", () => {
  beforeEach(() => {
    clearAdapters()
    initAllChatAdapters()
  })

  it("should match ZaloChatAdapter for Zalo URLs", () => {
    const adapter = getAdapterForUrl("https://chat.zalo.me/")
    expect(adapter).toBeDefined()
    expect(adapter?.platform).toBe("zalo")
  })

  it("should match TelegramChatAdapter for Telegram URLs", () => {
    const adapter = getAdapterForUrl("https://web.telegram.org/a/#123456")
    expect(adapter).toBeDefined()
    expect(adapter?.platform).toBe("telegram")
  })

  it("should match SlackChatAdapter for Slack URLs", () => {
    const adapter = getAdapterForUrl("https://app.slack.com/client/T123/C456")
    expect(adapter).toBeDefined()
    expect(adapter?.platform).toBe("slack")
  })

  it("should not match GenericChatAdapter when genericMatchUrls is empty", () => {
    const adapter = getAdapterForUrl("https://discord.com/channels/123/456")
    expect(adapter).toBeNull()
  })

  it("should match GenericChatAdapter when URL matches configured genericMatchUrls", () => {
    clearAdapters()
    initAllChatAdapters(["discord.com/*", "*.crisp.chat/*"])

    const discord = getAdapterForUrl("https://discord.com/channels/123/456")
    expect(discord).toBeDefined()
    expect(discord?.platform).toBe("generic")

    const crisp = getAdapterForUrl("https://app.crisp.chat/inbox/123")
    expect(crisp).toBeDefined()
    expect(crisp?.platform).toBe("generic")

    const google = getAdapterForUrl("https://www.google.com/search?q=test")
    expect(google).toBeNull()
  })
})
