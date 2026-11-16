import { Check, Copy, CornerDownLeft, MessageSquareOff, Settings } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { i18n } from "@/utils/i18n"
import { openOptionsPage } from "@/utils/navigation"

interface ResultStreamProps {
  content: string
  secondaryContent?: string
  loading: boolean
  onInsertToChat: (text: string) => void
  isUnsupported?: boolean
}

export function ResultStream({
  content,
  secondaryContent,
  loading,
  onInsertToChat,
  isUnsupported = false,
}: ResultStreamProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Fallback
    }
  }

  if (isUnsupported) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
          <MessageSquareOff className="size-5" />
        </div>
        <h4 className="mb-1 text-xs font-semibold text-foreground">
          {i18n.t("options.webChat.sidepanel.unsupportedTitle")}
        </h4>
        <p className="max-w-[260px] text-[11px] leading-relaxed text-muted-foreground">
          {i18n.t("options.webChat.sidepanel.unsupportedDesc")}
        </p>
        <div className="mt-4 flex flex-col items-center gap-2 border-t border-border/40 pt-3">
          <span className="text-[10px] font-medium text-muted-foreground/80">
            {i18n.t("options.webChat.sidepanel.supportedPlatformsTitle")}
          </span>
          <div className="flex flex-wrap justify-center gap-1.5">
            <span className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-500">
              Zalo Web
            </span>
            <span className="rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-500">
              Telegram Web
            </span>
            <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
              Slack
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void openOptionsPage({ route: "/web-chat" })}
            className="mt-1 h-7 gap-1.5 rounded-lg border-border/60 bg-muted/40 px-2.5 text-[11px] font-medium text-foreground/90 transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings className="size-3 text-muted-foreground" />
            <span>{i18n.t("options.webChat.sidepanel.configureGenericChat")}</span>
          </Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <div className="mb-3 size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-xs">{i18n.t("options.webChat.sidepanel.processing")}</p>
      </div>
    )
  }

  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground/60">
        <p className="text-xs">{i18n.t("options.webChat.sidepanel.emptyPrompt")}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="rounded-lg border border-border/60 bg-muted/20 p-3 shadow-xs">
        <div className="text-xs leading-relaxed whitespace-pre-wrap text-foreground select-text">
          {content}
        </div>

        {secondaryContent && (
          <div className="mt-2.5 border-t border-border/40 pt-2 text-[11px] text-muted-foreground italic select-text">
            {secondaryContent}
          </div>
        )}

        <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-border/40 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
            <span>
              {copied
                ? i18n.t("options.webChat.sidepanel.copied")
                : i18n.t("options.webChat.sidepanel.copy")}
            </span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => onInsertToChat(content)}
            className="h-7 gap-1 px-2.5 text-[11px] font-medium"
          >
            <CornerDownLeft className="size-3" />
            <span>{i18n.t("options.webChat.sidepanel.insertToChat")}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
