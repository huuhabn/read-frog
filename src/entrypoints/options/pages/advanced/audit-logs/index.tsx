import { useEffect, useState } from "react"
import { Icon } from "@iconify/react"
import { useAtomValue } from "jotai"
import { Link } from "react-router"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/base-ui/alert-dialog"
import { Badge } from "@/components/ui/base-ui/badge"
import { Button } from "@/components/ui/base-ui/button"
import { Input } from "@/components/ui/base-ui/input"
import {
  clearAllAuditLogs,
  deleteAuditLog,
  queryAuditLogs,
} from "@/utils/audit-log/audit-log-service"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import type { AuditLogItem } from "@/utils/db/dexie/tables/audit-log"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"
import { PageLayout } from "../../../components/page-layout"
import { AuditLogDetailModal } from "./audit-log-detail-modal"

const PAGE_SIZE = 20

export function AuditLogsPage() {
  const auditLogConfig = useAtomValue(configFieldsAtomMap.auditLog)

  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "error" | "aborted">("all")
  const [typeFilter, setTypeFilter] = useState<"all" | "llm" | "translation">("all")
  const [isLoading, setIsLoading] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  useEffect(() => {
    let isCancelled = false
    if (refreshTrigger < 0) return

    const offset = (currentPage - 1) * PAGE_SIZE
    void queryAuditLogs({
      searchQuery,
      status: statusFilter,
      providerType: typeFilter,
      offset,
      limit: PAGE_SIZE,
    }).then(({ items, total }) => {
      if (!isCancelled) {
        setLogs(items)
        setTotalCount(total)
        setIsLoading(false)
      }
    })

    return () => {
      isCancelled = true
    }
  }, [currentPage, refreshTrigger, searchQuery, statusFilter, typeFilter])

  const handleDelete = async (id: string) => {
    setIsLoading(true)
    await deleteAuditLog(id)
    setRefreshTrigger((k) => k + 1)
  }

  const handleClearAll = async () => {
    setIsLoading(true)
    await clearAllAuditLogs()
    setRefreshTrigger((k) => k + 1)
  }

  const handleRefresh = () => {
    setIsLoading(true)
    setRefreshTrigger((k) => k + 1)
  }

  const handleSearchChange = (value: string) => {
    setIsLoading(true)
    setSearchQuery(value)
    setCurrentPage(1)
  }

  const handleStatusChange = (status: "all" | "success" | "error" | "aborted") => {
    setIsLoading(true)
    setStatusFilter(status)
    setCurrentPage(1)
  }

  const handleTypeChange = (type: "all" | "llm" | "translation") => {
    setIsLoading(true)
    setTypeFilter(type)
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    setIsLoading(true)
    setCurrentPage(page)
  }

  const handleViewDetail = (log: AuditLogItem) => {
    setSelectedLog(log)
    setIsDetailOpen(true)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <PageLayout
      title={i18n.t("options.advanced.auditLogs.title")}
      description={i18n.t("options.advanced.auditLogs.description")}
    >
      <div className="flex flex-col gap-5">
        {/* Banner if Audit Log is disabled */}
        {!auditLogConfig?.enabled && (
          <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <Icon icon="tabler:info-circle" className="size-4 shrink-0 text-amber-500" />
              <span>{i18n.t("options.advanced.auditLogs.disabledBanner")}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              render={<Link to="/preference" />}
              className="h-7 text-xs border-amber-500/40 hover:bg-amber-500/20"
            >
              {i18n.t("options.advanced.auditLogs.goToPreference")}
            </Button>
          </div>
        )}

        {/* Toolbar & Filters */}
        <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-muted/20 p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Icon
                icon="tabler:search"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
              />
              <Input
                placeholder={i18n.t("options.advanced.auditLogs.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="h-8 pl-8 text-xs bg-background"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value as typeof statusFilter)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="all">{i18n.t("options.advanced.auditLogs.filterStatusAll")}</option>
              <option value="success">{i18n.t("options.advanced.auditLogs.statusSuccess")}</option>
              <option value="error">{i18n.t("options.advanced.auditLogs.statusError")}</option>
              <option value="aborted">{i18n.t("options.advanced.auditLogs.statusAborted")}</option>
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => handleTypeChange(e.target.value as typeof typeFilter)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="all">{i18n.t("options.advanced.auditLogs.filterTypeAll")}</option>
              <option value="llm">AI / LLM</option>
              <option value="translation">{i18n.t("options.advanced.auditLogs.typeTranslation")}</option>
            </select>

            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              onClick={handleRefresh}
              title={i18n.t("options.advanced.auditLogs.refresh")}
            >
              <Icon icon="tabler:refresh" className={cn("size-4", isLoading && "animate-spin")} />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {i18n.t("options.advanced.auditLogs.totalCount", [String(totalCount)])}
            </span>

            {/* Clear All Dialog */}
            {totalCount > 0 && (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button variant="destructive" size="sm" className="h-8 gap-1.5 text-xs">
                      <Icon icon="tabler:trash" className="size-3.5" />
                      <span>{i18n.t("options.advanced.auditLogs.clearAll")}</span>
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{i18n.t("options.advanced.auditLogs.clearAllConfirmTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {i18n.t("options.advanced.auditLogs.clearAllConfirmDesc")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{i18n.t("options.advanced.auditLogs.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void handleClearAll()}>
                      {i18n.t("options.advanced.auditLogs.confirmDelete")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Log List / Table */}
        <div className="rounded-xl border border-border/80 bg-background overflow-hidden shadow-xs">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <Icon icon="tabler:file-x" className="size-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">
                {i18n.t("options.advanced.auditLogs.emptyTitle")}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {i18n.t("options.advanced.auditLogs.emptyDesc")}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="py-2.5 px-3">{i18n.t("options.advanced.auditLogs.time")}</th>
                    <th className="py-2.5 px-3">{i18n.t("options.advanced.auditLogs.feature")}</th>
                    <th className="py-2.5 px-3">{i18n.t("options.advanced.auditLogs.provider")}</th>
                    <th className="py-2.5 px-3">{i18n.t("options.advanced.auditLogs.promptContent")}</th>
                    <th className="py-2.5 px-3 text-right">{i18n.t("options.advanced.auditLogs.latency")}</th>
                    <th className="py-2.5 px-3 text-center">{i18n.t("options.advanced.auditLogs.status")}</th>
                    <th className="py-2.5 px-3 text-right">{i18n.t("options.advanced.auditLogs.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {logs.map((log) => {
                    const isSuccess = log.status === "success"
                    const isError = log.status === "error"

                    return (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-[11px] font-mono">
                          {new Intl.DateTimeFormat(undefined, {
                            dateStyle: "short",
                            timeStyle: "medium",
                          }).format(new Date(log.createdAt))}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                            {log.sourceFeature}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">{log.providerId}</span>
                            {log.model && (
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {log.model}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 max-w-xs truncate text-muted-foreground font-mono text-[11px]">
                          {log.prompt}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                          {log.latencyMs} ms
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <Badge
                            variant={isSuccess ? "default" : isError ? "destructive" : "secondary"}
                            className={cn(
                              "text-[10px] uppercase font-mono px-1.5 py-0.2",
                              isSuccess && "bg-emerald-600/90 text-white hover:bg-emerald-600",
                            )}
                          >
                            {log.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7"
                              onClick={() => handleViewDetail(log)}
                              title={i18n.t("options.advanced.auditLogs.viewDetail")}
                            >
                              <Icon icon="tabler:eye" className="size-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 text-muted-foreground hover:text-destructive"
                              onClick={() => void handleDelete(log.id)}
                              title={i18n.t("options.advanced.auditLogs.delete")}
                            >
                              <Icon icon="tabler:trash" className="size-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
              <span>
                {i18n.t("options.advanced.auditLogs.pageIndicator", [
                  String(currentPage),
                  String(totalPages),
                ])}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={currentPage <= 1}
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                >
                  {i18n.t("options.advanced.auditLogs.previous")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={currentPage >= totalPages}
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                >
                  {i18n.t("options.advanced.auditLogs.next")}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Modal */}
        <AuditLogDetailModal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          log={selectedLog}
        />
      </div>
    </PageLayout>
  )
}
