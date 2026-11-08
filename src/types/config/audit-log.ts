import { z } from "zod"

export const DEFAULT_AUDIT_LOG_CONFIG = {
  enabled: false,
  retentionDays: 30,
  maxLogs: 1000,
} as const

export const auditLogConfigSchema = z
  .object({
    enabled: z.boolean(),
    retentionDays: z.number().int().min(1).max(365),
    maxLogs: z.number().int().min(50).max(10000),
  })
  .default(DEFAULT_AUDIT_LOG_CONFIG)

export type AuditLogConfig = z.infer<typeof auditLogConfigSchema>
