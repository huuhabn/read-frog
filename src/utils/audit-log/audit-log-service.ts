import type { AuditLogItem } from "@/utils/db/dexie/tables/audit-log"
import { getLocalConfig } from "@/utils/config/storage"
import { db } from "@/utils/db/dexie/db"

export type AuditLogEntryInput = Omit<AuditLogItem, "id" | "createdAt">

export async function recordAuditLog(entry: AuditLogEntryInput): Promise<string | null> {
  try {
    const config = await getLocalConfig()
    if (!config?.auditLog?.enabled) {
      return null
    }

    const id = crypto.randomUUID()
    const item: AuditLogItem = {
      ...entry,
      id,
      createdAt: new Date(),
    }

    await db.auditLog.add(item)

    // Schedule background cleanup without blocking the response
    void pruneAuditLogs(config.auditLog.retentionDays, config.auditLog.maxLogs).catch((err) => {
      console.warn("[AuditLog] Failed to prune logs:", err)
    })

    return id
  } catch (error) {
    console.error("[AuditLog] Failed to record audit log:", error)
    return null
  }
}

export async function pruneAuditLogs(retentionDays = 30, maxLogs = 1000): Promise<void> {
  try {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

    // Delete logs older than retentionDays
    await db.auditLog.where("createdAt").below(cutoffDate).delete()

    // If total exceeds maxLogs, delete oldest ones
    const count = await db.auditLog.count()
    if (count > maxLogs) {
      const excess = count - maxLogs
      const oldestKeys = await db.auditLog.orderBy("createdAt").limit(excess).primaryKeys()
      if (oldestKeys.length > 0) {
        await db.auditLog.bulkDelete(oldestKeys)
      }
    }
  } catch (error) {
    console.error("[AuditLog] Error during pruning:", error)
  }
}

export async function deleteAuditLog(id: string): Promise<void> {
  await db.auditLog.delete(id)
}

export async function clearAllAuditLogs(): Promise<void> {
  await db.auditLog.clear()
}

export interface QueryAuditLogsOptions {
  searchQuery?: string
  providerId?: string
  providerType?: "llm" | "translation" | "other" | "all"
  status?: "success" | "error" | "aborted" | "all"
  offset?: number
  limit?: number
}

export interface QueryAuditLogsResult {
  items: AuditLogItem[]
  total: number
}

export async function queryAuditLogs(
  options: QueryAuditLogsOptions = {},
): Promise<QueryAuditLogsResult> {
  const {
    searchQuery = "",
    providerId,
    providerType = "all",
    status = "all",
    offset = 0,
    limit = 50,
  } = options

  const collection = db.auditLog.orderBy("createdAt").reverse()
  let allItems: AuditLogItem[] = await collection.toArray()

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim()
    allItems = allItems.filter((item) => {
      const promptMatch = item.prompt?.toLowerCase().includes(q)
      const outputMatch = item.responseOutput?.toLowerCase().includes(q)
      const modelMatch = item.model?.toLowerCase().includes(q)
      const featureMatch = item.sourceFeature?.toLowerCase().includes(q)
      return promptMatch || outputMatch || modelMatch || featureMatch
    })
  }

  if (providerId && providerId !== "all") {
    allItems = allItems.filter((item) => item.providerId === providerId)
  }

  if (providerType && providerType !== "all") {
    allItems = allItems.filter((item) => item.providerType === providerType)
  }

  if (status && status !== "all") {
    allItems = allItems.filter((item) => item.status === status)
  }

  const total = allItems.length
  const items = allItems.slice(offset, offset + limit)

  return { items, total }
}
