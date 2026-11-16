import type { AuditLogEntry } from "../entities/auditLog.js"

export interface AuditLogFilter {
  tenantId?: string
  resourceType?: string
  action?: string
  actorId?: string
  status?: "success" | "failure"
  from?: Date
  to?: Date
  limit?: number
  offset?: number
}

export interface AuditLogRepository {
  record(entry: AuditLogEntry): Promise<void>
  list(filter?: AuditLogFilter): Promise<{ items: AuditLogEntry[]; total: number }>
}
