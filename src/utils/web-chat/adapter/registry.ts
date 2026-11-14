import type { IChatAdapter } from "./types"

const adapters: IChatAdapter[] = []

/**
 * Register an adapter into the registry.
 * Priority is given in order of registration (or specific adapters before generic).
 */
export function registerChatAdapter(adapter: IChatAdapter): void {
  const existingIndex = adapters.findIndex((a) => a.platform === adapter.platform)
  if (existingIndex >= 0) {
    adapters[existingIndex] = adapter
  } else {
    adapters.push(adapter)
  }
}

/**
 * Find the matching adapter for a given URL.
 * Specific platforms are checked before the generic adapter.
 */
export function getAdapterForUrl(url: string = window.location.href): IChatAdapter | null {
  // Check non-generic adapters first
  for (const adapter of adapters) {
    if (adapter.platform !== "generic" && adapter.matches(url)) {
      return adapter
    }
  }

  // Fallback to generic adapter if available and matches
  const generic = adapters.find((a) => a.platform === "generic")
  if (generic?.matches(url)) {
    return generic
  }

  return null
}

export function getAllRegisteredAdapters(): readonly IChatAdapter[] {
  return adapters
}

export function clearAdapters(): void {
  adapters.length = 0
}
