import fs from "node:fs"
import path from "node:path"
import Database from "better-sqlite3"
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import * as schema from "../schema/index.js"

export type GatewaySqliteDatabase = BetterSQLite3Database<typeof schema>

export interface OpenSqliteGatewayDatabaseOptions {
  /** File path or `:memory:`. Defaults to `GATEWAY_DB_PATH` or `:memory:`. */
  path?: string
}

const CREATE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    credential_mode TEXT NOT NULL DEFAULT 'hybrid',
    allowed_providers TEXT,
    allowed_models TEXT,
    default_provider TEXT,
    default_model TEXT,
    max_monthly_spend_usd TEXT,
    metadata TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    description TEXT,
    metadata TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    application_id TEXT REFERENCES applications(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    scopes TEXT NOT NULL,
    expires_at INTEGER,
    last_used_at INTEGER,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS provider_credentials (
    id TEXT PRIMARY KEY NOT NULL,
    scope TEXT NOT NULL,
    tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    label TEXT NOT NULL,
    encrypted_secret TEXT NOT NULL,
    masked_secret TEXT NOT NULL,
    base_url TEXT,
    organization_id TEXT,
    project_id TEXT,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    priority INTEGER NOT NULL DEFAULT 0,
    weight INTEGER NOT NULL DEFAULT 100,
    last_tested_at INTEGER,
    last_test_status TEXT,
    last_test_error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY NOT NULL,
    provider TEXT NOT NULL,
    upstream_model_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    modalities TEXT NOT NULL,
    capabilities TEXT NOT NULL,
    pricing TEXT NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS usage_records (
    id TEXT PRIMARY KEY NOT NULL,
    request_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    application_id TEXT,
    api_key_id TEXT,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    credential_id TEXT,
    credential_mode TEXT NOT NULL,
    status TEXT NOT NULL,
    usage TEXT NOT NULL,
    provider_cost_usd TEXT NOT NULL DEFAULT '0',
    customer_charge_usd TEXT NOT NULL DEFAULT '0',
    latency_ms INTEGER NOT NULL,
    first_token_latency_ms INTEGER,
    error_code TEXT,
    error_message TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS credit_reservations (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    request_id TEXT NOT NULL UNIQUE,
    estimated_credits TEXT NOT NULL,
    reserved_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'reserved'
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
    actor_id TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    changes TEXT,
    ip_address TEXT,
    user_agent TEXT,
    status TEXT NOT NULL DEFAULT 'success',
    metadata TEXT,
    created_at INTEGER NOT NULL
  )`,
]

export function resolveGatewayDbPath(explicit?: string): string {
  return explicit ?? process.env.GATEWAY_DB_PATH ?? ":memory:"
}

export function openSqliteGatewayDatabase(
  options: OpenSqliteGatewayDatabaseOptions = {},
): GatewaySqliteDatabase {
  const dbPath = resolveGatewayDbPath(options.path)
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true })
  }

  const sqlite = new Database(dbPath)
  sqlite.pragma("journal_mode = WAL")
  sqlite.pragma("foreign_keys = ON")
  for (const statement of CREATE_STATEMENTS) {
    sqlite.exec(statement)
  }

  return drizzle(sqlite, { schema })
}
