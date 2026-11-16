import type { RequestStatus, TokenUsage } from "../../../domain/entities/usage.js"
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { tenantsTable } from "./tenants.js"

export const usageRecordsTable = sqliteTable("usage_records", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  applicationId: text("application_id"),
  apiKeyId: text("api_key_id"),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  credentialId: text("credential_id"),
  credentialMode: text("credential_mode").notNull(),
  status: text("status").$type<RequestStatus>().notNull(),
  usage: text("usage", { mode: "json" }).$type<TokenUsage>().notNull(),
  providerCostUsd: text("provider_cost_usd").notNull().default("0"),
  customerChargeUsd: text("customer_charge_usd").notNull().default("0"),
  latencyMs: integer("latency_ms").notNull(),
  firstTokenLatencyMs: integer("first_token_latency_ms"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})

export const creditReservationsTable = sqliteTable("credit_reservations", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  requestId: text("request_id").notNull().unique(),
  estimatedCredits: text("estimated_credits").notNull(),
  reservedAt: integer("reserved_at", { mode: "timestamp_ms" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  status: text("status").notNull().default("reserved"),
})
