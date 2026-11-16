import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const tenantsTable = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: text("status").notNull().default("active"),
  credentialMode: text("credential_mode").notNull().default("hybrid"),
  allowedProviders: text("allowed_providers", { mode: "json" }).$type<string[]>(),
  allowedModels: text("allowed_models", { mode: "json" }).$type<string[]>(),
  defaultProvider: text("default_provider"),
  defaultModel: text("default_model"),
  maxMonthlySpendUsd: text("max_monthly_spend_usd"),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

export const applicationsTable = sqliteTable("applications", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  status: text("status").notNull().default("active"),
  description: text("description"),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

export const apiKeysTable = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  applicationId: text("application_id").references(() => applicationsTable.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(),
  scopes: text("scopes", { mode: "json" }).$type<string[]>().notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})
