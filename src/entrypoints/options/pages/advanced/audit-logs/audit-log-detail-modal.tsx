import type { AuditLogItem, AuditLogMessage } from "@/utils/db/dexie/tables/audit-log"
import { Icon } from "@iconify/react"
import { useMemo, useState } from "react"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { Badge } from "@/components/ui/base-ui/badge"
import { Button } from "@/components/ui/base-ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/base-ui/dialog"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"

interface AuditLogDetailModalProps {
  isOpen: boolean
  onClose: () => void
  log: AuditLogItem | null
}

export function AuditLogDetailModal({ isOpen, onClose, log }: AuditLogDetailModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [showRawJson, setShowRawJson] = useState(false)

  const messagesWithKeys = useMemo(
    () =>
      (log?.messages ?? []).map((msg, idx) => ({
        ...msg,
        key: `${log?.id ?? "log"}-msg-${idx}-${msg.role}`,
      })),
    [log?.id, log?.messages],
  )

  if (!log) return null

  const handleCopy = async (text: string, fieldName: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const formatTimestamp = (d: Date) => {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(new Date(d))
  }

  const renderMessageContent = (content: unknown) => {
    if (typeof content === "string") return content
    try {
      return JSON.stringify(content, null, 2)
    } catch {
      return String(content)
    }
  }

  const hasMessages = Array.isArray(log.messages) && log.messages.length > 0
  const hasTokenUsage =
    log.tokenUsage &&
    (typeof log.tokenUsage.promptTokens === "number" ||
      typeof log.tokenUsage.completionTokens === "number" ||
      typeof log.tokenUsage.totalTokens === "number")

  const rawJsonContent = JSON.stringify(log.rawPayload ?? log, null, 2)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[88vh] max-w-3xl flex-col gap-4 overflow-hidden p-6">
        <DialogHeader className="border-b border-border/60 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Icon icon="tabler:file-text" className="size-5 text-primary" />
              <span>{i18n.t("options.advanced.auditLogs.detailTitle")}</span>
            </DialogTitle>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant={
                  log.status === "success"
                    ? "default"
                    : log.status === "error"
                      ? "destructive"
                      : "secondary"
                }
                className={cn(
                  "font-mono text-xs uppercase",
                  log.status === "success" && "bg-emerald-600/90 text-white hover:bg-emerald-600",
                )}
              >
                {log.status}
              </Badge>
              <Badge variant="outline" className="font-mono text-xs">
                {log.latencyMs} ms
              </Badge>
              {hasTokenUsage && (
                <Badge
                  variant="secondary"
                  className="gap-1 font-mono text-[11px] font-normal text-muted-foreground"
                >
                  <Icon icon="tabler:coin" className="size-3 text-amber-500" />
                  <span>
                    P: {log.tokenUsage?.promptTokens ?? "-"} | C:{" "}
                    {log.tokenUsage?.completionTokens ?? "-"} | Total:{" "}
                    {log.tokenUsage?.totalTokens ?? "-"}
                  </span>
                </Badge>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">
                {i18n.t("options.advanced.auditLogs.time")}:{" "}
              </span>
              {formatTimestamp(log.createdAt)}
            </div>
            <div>
              <span className="font-medium text-foreground">
                {i18n.t("options.advanced.auditLogs.feature")}:{" "}
              </span>
              <span className="font-semibold text-foreground">{log.sourceFeature}</span>
            </div>
            <div>
              <span className="font-medium text-foreground">
                {i18n.t("options.advanced.auditLogs.provider")}:{" "}
              </span>
              {log.providerId} {log.model ? `(${log.model})` : ""}
            </div>
            {log.url && (
              <div className="flex max-w-full items-center gap-1 truncate">
                <Icon icon="tabler:world" className="size-3.5 shrink-0 text-primary/70" />
                <span className="truncate" title={log.url}>
                  {log.url}
                </span>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto pr-1 text-xs">
          {/* Error Message if present */}
          {log.errorMessage && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
              <div className="flex items-center gap-1.5 font-semibold">
                <Icon icon="tabler:alert-triangle" className="size-4" />
                <span>{i18n.t("options.advanced.auditLogs.errorMessage")}</span>
              </div>
              <p className="mt-1 font-mono text-[11px] whitespace-pre-wrap">{log.errorMessage}</p>
            </div>
          )}

          {/* System Prompt Section */}
          {log.systemPrompt && (
            <div className="rounded-lg border border-border/80 bg-muted/30 p-3">
              <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Icon icon="tabler:terminal" className="size-4 text-primary" />
                  System Prompt
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 px-1.5 text-[11px]"
                  onClick={() => void handleCopy(log.systemPrompt || "", "systemPrompt")}
                >
                  <Icon
                    icon={copiedField === "systemPrompt" ? "tabler:check" : "tabler:copy"}
                    className={cn("size-3.5", copiedField === "systemPrompt" && "text-emerald-500")}
                  />
                  <span>{copiedField === "systemPrompt" ? "Đã chép" : "Sao chép"}</span>
                </Button>
              </div>
              <p className="mt-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground select-text">
                {log.systemPrompt}
              </p>
            </div>
          )}

          {/* Messages Timeline (Structured Turns) */}
          {hasMessages ? (
            <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Icon icon="tabler:messages" className="size-4 text-primary" />
                  <span>Lịch sử hội thoại ({log.messages?.length} tin nhắn)</span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 px-1.5 text-[11px]"
                  onClick={() =>
                    void handleCopy(
                      log.messages
                        ?.map(
                          (m: AuditLogMessage) =>
                            `[${m.role.toUpperCase()}]\n${renderMessageContent(m.content)}`,
                        )
                        .join("\n\n") || "",
                      "allMessages",
                    )
                  }
                >
                  <Icon
                    icon={copiedField === "allMessages" ? "tabler:check" : "tabler:copy"}
                    className={cn("size-3.5", copiedField === "allMessages" && "text-emerald-500")}
                  />
                  <span>
                    {copiedField === "allMessages" ? "Đã chép tất cả" : "Sao chép tất cả"}
                  </span>
                </Button>
              </div>

              <div className="mt-3 space-y-3">
                {messagesWithKeys.map((msg, idx) => {
                  const isUser = msg.role === "user"
                  const isAssistant = msg.role === "assistant"
                  const copyKey = `msg_${idx}`

                  return (
                    <div
                      key={msg.key}
                      className={cn(
                        "rounded-md border p-2.5 transition-colors",
                        isUser
                          ? "border-primary/25 bg-primary/5"
                          : isAssistant
                            ? "border-emerald-500/25 bg-emerald-500/5"
                            : "border-border/60 bg-muted/30",
                      )}
                    >
                      <div className="flex items-center justify-between border-b border-border/30 pb-1">
                        <div className="flex items-center gap-1.5">
                          <Icon
                            icon={
                              isUser
                                ? "tabler:user"
                                : isAssistant
                                  ? "tabler:sparkles"
                                  : "tabler:code"
                            }
                            className={cn(
                              "size-3.5",
                              isUser
                                ? "text-primary"
                                : isAssistant
                                  ? "text-emerald-500"
                                  : "text-muted-foreground",
                            )}
                          />
                          <Badge
                            variant="outline"
                            className={cn(
                              "px-1 py-0 font-mono text-[9px] tracking-wide uppercase",
                              isUser
                                ? "border-primary/40 text-primary"
                                : isAssistant
                                  ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                                  : "text-muted-foreground",
                            )}
                          >
                            {msg.role}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 gap-1 px-1 text-[10px]"
                          onClick={() =>
                            void handleCopy(renderMessageContent(msg.content), copyKey)
                          }
                        >
                          <Icon
                            icon={copiedField === copyKey ? "tabler:check" : "tabler:copy"}
                            className={cn("size-3", copiedField === copyKey && "text-emerald-500")}
                          />
                          <span>{copiedField === copyKey ? "Đã chép" : "Sao chép"}</span>
                        </Button>
                      </div>
                      <p className="mt-1.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground select-text">
                        {renderMessageContent(msg.content)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* Fallback to simple Prompt block if messages array is absent */
            <div className="rounded-lg border border-border/80 bg-muted/30 p-3">
              <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Icon icon="tabler:message-circle" className="size-4 text-primary" />
                  {i18n.t("options.advanced.auditLogs.promptContent")}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 px-1.5 text-[11px]"
                  onClick={() => void handleCopy(log.prompt, "prompt")}
                >
                  <Icon
                    icon={copiedField === "prompt" ? "tabler:check" : "tabler:copy"}
                    className={cn("size-3.5", copiedField === "prompt" && "text-emerald-500")}
                  />
                  <span>{copiedField === "prompt" ? "Đã chép" : "Sao chép"}</span>
                </Button>
              </div>
              <p className="mt-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground select-text">
                {log.prompt}
              </p>
            </div>
          )}

          {/* Reasoning / Thinking if present */}
          {log.thinking && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-1.5">
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Icon icon="tabler:brain" className="size-4 text-amber-500" />
                  Reasoning / Thinking Process
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 px-1.5 text-[11px]"
                  onClick={() => void handleCopy(log.thinking || "", "thinking")}
                >
                  <Icon
                    icon={copiedField === "thinking" ? "tabler:check" : "tabler:copy"}
                    className={cn("size-3.5", copiedField === "thinking" && "text-emerald-500")}
                  />
                  <span>{copiedField === "thinking" ? "Đã chép" : "Sao chép"}</span>
                </Button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground italic select-text">
                {log.thinking}
              </p>
            </div>
          )}

          {/* Response Output */}
          <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
            <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                <Icon icon="tabler:sparkles" className="size-4 text-primary" />
                {i18n.t("options.advanced.auditLogs.responseOutput")}
              </span>
              {log.responseOutput && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 px-1.5 text-[11px]"
                  onClick={() => void handleCopy(log.responseOutput || "", "output")}
                >
                  <Icon
                    icon={copiedField === "output" ? "tabler:check" : "tabler:copy"}
                    className={cn("size-3.5", copiedField === "output" && "text-emerald-500")}
                  />
                  <span>{copiedField === "output" ? "Đã chép" : "Sao chép"}</span>
                </Button>
              )}
            </div>
            <div className="mt-2 select-text">
              {log.responseOutput ? (
                <MarkdownRenderer content={log.responseOutput} />
              ) : (
                <p className="text-[11px] text-muted-foreground italic">
                  {log.status === "error" ? "(Không có phản hồi do lỗi)" : "(Phản hồi rỗng)"}
                </p>
              )}
            </div>
          </div>

          {/* Parameters & Technical Metadata */}
          {log.parameters && Object.keys(log.parameters).length > 0 && (
            <div className="rounded-lg border border-border/60 bg-muted/10 p-2.5">
              <span className="text-[11px] font-medium text-muted-foreground">
                {i18n.t("options.advanced.auditLogs.parameters")}:
              </span>
              <pre className="mt-1 font-mono text-[10px] whitespace-pre-wrap text-muted-foreground select-text">
                {JSON.stringify(log.parameters, null, 2)}
              </pre>
            </div>
          )}

          {/* Raw JSON Toggle & Viewer */}
          <div className="rounded-lg border border-border/60 bg-muted/10 p-2.5">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1.5 px-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setShowRawJson(!showRawJson)}
              >
                <Icon
                  icon={showRawJson ? "tabler:chevron-down" : "tabler:chevron-right"}
                  className="size-3.5"
                />
                <Icon icon="tabler:code" className="size-3.5 text-primary" />
                <span>Raw JSON Payload ({showRawJson ? "Ẩn" : "Xem"})</span>
              </Button>
              {showRawJson && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 px-1.5 text-[11px]"
                  onClick={() => void handleCopy(rawJsonContent, "rawJson")}
                >
                  <Icon
                    icon={copiedField === "rawJson" ? "tabler:check" : "tabler:copy"}
                    className={cn("size-3.5", copiedField === "rawJson" && "text-emerald-500")}
                  />
                  <span>{copiedField === "rawJson" ? "Đã chép JSON" : "Sao chép JSON"}</span>
                </Button>
              )}
            </div>

            {showRawJson && (
              <pre className="mt-2 max-h-60 overflow-y-auto rounded border border-border/40 bg-background/80 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground select-text">
                {rawJsonContent}
              </pre>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
