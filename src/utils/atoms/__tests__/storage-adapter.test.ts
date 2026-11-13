// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { browser, storage } from "#imports"
import { storageAdapter } from "../storage-adapter"

const schema = z.object({
  foo: z.string(),
})

type TestType = z.infer<typeof schema>

const liveRuntimeId = browser.runtime.id

function killExtensionContext() {
  Object.defineProperty(browser.runtime, "id", { configurable: true, value: undefined })
}

describe("storageAdapter context invalidation handling", () => {
  beforeEach(() => {
    Object.defineProperty(browser.runtime, "id", { configurable: true, value: liveRuntimeId })
    vi.restoreAllMocks()
  })

  afterEach(() => {
    Object.defineProperty(browser.runtime, "id", { configurable: true, value: liveRuntimeId })
  })

  describe("get", () => {
    it("returns parsed data when valid", async () => {
      vi.spyOn(storage, "getItem").mockResolvedValueOnce({ foo: "bar" })
      const result = await storageAdapter.get<TestType>("testKey", { foo: "fallback" }, schema)
      expect(result).toEqual({ foo: "bar" })
    })

    it("returns fallback immediately when extension context is dead", async () => {
      killExtensionContext()
      const getItemSpy = vi.spyOn(storage, "getItem")
      const result = await storageAdapter.get<TestType>("testKey", { foo: "fallback" }, schema)
      expect(result).toEqual({ foo: "fallback" })
      expect(getItemSpy).not.toHaveBeenCalled()
    })

    it("returns fallback when storage.getItem throws Extension context invalidated", async () => {
      vi.spyOn(storage, "getItem").mockRejectedValueOnce(
        new Error("Extension context invalidated."),
      )
      const result = await storageAdapter.get<TestType>("testKey", { foo: "fallback" }, schema)
      expect(result).toEqual({ foo: "fallback" })
    })

    it("returns fallback when schema validation fails", async () => {
      vi.spyOn(storage, "getItem").mockResolvedValueOnce({ invalid: 123 })
      const result = await storageAdapter.get<TestType>("testKey", { foo: "fallback" }, schema)
      expect(result).toEqual({ foo: "fallback" })
    })
  })

  describe("set", () => {
    it("persists data when valid and alive", async () => {
      const setItemSpy = vi.spyOn(storage, "setItem").mockResolvedValueOnce()
      await storageAdapter.set("testKey", { foo: "bar" }, schema)
      expect(setItemSpy).toHaveBeenCalledWith("local:testKey", { foo: "bar" })
    })

    it("no-ops when extension context is dead", async () => {
      killExtensionContext()
      const setItemSpy = vi.spyOn(storage, "setItem")
      await storageAdapter.set("testKey", { foo: "bar" }, schema)
      expect(setItemSpy).not.toHaveBeenCalled()
    })

    it("swallows Extension context invalidated error during setItem", async () => {
      vi.spyOn(storage, "setItem").mockRejectedValueOnce(
        new Error("Extension context invalidated."),
      )
      await expect(storageAdapter.set("testKey", { foo: "bar" }, schema)).resolves.not.toThrow()
    })
  })

  describe("setMeta", () => {
    it("persists meta when alive", async () => {
      const setMetaSpy = vi.spyOn(storage, "setMeta").mockResolvedValueOnce()
      await storageAdapter.setMeta("testKey", { modifiedAt: 123 })
      expect(setMetaSpy).toHaveBeenCalledWith("local:testKey", { modifiedAt: 123 })
    })

    it("no-ops when extension context is dead", async () => {
      killExtensionContext()
      const setMetaSpy = vi.spyOn(storage, "setMeta")
      await storageAdapter.setMeta("testKey", { modifiedAt: 123 })
      expect(setMetaSpy).not.toHaveBeenCalled()
    })
  })

  describe("watch", () => {
    it("returns no-op unwatch when context is dead", () => {
      killExtensionContext()
      const watchSpy = vi.spyOn(storage, "watch")
      const unwatch = storageAdapter.watch("testKey", () => {})
      expect(typeof unwatch).toBe("function")
      expect(watchSpy).not.toHaveBeenCalled()
      expect(() => unwatch()).not.toThrow()
    })

    it("calls callback when value arrives and alive", () => {
      let registeredListener: Parameters<typeof storage.watch>[1] | undefined
      vi.spyOn(storage, "watch").mockImplementationOnce((_key, listener) => {
        registeredListener = listener
        return () => {}
      })
      const callback = vi.fn<(val: unknown) => void>()
      storageAdapter.watch("testKey", callback)
      expect(registeredListener).toBeDefined()
      registeredListener?.({ foo: "baz" }, { foo: "prev" })
      expect(callback).toHaveBeenCalledWith({ foo: "baz" })
    })

    it("ignores notification when context becomes dead", () => {
      let registeredListener: Parameters<typeof storage.watch>[1] | undefined
      vi.spyOn(storage, "watch").mockImplementationOnce((_key, listener) => {
        registeredListener = listener
        return () => {}
      })
      const callback = vi.fn<(val: unknown) => void>()
      storageAdapter.watch("testKey", callback)
      killExtensionContext()
      registeredListener?.({ foo: "baz" }, { foo: "prev" })
      expect(callback).not.toHaveBeenCalled()
    })
  })
})
