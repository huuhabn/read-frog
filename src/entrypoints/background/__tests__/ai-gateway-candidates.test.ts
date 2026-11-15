import type { BackgroundGenerateTextPayload } from "@/types/background-generate-text"
import { describe, expect, it } from "vitest"
import { buildBackgroundGenerateTextCandidates } from "../ai-gateway-candidates"

function localRef(id: string) {
  return {
    kind: "local" as const,
    config: { id, provider: "openai", enabled: true } as never,
  }
}

describe("buildBackgroundGenerateTextCandidates", () => {
  it("keeps secret-bearing configs out of candidate metadata and deduplicates routes", () => {
    const primary = localRef("primary")
    const fallback = localRef("fallback")
    const payload = {
      providerRef: primary,
      fallbackProviderRefs: [primary, fallback],
      instructions: "system",
      prompt: "hello",
    } satisfies BackgroundGenerateTextPayload

    const result = buildBackgroundGenerateTextCandidates(payload)

    expect(result.map(({ candidate }) => candidate)).toEqual([
      expect.objectContaining({ routeId: "local:primary", configurationOrder: 0 }),
      expect.objectContaining({ routeId: "local:fallback", configurationOrder: 2 }),
    ])
    expect(JSON.stringify(result.map(({ candidate }) => candidate))).not.toContain("apiKey")
  })
})
