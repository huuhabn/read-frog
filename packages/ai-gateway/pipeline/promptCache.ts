/**
 * Deterministic Prompt Cache with LRU and TTL support
 */

import type { PromptCachePort, CachedResponse } from "./types"

export type { PromptCachePort }

export interface InMemoryCacheOptions {
  maxEntries?: number
  defaultTtlMs?: number // Default 1 hour (3,600,000 ms)
}

interface CacheEntry {
  data: CachedResponse
  expiresAt: number
}

export class InMemoryPromptCache implements PromptCachePort {
  private cache: Map<string, CacheEntry> = new Map()
  private maxEntries: number
  private defaultTtlMs: number

  constructor(options?: InMemoryCacheOptions) {
    this.maxEntries = options?.maxEntries ?? 1000
    this.defaultTtlMs = options?.defaultTtlMs ?? 3600_000
  }

  /**
   * Generates a deterministic SHA-256 hash key based on final system prompt, user message, model target, and params.
   */
  public static async generateKey(
    systemPrompt: string,
    userMessage: string,
    target: string,
    params?: Record<string, unknown>,
  ): Promise<string> {
    const sortedParams = params
      ? Object.keys(params)
          .sort()
          .reduce(
            (acc, k) => {
              acc[k] = params[k]
              return acc
            },
            {} as Record<string, unknown>,
          )
      : {}

    const raw = `${systemPrompt.trim()}::${userMessage.trim()}::${target.trim()}::${JSON.stringify(sortedParams)}`
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw))
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
  }

  public get(key: string): CachedResponse | null {
    const entry = this.cache.get(key)
    if (!entry) {
      return null
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    // Refresh LRU order (delete & re-insert)
    this.cache.delete(key)
    this.cache.set(key, entry)

    return entry.data
  }

  public set(key: string, value: CachedResponse, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTtlMs
    const expiresAt = Date.now() + ttl

    // If key already exists, delete it first to update LRU position
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxEntries) {
      // Evict oldest entry (first item in Map)
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(key, { data: value, expiresAt })
  }

  public delete(key: string): void {
    this.cache.delete(key)
  }

  public clear(): void {
    this.cache.clear()
  }

  public get size(): number {
    return this.cache.size
  }
}
