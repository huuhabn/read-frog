import { beforeEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"
import { SIDEPANEL_CHAT_MODEL_STORAGE_KEY } from "@/utils/constants/config"
import {
  DEFAULT_SELECTED_CHAT_MODEL,
  getLocalSelectedChatModel,
  setLocalSelectedChatModel,
} from "../chat-model-storage"

describe("chat-model-storage", () => {
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

  it("returns default model when storage is empty", async () => {
    const result = await getLocalSelectedChatModel()
    expect(result).toEqual(DEFAULT_SELECTED_CHAT_MODEL)
    expect(getItemMock).toHaveBeenCalledWith(`local:${SIDEPANEL_CHAT_MODEL_STORAGE_KEY}`)
  })

  it("returns default model when stored value is invalid", async () => {
    store.set(`local:${SIDEPANEL_CHAT_MODEL_STORAGE_KEY}`, { invalid: 123 })
    const result = await getLocalSelectedChatModel()
    expect(result).toEqual(DEFAULT_SELECTED_CHAT_MODEL)
  })

  it("returns default model when storage.getItem throws", async () => {
    getItemMock.mockRejectedValueOnce(new Error("Storage unavailable"))
    const result = await getLocalSelectedChatModel()
    expect(result).toEqual(DEFAULT_SELECTED_CHAT_MODEL)
  })

  it("saves and retrieves a valid selected model", async () => {
    const customModel = {
      providerId: "openai",
      model: "gpt-4o",
    }
    await setLocalSelectedChatModel(customModel)
    expect(setItemMock).toHaveBeenCalledWith(
      `local:${SIDEPANEL_CHAT_MODEL_STORAGE_KEY}`,
      customModel,
    )

    const result = await getLocalSelectedChatModel()
    expect(result).toEqual(customModel)
  })

  it("handles storage write errors gracefully without throwing", async () => {
    setItemMock.mockRejectedValueOnce(new Error("Write failed"))
    const customModel = {
      providerId: "anthropic",
      model: "claude-3-5-sonnet-20241022",
    }
    await expect(setLocalSelectedChatModel(customModel)).resolves.not.toThrow()
  })
})
