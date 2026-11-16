export type AuditActorType = "admin" | "tenant" | "system" | "api_key"

export type AuditAction =
  | "tenant.create"
  | "tenant.update"
  | "tenant.delete"
  | "credential.create"
  | "credential.rotate"
  | "credential.revoke"
  | "credential.delete"
  | "apikey.create"
  | "apikey.revoke"
  | "policy.update"
  | "credit.adjust"
  | "security.unauthorized_access"
  | "security.tamper_detected"

export type AuditResourceType =
  | "tenant"
  | "application"
  | "credential"
  | "apikey"
  | "policy"
  | "credit_account"
  | "system"

export interface AuditLogEntry {
  id: string
  tenantId?: string | null
  actorId: string
  actorType: AuditActorType
  action: AuditAction | (string & {})
  resourceType: AuditResourceType | (string & {})
  resourceId: string
  changes?: Record<string, { old?: unknown; new?: unknown }> | Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  status: "success" | "failure"
  metadata?: Record<string, unknown>
  createdAt: Date
}
