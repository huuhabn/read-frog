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

  it("should fallback to GenericChatAdapter for other URLs", () => {
    const adapter = getAdapterForUrl("https://discord.com/channels/123/456")
    expect(adapter).toBeDefined()
    expect(adapter?.platform).toBe("generic")
  })
})
