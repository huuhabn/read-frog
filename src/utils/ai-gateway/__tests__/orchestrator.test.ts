import type { GatewayRouteCandidate } from "../types"
import { describe, expect, it, vi } from "vitest"
import { executeGatewayAttempts, executeGatewayStreamAttempts, GatewayError } from "../index"

const candidate: GatewayRouteCandidate = {
  routeId: "test",
  providerId: "test",
  operations: ["text.stream"],
  enabled: true,
  configurationOrder: 0,
}

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const output: T[] = []
  for await (const event of stream) output.push(event)
  return output
}

describe("gateway attempt orchestration", () => {
  it("falls back on retryable errors but not auth errors", async () => {
    const fallback = vi.fn<(signal: AbortSignal) => Promise<string>>(async () => "ok")
    await expect(
      executeGatewayAttempts(
        [
          {
            candidate,
            execute: async () => {
              throw Object.assign(new Error("busy"), { status: 503 })
            },
          },
          { candidate, execute: fallback },
        ],
        new AbortController().signal,
      ),
    ).resolves.toBe("ok")
    expect(fallback).toHaveBeenCalledOnce()

    const forbiddenFallback = vi.fn<(signal: AbortSignal) => Promise<string>>(
      async () => "unexpected",
    )
    await expect(
      executeGatewayAttempts(
        [
          {
            candidate,
            execute: async () => {
              throw Object.assign(new Error("bad key"), { status: 401 })
            },
          },
          { candidate, execute: forbiddenFallback },
        ],
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "auth" })
    expect(forbiddenFallback).not.toHaveBeenCalled()
  })

  it("does not start more than three attempts", async () => {
    const execute = vi.fn<(signal: AbortSignal) => Promise<string>>(async () => {
      throw new GatewayError("network", "offline")
    })
    await expect(
      executeGatewayAttempts(
        Array.from({ length: 4 }, () => ({ candidate, execute })),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "network" })
    expect(execute).toHaveBeenCalledTimes(3)
  })

  it("reports only allowlisted attempt diagnostics", async () => {
    const onAttemptComplete = vi.fn<(attempt: unknown) => void>()
    await expect(
      executeGatewayAttempts(
        [{ candidate, execute: async () => "ok" }],
        new AbortController().signal,
        { onAttemptComplete },
      ),
    ).resolves.toBe("ok")
    expect(onAttemptComplete).toHaveBeenCalledWith({
      providerId: "test",
      model: undefined,
      status: "success",
      latencyMs: expect.any(Number),
      estimatedCostUsd: undefined,
    })
    expect(JSON.stringify(onAttemptComplete.mock.calls)).not.toContain("apiKey")
  })

  it("honors abort before routing", async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      executeGatewayAttempts([{ candidate, execute: async () => "no" }], controller.signal),
    ).rejects.toMatchObject({ code: "aborted" })
  })

  it("falls back only before visible stream output", async () => {
    async function* failBefore() {
      yield* []
      throw new GatewayError("network", "offline")
    }
    async function* success() {
      yield { type: "text-delta", text: "ok" }
    }
    await expect(
      collect(
        executeGatewayStreamAttempts(
          [
            { candidate, execute: async () => failBefore() },
            { candidate, execute: async () => success() },
          ],
          new AbortController().signal,
          (event) => event.type === "text-delta",
        ),
      ),
    ).resolves.toEqual([{ type: "text-delta", text: "ok" }])

    async function* failAfter() {
      yield { type: "text-delta", text: "partial" }
      throw new GatewayError("network", "offline")
    }
    const fallback = vi.fn<
      (signal: AbortSignal) => Promise<AsyncIterable<{ type: string; text: string }>>
    >(async () => success())
    await expect(
      collect(
        executeGatewayStreamAttempts(
          [
            { candidate, execute: async () => failAfter() },
            { candidate, execute: fallback },
          ],
          new AbortController().signal,
          (event) => event.type === "text-delta",
        ),
      ),
    ).rejects.toMatchObject({ code: "network" })
    expect(fallback).not.toHaveBeenCalled()
  })
})
