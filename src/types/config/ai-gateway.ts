import { z } from "zod"

export const DEFAULT_AI_GATEWAY_CONFIG = {
  enabled: true,
  maxAttempts: 3,
  excludedProviderIds: [] as string[],
}

export const aiGatewayConfigSchema = z
  .object({
    enabled: z.boolean(),
    maxAttempts: z.number().int().min(1).max(3),
    excludedProviderIds: z.array(z.string()).default([]),
  })
  .default(DEFAULT_AI_GATEWAY_CONFIG)

export type AiGatewayConfig = z.infer<typeof aiGatewayConfigSchema>
