import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { tenantsTable } from "./tenants.js"

export const providerCredentialsTable = sqliteTable("provider_credentials", {
  id: text("id").primaryKey(),
  scope: text("scope").notNull(),
  tenantId: text("tenant_id").references(() => tenantsTable.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  label: text("label").notNull(),
  encryptedSecret: text("encrypted_secret").notNull(),
  maskedSecret: text("masked_secret").notNull(),
  baseUrl: text("base_url"),
  organizationId: text("organization_id"),
  projectId: text("project_id"),
  isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
  priority: integer("priority").notNull().default(0),
  weight: integer("weight").notNull().default(100),
  lastTestedAt: integer("last_tested_at", { mode: "timestamp_ms" }),
  lastTestStatus: text("last_test_status"),
  lastTestError: text("last_test_error"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})
