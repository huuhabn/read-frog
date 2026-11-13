import type { JSONValue } from "ai"
import type { AISDKReasoning, LLMProviderConfig } from "@/types/config/provider"
import { resolveModelId } from "@/utils/providers/model-id"
import {
  getProviderOptionsWithOverride,
  getRecommendedProviderOptions,
} from "@/utils/providers/options"
import { getTopLevelReasoning } from "@/utils/providers/reasoning"

export interface LocalGenerateTextParams {
  reasoning: AISDKReasoning | undefined
  temperature: number | undefined
  providerOptions: Record<string, Record<string, JSONValue>> | undefined
}

function resolveReasoningForModel(
  provider: string,
  modelName: string | undefined,
  reasoning: AISDKReasoning | undefined,
): AISDKReasoning | undefined {
  if (provider === "google" && reasoning === "none" && modelName) {
    const recommended = getRecommendedProviderOptions(modelName)
    const thinkingConfig = recommended?.thinkingConfig as { thinkingLevel?: string } | undefined
    if (thinkingConfig?.thinkingLevel === "minimal") {
      return "minimal"
    }
    if (thinkingConfig?.thinkingLevel === "low") {
      return "low"
    }
  }
  return reasoning
}

/**
 * The per-provider knobs every non-streaming local call passes to the AI SDK.
 * Extracted because the exact `getTopLevelReasoning` + `resolveModelId` +
 * `getProviderOptionsWithOverride` triple was copy-pasted verbatim in the
 * article summary, subtitle segmentation, and language detection paths, and
 * routing all three through one hosted/local helper needs a single source for
 * it.
 */
export function buildLocalGenerateTextParams(config: LLMProviderConfig): LocalGenerateTextParams {
  const rawReasoning = getTopLevelReasoning(config)
  const modelName = resolveModelId(config.model)
  const reasoning = resolveReasoningForModel(config.provider, modelName, rawReasoning)

  return {
    reasoning,
    temperature: config.temperature,
    providerOptions: getProviderOptionsWithOverride(
      modelName ?? "",
      config.provider,
      config.providerOptions,
      reasoning,
    ),
  }
}
