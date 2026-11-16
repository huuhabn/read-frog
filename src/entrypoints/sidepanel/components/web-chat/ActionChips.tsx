import { FileText, Languages, MessageSquare, Search } from "lucide-react"
import { i18n } from "@/utils/i18n"

export type WebChatActionType = "summary" | "reply" | "extract" | "translate"

interface ActionChipsProps {
  loading: boolean
  activeAction: WebChatActionType | null
  onSelectAction: (action: WebChatActionType) => void
  disabled?: boolean
}

export function ActionChips({
  loading,
  activeAction,
  onSelectAction,
  disabled = false,
}: ActionChipsProps) {
  const chips = [
    {
      type: "summary" as const,
      labelKey: "options.webChat.sidepanel.actions.summary" as const,
      icon: FileText,
    },
    {
      type: "reply" as const,
      labelKey: "options.webChat.sidepanel.actions.reply" as const,
      icon: MessageSquare,
    },
    {
      type: "extract" as const,
      labelKey: "options.webChat.sidepanel.actions.extract" as const,
      icon: Search,
    },
    {
      type: "translate" as const,
      labelKey: "options.webChat.sidepanel.actions.translate" as const,
      icon: Languages,
    },
  ]

  return (
    <div className="flex flex-wrap gap-1.5 p-3 pb-1">
      {chips.map(({ type, labelKey, icon: Icon }) => {
        const isActive = activeAction === type
        const isBtnDisabled = loading || disabled
        return (
          <button
            key={type}
            type="button"
            disabled={isBtnDisabled}
            onClick={() => onSelectAction(type)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
              isActive
                ? "border-primary bg-primary text-primary-foreground shadow-xs"
                : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
            } ${isBtnDisabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
          >
            <Icon className="size-3" />
            <span>{i18n.t(labelKey)}</span>
          </button>
        )
      })}
    </div>
  )
}
