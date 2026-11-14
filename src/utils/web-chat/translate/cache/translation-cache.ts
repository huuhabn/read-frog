/**
 * Fast hash for translation cache key: hash(text + targetLang)
 */
export function getTranslationCacheKey(text: string, targetLang: string): string {
  const input = `${targetLang}:${text.trim()}`
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }
  return `wm_tr_${(hash >>> 0).toString(36)}`
}

export class WebChatTranslationCache {
  private memoryCache = new Map<string, string>()
  private maxItems = 1000

  constructor(maxItems = 1000) {
    this.maxItems = maxItems
  }

  get(text: string, targetLang: string): string | null {
    const key = getTranslationCacheKey(text, targetLang)
    return this.memoryCache.get(key) || null
  }

  set(text: string, targetLang: string, translated: string): void {
    const key = getTranslationCacheKey(text, targetLang)
    if (this.memoryCache.size >= this.maxItems) {
      // Evict oldest item
      const firstKey = this.memoryCache.keys().next().value
      if (firstKey) {
        this.memoryCache.delete(firstKey)
      }
    }
    this.memoryCache.set(key, translated)
  }

  clear(): void {
    this.memoryCache.clear()
  }

  size(): number {
    return this.memoryCache.size
  }
}

export const webChatTranslationCache = new WebChatTranslationCache()
