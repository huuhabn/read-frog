import type {
  AuditLogEntry,
  AuditAction,
  AuditResourceType,
  AuditActorType,
} from "../domain/entities/auditLog.js"
import type { AuditLogRepository, AuditLogFilter } from "../domain/ports/auditLogRepository.js"

export interface LogEventParams {
  tenantId?: string | null
  actorId?: string
  actorType?: AuditActorType
  action: AuditAction | (string & {})
  resourceType: AuditResourceType | (string & {})
  resourceId: string
  changes?: Record<string, { old?: unknown; new?: unknown }> | Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  status?: "success" | "failure"
  metadata?: Record<string, unknown>
}

export class AuditService {
  constructor(private auditRepo: AuditLogRepository) {}

  async logEvent(params: LogEventParams): Promise<AuditLogEntry> {
    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tenantId: params.tenantId || null,
      actorId: params.actorId || "system",
      actorType: params.actorType || "admin",
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      changes: params.changes,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      status: params.status || "success",
      metadata: params.metadata,
      createdAt: new Date(),
    }

    try {
      await this.auditRepo.record(entry)
    } catch (err) {
      // Audit logging should fail-open or log warning, not crash main business flow
      console.error("[AuditService] Failed to record audit log:", err)
    }

    return entry
  }

  async listLogs(filter?: AuditLogFilter): Promise<{ items: AuditLogEntry[]; total: number }> {
    return this.auditRepo.list(filter)
  }
}
