import type { WebChatAutoReplyMode, WebChatTone } from "@/types/config/web-chat"
import { storage } from "#imports"

export interface WebChatRoomSettings {
  autoReplyMode?: WebChatAutoReplyMode
  model?: string | null
  lang?: string | null
  tone?: WebChatTone | null
  sublineTranslate?: boolean
}

export const webChatRoomSettingsStorage = storage.defineItem<Record<string, WebChatRoomSettings>>(
  "local:webchat_room_settings",
  {
    fallback: {},
  },
)

export async function getRoomSettings(roomId: string): Promise<WebChatRoomSettings | undefined> {
  const all = await webChatRoomSettingsStorage.getValue()
  return all[roomId]
}

export async function saveRoomSettings(
  roomId: string,
  settings: Partial<WebChatRoomSettings>,
): Promise<void> {
  const all = await webChatRoomSettingsStorage.getValue()
  const existing = all[roomId] || {}
  const updated = {
    ...all,
    [roomId]: {
      ...existing,
      ...settings,
    },
  }
  await webChatRoomSettingsStorage.setValue(updated)
}

export async function clearRoomSettings(roomId: string): Promise<void> {
  const all = await webChatRoomSettingsStorage.getValue()
  if (roomId in all) {
    const copy = { ...all }
    delete copy[roomId]
    await webChatRoomSettingsStorage.setValue(copy)
  }
}
