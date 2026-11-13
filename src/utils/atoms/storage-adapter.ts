import type { ZodSchema } from "zod"
import { storage } from "#imports"
import {
  isExtensionContextAlive,
  isExtensionContextInvalidatedError,
} from "@/utils/error/extension-context"
import { createLogger } from "@/utils/logging/logger"
import { isNonNullish } from "@/utils/utils"

const log = createLogger("atoms/storage-adapter")

export const storageAdapter = {
  async get<T>(key: string, fallback: T, schema: ZodSchema<T>): Promise<T> {
    if (!isExtensionContextAlive()) {
      return fallback
    }
    try {
      const value = await storage.getItem<T>(`local:${key}`)
      if (isNonNullish(value)) {
        const parsedValue = schema.safeParse(value)
        if (parsedValue.success) {
          return parsedValue.data
        }
      }
      return fallback
    } catch (error) {
      if (isExtensionContextInvalidatedError(error)) {
        return fallback
      }
      log.warn(`Failed to get storage item for ${key}:`, { error })
      return fallback
    }
  },
  async set<T>(key: string, value: T, schema: ZodSchema<T>) {
    if (!isExtensionContextAlive()) {
      return
    }
    const parsedValue = schema.safeParse(value)
    if (parsedValue.success) {
      try {
        await storage.setItem(`local:${key}`, parsedValue.data)
      } catch (error) {
        if (isExtensionContextInvalidatedError(error)) {
          return
        }
        throw error
      }
    } else {
      throw new Error(parsedValue.error.message)
    }
  },
  async setMeta(key: string, meta: Record<string, unknown>) {
    if (!isExtensionContextAlive()) {
      return
    }
    try {
      await storage.setMeta(`local:${key}`, meta)
    } catch (error) {
      if (isExtensionContextInvalidatedError(error)) {
        return
      }
      throw error
    }
  },
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- T preserves caller callback typing for typed storage values.
  watch<T>(key: string, callback: (newValue: T) => void) {
    if (!isExtensionContextAlive()) {
      return () => {}
    }
    try {
      const unwatch = storage.watch<T>(`local:${key}`, (newValue) => {
        if (!isExtensionContextAlive()) return
        if (isNonNullish(newValue)) callback(newValue)
      })
      return () => {
        if (!isExtensionContextAlive()) return
        try {
          unwatch()
        } catch {
          // Extension context may be dead during unmount/cleanup
        }
      }
    } catch {
      return () => {}
    }
  },
}
