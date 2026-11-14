import type { ChatRoom } from "@/utils/web-chat/adapter/types"
import { RefreshCw, ShieldCheck, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/base-ui/badge"
import { Button } from "@/components/ui/base-ui/button"
import { i18n } from "@/utils/i18n"

interface ChatContextHeaderProps {
  room: ChatRoom | null
  messageCount: number
  loading: boolean
  onRefresh: () => void
}

export function ChatContextHeader({
  room,
  messageCount,
  loading,
  onRefresh,
}: ChatContextHeaderProps) {
  const platformColors: Record<string, string> = {
    zalo: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    telegram: "bg-sky-500/10 text-sky-500 border-sky-500/20",
    slack: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    generic: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  }

  const platformKey = room?.platform || "generic"

  const rawName = room?.name?.trim()
  const displayRoomName =
    rawName &&
    rawName !== "undefined" &&
    rawName !== "null" &&
    rawName.toLowerCase() !== "undefined" &&
    rawName.toLowerCase() !== "null"
      ? rawName
      : i18n.t("options.webChat.sidepanel.noRoomDetected")

  return (
    <div className="flex flex-col gap-2 border-b border-border/50 bg-background/95 px-3 py-2.5 backdrop-blur-xs select-none">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge
            variant="outline"
            className={`text-[10px] font-semibold tracking-wider uppercase ${platformColors[platformKey]}`}
          >
            {room?.platform || "Web Chat"}
          </Badge>
          <span className="truncate text-xs font-semibold text-foreground">{displayRoomName}</span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          disabled={loading}
          className="size-6 text-muted-foreground hover:text-foreground"
          title={i18n.t("options.webChat.sidepanel.refreshTooltip")}
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
        </Button>
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>{i18n.t("options.webChat.sidepanel.messagesCount", [messageCount])}</span>
          <span>•</span>
          <span className="flex items-center gap-1 text-emerald-500">
            <ShieldCheck className="size-3" />
            {i18n.t("options.webChat.sidepanel.piiMasked")}
          </span>
        </div>

        <span className="flex items-center gap-1 text-[10px] font-medium text-primary">
          <Sparkles className="size-3" />
          {i18n.t("options.webChat.sidepanel.cloudLlm")}
        </span>
      </div>
    </div>
  )
}
