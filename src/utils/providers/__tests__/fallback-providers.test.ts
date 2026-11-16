import { describe, expect, it } from "vitest"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { selectFallbackProviders } from "../fallback-providers"

const primary = { ...DEFAULT_PROVIDER_CONFIG.openai, id: "primary", enabled: true }
const second = { ...DEFAULT_PROVIDER_CONFIG.openai, id: "second", enabled: true }
const disabled = { ...DEFAULT_PROVIDER_CONFIG.openai, id: "disabled", enabled: false }
const excluded = { ...DEFAULT_PROVIDER_CONFIG.openai, id: "excluded", enabled: true }

describe("selectFallbackProviders", () => {
  it("keeps enabled, non-excluded LLM providers other than the primary", () => {
    const plan = selectFallbackProviders(
      {
        providersConfig: [primary, second, disabled, excluded],
        aiGateway: { enabled: true, maxAttempts: 2, excludedProviderIds: ["excluded"] },
      },
      "primary",
    )

    expect(plan.fallbackProviders.map((provider) => provider.id)).toEqual(["second"])
    expect(plan.maxAttempts).toBe(2)
  })

  it("returns a single attempt when automatic routing is off", () => {
    const plan = selectFallbackProviders(
      {
        providersConfig: [primary, second],
        aiGateway: { enabled: false, maxAttempts: 3, excludedProviderIds: [] },
      },
      "primary",
    )

    expect(plan).toEqual({ fallbackProviders: [], maxAttempts: 1 })
  })
})
