import { browser } from "#imports"
import {
  DEFAULT_PLATFORM_SELECTORS,
  type PlatformSelectorConfig,
  type WebChatRemoteConfig,
} from "./types"

const STORAGE_KEY = "readfrog_webchat_remote_config"
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 hours

let activeConfig: WebChatRemoteConfig = DEFAULT_PLATFORM_SELECTORS

/**
 * Get current platform selector configuration.
 */
export function getPlatformSelectorConfig(
  platform: keyof WebChatRemoteConfig["platforms"],
): PlatformSelectorConfig {
  return activeConfig.platforms[platform] || DEFAULT_PLATFORM_SELECTORS.platforms[platform]
}

export function getFullRemoteConfig(): WebChatRemoteConfig {
  return activeConfig
}

export function setRemoteConfig(config: WebChatRemoteConfig): void {
  activeConfig = config
}

/**
 * Initialize remote config from storage if available.
 */
export async function initRemoteConfig(remoteUrl?: string): Promise<WebChatRemoteConfig> {
  try {
    if (browser.storage?.local) {
      const stored = await browser.storage.local.get(STORAGE_KEY)
      if (stored?.[STORAGE_KEY]) {
        const cached = stored[STORAGE_KEY] as WebChatRemoteConfig
        if (cached?.platforms) {
          activeConfig = cached
        }
      }
    }
  } catch {
    // Fall back to default
  }

  // Refresh if needed
  if (remoteUrl) {
    const lastUpdated = activeConfig.lastUpdated || 0
    if (Date.now() - lastUpdated > REFRESH_INTERVAL_MS) {
      void fetchRemoteConfig(remoteUrl)
    }
  }

  return activeConfig
}

/**
 * Fetch updated selectors from remote CDN.
 */
export async function fetchRemoteConfig(url: string): Promise<WebChatRemoteConfig | null> {
  try {
    const res = await fetch(url, { cache: "no-cache" })
    if (!res.ok) return null
    const data = (await res.json()) as WebChatRemoteConfig
    if (data?.platforms) {
      data.lastUpdated = Date.now()
      activeConfig = data
      if (browser.storage?.local) {
        await browser.storage.local.set({ [STORAGE_KEY]: data })
      }
      return data
    }
  } catch {
    // Keep current config
  }
  return null
}
