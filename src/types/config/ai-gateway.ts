import { MAX_GATEWAY_ATTEMPTS } from "@workmate-ai/ai-gateway/routing"
import { z } from "zod"

export const DEFAULT_AI_GATEWAY_CONFIG = {
  enabled: true,
  maxAttempts: MAX_GATEWAY_ATTEMPTS,
  excludedProviderIds: [] as string[],
}

export const aiGatewayConfigSchema = z
  .object({
    enabled: z.boolean(),
    maxAttempts: z.number().int().min(1).max(MAX_GATEWAY_ATTEMPTS),
    excludedProviderIds: z.array(z.string()).default([]),
  })
  .default(DEFAULT_AI_GATEWAY_CONFIG)

export type AiGatewayConfig = z.infer<typeof aiGatewayConfigSchema>
