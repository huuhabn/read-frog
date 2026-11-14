import { Check, Copy, CornerDownLeft } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { i18n } from "@/utils/i18n"

interface ResultStreamProps {
  content: string
  secondaryContent?: string
  loading: boolean
  onInsertToChat: (text: string) => void
}

export function ResultStream({
  content,
  secondaryContent,
  loading,
  onInsertToChat,
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
