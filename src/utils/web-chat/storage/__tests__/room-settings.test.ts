import { beforeEach, describe, expect, it } from "vitest"
import {
  clearRoomSettings,
  getRoomSettings,
  saveRoomSettings,
  webChatRoomSettingsStorage,
} from "../room-settings"

describe("webChatRoomSettingsStorage", () => {
  beforeEach(async () => {
    await webChatRoomSettingsStorage.setValue({})
  })

  it("returns undefined for unconfigured room", async () => {
    const settings = await getRoomSettings("room-1")
    expect(settings).toBeUndefined()
  })

  it("saves and retrieves settings per room", async () => {
    await saveRoomSettings("zalo-group-1", {
      autoReplyMode: "draft",
      tone: "professional",
      lang: "en",
      model: "gpt-4o",
    })

    await saveRoomSettings("telegram-room-2", {
      autoReplyMode: "send",
      tone: "casual",
    })

    const zaloSettings = await getRoomSettings("zalo-group-1")
    expect(zaloSettings).toEqual({
      autoReplyMode: "draft",
      tone: "professional",
      lang: "en",
      model: "gpt-4o",
    })

    const tgSettings = await getRoomSettings("telegram-room-2")
    expect(tgSettings).toEqual({
      autoReplyMode: "send",
      tone: "casual",
    })
  })

  it("updates existing room settings incrementally", async () => {
    await saveRoomSettings("room-123", {
      autoReplyMode: "draft",
      tone: "friendly",
    })

    await saveRoomSettings("room-123", {
      autoReplyMode: "send",
    })

    const updated = await getRoomSettings("room-123")
    expect(updated).toEqual({
      autoReplyMode: "send",
      tone: "friendly",
    })
  })

  it("clears settings for a specific room", async () => {
    await saveRoomSettings("room-to-clear", { autoReplyMode: "send" })
    await saveRoomSettings("room-to-keep", { autoReplyMode: "draft" })

    await clearRoomSettings("room-to-clear")

    expect(await getRoomSettings("room-to-clear")).toBeUndefined()
    expect(await getRoomSettings("room-to-keep")).toEqual({ autoReplyMode: "draft" })
  })
})
