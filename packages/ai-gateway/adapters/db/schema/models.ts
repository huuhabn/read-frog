import type { Modality, ModelCapabilities, ModelPricing } from "../../../domain/entities/model.js"
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const modelsTable = sqliteTable("models", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  upstreamModelId: text("upstream_model_id").notNull(),
  displayName: text("display_name").notNull(),
  modalities: text("modalities", { mode: "json" }).$type<Modality[]>().notNull(),
  capabilities: text("capabilities", { mode: "json" }).$type<ModelCapabilities>().notNull(),
  pricing: text("pricing", { mode: "json" }).$type<ModelPricing>().notNull(),
  isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})
