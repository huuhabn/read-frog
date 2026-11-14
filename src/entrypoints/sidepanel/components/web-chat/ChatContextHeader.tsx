import type { WebChatAutoReplyMode, WebChatTone } from "@/types/config/web-chat"
import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import type { ChatRoom } from "@/utils/web-chat/adapter/types"
import {
  Bot,
  Check,
  ChevronDown,
  Languages,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Smile,
  Sparkles,
} from "lucide-react"
import { useMemo } from "react"
import { Badge } from "@/components/ui/base-ui/badge"
import { Button } from "@/components/ui/base-ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/base-ui/dropdown-menu"
import { isLLMProviderConfig } from "@/types/config/provider"
import { i18n } from "@/utils/i18n"
import { isSystemProviderSelectorItem } from "@/utils/providers/provider-display"
import { cn } from "@/utils/styles/utils"

export interface ChatContextHeaderProps {
  room: ChatRoom | null
  messageCount: number
  loading: boolean
  onRefresh: () => void

  availableProviders: ProviderSelectorOption[]
  selectedProviderId: string
  onSelectProvider: (id: string) => void

  selectedLang: string
  onSelectLang: (lang: string) => void

  selectedTone: WebChatTone
  onSelectTone: (tone: WebChatTone) => void

  autoReplyMode: WebChatAutoReplyMode
  onSelectAutoReplyMode: (mode: WebChatAutoReplyMode) => void
  isAutoReplying?: boolean

  isOverridden: boolean
  onResetDefaults: () => void
}

const TONE_VALUES: WebChatTone[] = ["friendly", "professional", "brief", "casual", "humorous"]
const AUTO_REPLY_MODES: WebChatAutoReplyMode[] = ["none", "draft", "send"]

function getToneLabel(tone: WebChatTone): string {
  switch (tone) {
    case "friendly":
      return i18n.t("options.webChat.toneShort.friendly")
    case "professional":
      return i18n.t("options.webChat.toneShort.professional")
    case "brief":
      return i18n.t("options.webChat.toneShort.brief")
    case "casual":
      return i18n.t("options.webChat.toneShort.casual")
    case "humorous":
      return i18n.t("options.webChat.toneShort.humorous")
    default:
      return i18n.t("options.webChat.toneShort.friendly")
  }
}

function getAutoReplyLabel(mode: WebChatAutoReplyMode): string {
  switch (mode) {
    case "none":
      return i18n.t("options.webChat.sidepanel.autoReply.none")
    case "draft":
      return i18n.t("options.webChat.sidepanel.autoReply.draft")
    case "send":
      return i18n.t("options.webChat.sidepanel.autoReply.send")
    default:
      return i18n.t("options.webChat.sidepanel.autoReply.none")
  }
}

function getAutoReplyDesc(mode: WebChatAutoReplyMode): string {
  switch (mode) {
    case "none":
      return i18n.t("options.webChat.sidepanel.autoReply.descNone")
    case "draft":
      return i18n.t("options.webChat.sidepanel.autoReply.descDraft")
    case "send":
      return i18n.t("options.webChat.sidepanel.autoReply.descSend")
    default:
      return i18n.t("options.webChat.sidepanel.autoReply.descNone")
  }
}

function getProviderModelName(p: ProviderSelectorOption): string {
  if (isSystemProviderSelectorItem(p)) return ""
  if (isLLMProviderConfig(p)) {
    return typeof p.model === "string" ? p.model : p.model.customModel || p.model.model
  }
  return ""
}

const CHAT_LANGUAGES = [
  { code: "vi", name: "Tiếng Việt" },
  { code: "en", name: "English" },
  { code: "zh-Hans", name: "中文 (简体)" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "es", name: "Español" },
  { code: "ru", name: "Русский" },
  { code: "th", name: "ไทย" },
  { code: "id", name: "Bahasa Indonesia" },
]

export function ChatContextHeader({
  room,
  messageCount,
  loading,
  onRefresh,
  availableProviders,
  selectedProviderId,
  onSelectProvider,
  selectedLang,
  onSelectLang,
  selectedTone,
  onSelectTone,
  autoReplyMode,
  onSelectAutoReplyMode,
  isAutoReplying = false,
  isOverridden,
  onResetDefaults,
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

  const activeProvider = availableProviders.find((p) => p.id === selectedProviderId)
  const activeModelDisplay =
    activeProvider?.name ||
    (activeProvider ? getProviderModelName(activeProvider) : null) ||
    i18n.t("options.webChat.sidepanel.model")

  const displayLanguages = useMemo(() => {
    const exists = CHAT_LANGUAGES.some((l) => l.code.toLowerCase() === selectedLang.toLowerCase())
    if (!exists && selectedLang) {
      return [{ code: selectedLang, name: selectedLang.toUpperCase() }, ...CHAT_LANGUAGES]
    }
    return CHAT_LANGUAGES
  }, [selectedLang])

  const activeToneLabel = getToneLabel(selectedTone)

  return (
    <div className="flex flex-col gap-2 border-b border-border/50 bg-background/95 px-3 py-2.5 backdrop-blur-xs select-none">
      {/* Row 1: Platform Badge, Room Name, Action Buttons */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge
            variant="outline"
            className={`text-[10px] font-semibold tracking-wider uppercase ${platformColors[platformKey]}`}
          >
            {room?.platform || "Web Chat"}
          </Badge>
          <span className="truncate text-xs font-semibold text-foreground" title={displayRoomName}>
            {displayRoomName}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isOverridden && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onResetDefaults}
              className="size-6 text-amber-500 hover:text-amber-600 dark:hover:text-amber-400"
              title={i18n.t("options.webChat.sidepanel.resetDefaults")}
            >
              <RotateCcw className="size-3" />
            </Button>
          )}
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
      </div>

      {/* Row 2: Custom Options Toolbar (Model, Language, Tone) */}
      <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto py-0.5">
        {/* Model Pill Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex h-6.5 shrink-0 items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 text-[11px] font-medium text-foreground/90 transition-colors hover:bg-muted focus-visible:outline-hidden",
              selectedProviderId && "border-primary/30 text-foreground",
            )}
            title={i18n.t("options.webChat.sidepanel.model")}
          >
            <Sparkles className="size-3 text-primary" />
            <span className="max-w-[85px] truncate">{activeModelDisplay}</span>
            <ChevronDown className="size-2.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52 text-xs">
            {availableProviders.length === 0 ? (
              <div className="p-2 text-center text-muted-foreground">
                {i18n.t("options.webChat.provider.placeholder")}
              </div>
            ) : (
              availableProviders.map((p) => {
                const modelName = getProviderModelName(p)
                return (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => onSelectProvider(p.id)}
                    className="flex items-center justify-between py-1.5 text-xs"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{p.name || p.id}</span>
                      {modelName ? (
                        <span className="truncate text-[10px] text-muted-foreground">
                          {modelName}
                        </span>
                      ) : null}
                    </div>
                    {selectedProviderId === p.id && <Check className="size-3 text-primary" />}
                  </DropdownMenuItem>
                )
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Target Language Pill Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex h-6.5 shrink-0 items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 text-[11px] font-medium text-foreground/90 transition-colors hover:bg-muted focus-visible:outline-hidden"
            title={i18n.t("options.webChat.sidepanel.language")}
          >
            <Languages className="size-3 text-primary" />
            <span className="font-semibold">{selectedLang.toUpperCase()}</span>
            <ChevronDown className="size-2.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-60 w-48 overflow-y-auto text-xs">
            {displayLanguages.map((lang) => (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => onSelectLang(lang.code)}
                className="flex items-center justify-between py-1.5 text-xs"
              >
                <span>{lang.name}</span>
                {selectedLang.toLowerCase() === lang.code.toLowerCase() && (
                  <Check className="size-3 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Tone Pill Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex h-6.5 shrink-0 items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 text-[11px] font-medium text-foreground/90 transition-colors hover:bg-muted focus-visible:outline-hidden"
            title={i18n.t("options.webChat.sidepanel.tone")}
          >
            <Smile className="size-3 text-primary" />
            <span className="max-w-[80px] truncate">{activeToneLabel}</span>
            <ChevronDown className="size-2.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44 text-xs">
            {TONE_VALUES.map((tone) => (
              <DropdownMenuItem
                key={tone}
                onClick={() => onSelectTone(tone)}
                className="flex items-center justify-between py-1.5 text-xs"
              >
                <span>{getToneLabel(tone)}</span>
                {selectedTone === tone && <Check className="size-3 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Auto Reply Pill Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex h-6.5 shrink-0 items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 text-[11px] font-medium text-foreground/90 transition-colors hover:bg-muted focus-visible:outline-hidden",
              autoReplyMode !== "none" &&
                "border-emerald-500/40 bg-emerald-500/10 font-semibold text-emerald-600 dark:text-emerald-400",
            )}
            title={i18n.t("options.webChat.sidepanel.autoReply.title")}
          >
            <Bot
              className={cn(
                "size-3",
                autoReplyMode !== "none" ? "text-emerald-500" : "text-muted-foreground",
                isAutoReplying && "animate-spin text-emerald-500",
              )}
            />
            <span className="max-w-[85px] truncate">{getAutoReplyLabel(autoReplyMode)}</span>
            <ChevronDown className="size-2.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 text-xs">
            {AUTO_REPLY_MODES.map((mode) => (
              <DropdownMenuItem
                key={mode}
                onClick={() => onSelectAutoReplyMode(mode)}
                className="flex items-center justify-between py-1.5 text-xs"
              >
                <div className="flex flex-col pr-2">
                  <span className="font-medium">{getAutoReplyLabel(mode)}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {getAutoReplyDesc(mode)}
                  </span>
                </div>
                {autoReplyMode === mode && <Check className="size-3 shrink-0 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Row 3: Messages Count & PII Status */}
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
