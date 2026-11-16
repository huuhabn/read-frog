import type { Config } from "@/types/config/config"
import type { LLMProviderConfig } from "@/types/config/provider"
import { DEFAULT_AI_GATEWAY_CONFIG } from "@/types/config/ai-gateway"
import { isLLMProviderConfig } from "@/types/config/provider"

export interface FallbackProviderPlan {
  fallbackProviders: LLMProviderConfig[]
  maxAttempts: number
}

/**
 * Applies the user's automatic routing settings: which other enabled LLM
 * providers may stand in for `primaryProviderId`, in configuration order.
 */
export function selectFallbackProviders(
  config: Pick<Config, "providersConfig" | "aiGateway"> | null | undefined,
  primaryProviderId: string,
): FallbackProviderPlan {
  const gateway = config?.aiGateway ?? DEFAULT_AI_GATEWAY_CONFIG
  if (!gateway.enabled) return { fallbackProviders: [], maxAttempts: 1 }

  const excluded = new Set(gateway.excludedProviderIds)
  const fallbackProviders = (config?.providersConfig ?? []).filter(
    (provider): provider is LLMProviderConfig =>
      provider.enabled &&
      provider.id !== primaryProviderId &&
      !excluded.has(provider.id) &&
      isLLMProviderConfig(provider),
  )
  return { fallbackProviders, maxAttempts: gateway.maxAttempts }
}
