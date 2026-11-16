import type {
  AuditAction,
  AuditActorType,
  AuditResourceType,
} from "../../../domain/entities/auditLog.js"
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { tenantsTable } from "./tenants.js"

export const auditLogsTable = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").references(() => tenantsTable.id, { onDelete: "cascade" }),
  actorId: text("actor_id").notNull(),
  actorType: text("actor_type").$type<AuditActorType>().notNull(),
  action: text("action").$type<AuditAction | (string & {})>().notNull(),
  resourceType: text("resource_type").$type<AuditResourceType | (string & {})>().notNull(),
  resourceId: text("resource_id").notNull(),
  changes: text("changes", { mode: "json" }).$type<Record<string, unknown>>(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  status: text("status").notNull().default("success"),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})
