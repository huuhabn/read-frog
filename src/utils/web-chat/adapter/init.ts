import { GenericChatAdapter } from "./generic"
import { clearAdapters, registerChatAdapter } from "./registry"
import { SlackChatAdapter } from "./slack"
import { TelegramChatAdapter } from "./telegram"
import { ZaloChatAdapter } from "./zalo"

/**
 * Initializes and registers all built-in chat adapters into the registry.
 */
export function initAllChatAdapters(): void {
  // Specific platforms registered first
  registerChatAdapter(new ZaloChatAdapter())
  registerChatAdapter(new TelegramChatAdapter())
  registerChatAdapter(new SlackChatAdapter())

  // Generic fallback adapter registered last
  registerChatAdapter(new GenericChatAdapter())
}

export function resetAllChatAdapters(): void {
  clearAdapters()
  initAllChatAdapters()
}
