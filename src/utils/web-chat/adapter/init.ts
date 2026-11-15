import { GenericChatAdapter } from "./generic"
import { clearAdapters, registerChatAdapter } from "./registry"
import { SlackChatAdapter } from "./slack"
import { TelegramChatAdapter } from "./telegram"
import { ZaloChatAdapter } from "./zalo"

/**
 * Initializes and registers all built-in chat adapters into the registry.
 */
export function initAllChatAdapters(genericMatchUrls: string[] = []): void {
  // Specific platforms registered first
  registerChatAdapter(new ZaloChatAdapter())
  registerChatAdapter(new TelegramChatAdapter())
  registerChatAdapter(new SlackChatAdapter())

  // Generic fallback adapter registered last
  registerChatAdapter(new GenericChatAdapter(genericMatchUrls))
}

export function resetAllChatAdapters(genericMatchUrls: string[] = []): void {
  clearAdapters()
  initAllChatAdapters(genericMatchUrls)
}
