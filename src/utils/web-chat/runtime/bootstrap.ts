import type { ContentScriptContext } from "#imports"
import { browser } from "#imports"
import { getLocalConfig } from "@/utils/config/storage"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { initAllChatAdapters } from "../adapter/init"
import { getAdapterForUrl } from "../adapter/registry"
import { translateChatText } from "../ai/service"
import { initRemoteConfig } from "../remote-config/loader"
import { SlashCommandPalette } from "../slash/palette"
import { createInboundTranslationController } from "../translate/inbound/injector"
import { floatingChatMenu } from "../ui/floating-menu"

let webChatBootstrapped = false

/**
 * Bootstraps the Web Chat assistant in the content script environment.
 */
export async function bootstrapWebChat(ctx?: ContentScriptContext): Promise<() => void> {
  if (webChatBootstrapped) {
    return () => {}
  }

  const config = (await getLocalConfig()) ?? DEFAULT_CONFIG
  const webChatConfig = config.webChat
  if (!webChatConfig?.enabled) {
    return () => {}
  }

  webChatBootstrapped = true

  // 1. Initialize adapters & remote config
  initAllChatAdapters()
  if (webChatConfig.remoteConfigUrl) {
    void initRemoteConfig(webChatConfig.remoteConfigUrl)
  }

  const adapter = getAdapterForUrl(window.location.href)
  if (!adapter) {
    return () => {}
  }

  // 2. Check platform-specific enable flags
  if (adapter.platform === "zalo" && !webChatConfig.enableZalo) return () => {}
  if (adapter.platform === "telegram" && !webChatConfig.enableTelegram) return () => {}
  if (adapter.platform === "slack" && !webChatConfig.enableSlack) return () => {}
  if (adapter.platform === "generic" && !webChatConfig.enableGeneric) return () => {}

  const cleanups: (() => void)[] = []

  // 3. Floating Menu
  floatingChatMenu.init()
  cleanups.push(() => floatingChatMenu.destroy())

  // 4. Slash Command Palette
  if (webChatConfig.slashCommandsEnabled) {
    const palette = new SlashCommandPalette(adapter)
    palette.attach()
    cleanups.push(() => palette.destroy())
  }

  // 5. Inbound Real-time Translation
  if (webChatConfig.translateEnabled) {
    const controller = createInboundTranslationController({
      adapter,
      targetLang: webChatConfig.inboundTargetLang || "vi",
      translateFn: async (texts, targetLang) => {
        const results: string[] = []
        for (const text of texts) {
          try {
            const translated = await translateChatText({
              text,
              targetLang,
              sourceFeature: "Web Chat (Inbound Realtime Translate)",
            })
            results.push(translated || text)
          } catch {
            results.push(text)
          }
        }
        return results
      },
    })

    controller.start()
    cleanups.push(() => controller.stop())
  }

  // 6. Sidepanel messaging bridge
  const onRuntimeMessage = (
    message: { type?: string; text?: string; autoSend?: boolean },
    _sender: unknown,
    sendResponse: (res: unknown) => void,
  ) => {
    if (message?.type === "WEB_CHAT_GET_ACTIVE_DATA") {
      const activeAdapter = getAdapterForUrl(window.location.href)
      if (!activeAdapter) {
        sendResponse({ room: null, messages: [] })
        return false
      }
      const room = activeAdapter.getCurrentRoom()
      const rawMessages = activeAdapter.getMessages()
      // Strip DOM element reference for serialization over message port
      const messages = rawMessages.map((msg) => {
        const item = { ...msg }
        delete item.element
        return item
      })
      sendResponse({ room, messages })
      return false
    }

    if (message?.type === "WEB_CHAT_INSERT_TEXT" && typeof message.text === "string") {
      const activeAdapter = getAdapterForUrl(window.location.href)
      if (!activeAdapter) {
        sendResponse({ success: false })
        return false
      }
      const success = activeAdapter.insertText(message.text, {
        autoSend: Boolean(message.autoSend),
      })
      sendResponse({ success })
      return false
    }

    return false
  }

  browser.runtime.onMessage.addListener(onRuntimeMessage)
  cleanups.push(() => {
    browser.runtime.onMessage.removeListener(onRuntimeMessage)
  })

  const teardown = () => {
    webChatBootstrapped = false
    cleanups.forEach((c) => c())
  }

  if (ctx) {
    ctx.onInvalidated(teardown)
  }

  return teardown
}
