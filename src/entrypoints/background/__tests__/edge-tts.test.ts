import { beforeEach, describe, expect, it, vi } from "vitest"

const handlers = new Map<string, (message: { data: any }) => Promise<any>>()
const synthesizeEdgeTTSMock = vi.fn<(...args: any[]) => Promise<any>>()

vi.mock("@/utils/message", () => ({
  onMessage: (name: string, handler: (message: { data: any }) => Promise<any>) => {
    handlers.set(name, handler)
  },
}))

vi.mock("@/utils/server/edge-tts", () => ({
  synthesizeEdgeTTS: synthesizeEdgeTTSMock,
  listEdgeTTSVoices: vi.fn<() => Promise<never[]>>(async () => []),
  getEdgeTTSHealthStatus: vi.fn<() => Promise<{ available: boolean }>>(async () => ({
    available: true,
  })),
}))

describe("Edge TTS gateway handlers", () => {
  beforeEach(async () => {
    handlers.clear()
    synthesizeEdgeTTSMock.mockReset()
    const { setupEdgeTTSMessageHandlers } = await import("../edge-tts")
    setupEdgeTTSMessageHandlers()
  })

  it("routes synthesis through a background-owned abort signal", async () => {
    synthesizeEdgeTTSMock.mockResolvedValue({
      ok: true,
      audio: new Uint8Array([65]).buffer,
      contentType: "audio/mpeg",
    })

    await expect(
      handlers.get("edgeTtsSynthesize")!({
        data: { requestId: "speech-1", text: "hello", voice: "en-US-AvaNeural" },
      }),
    ).resolves.toEqual({ ok: true, audioBase64: "QQ==", contentType: "audio/mpeg" })
    expect(synthesizeEdgeTTSMock).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "speech-1" }),
      expect.any(AbortSignal),
    )
  })

  it("aborts every in-flight chunk in the same synthesis request", async () => {
    const observedSignals: AbortSignal[] = []
    synthesizeEdgeTTSMock.mockImplementation(async (_data, signal: AbortSignal) => {
      observedSignals.push(signal)
      await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }))
      return { ok: false, error: { code: "UNKNOWN_ERROR", message: "aborted" } }
    })

    const syntheses = ["one", "two"].map((text) =>
      handlers.get("edgeTtsSynthesize")!({
        data: { requestId: "speech-2", text, voice: "en-US-AvaNeural" },
      }),
    )
    await vi.waitFor(() => expect(observedSignals).toHaveLength(2))
    await handlers.get("edgeTtsCancel")!({ data: { requestId: "speech-2" } })

    expect(observedSignals.every((signal) => signal.aborted)).toBe(true)
    await expect(Promise.all(syntheses)).resolves.toEqual([
      expect.objectContaining({ ok: false }),
      expect.objectContaining({ ok: false }),
    ])
  })
})
