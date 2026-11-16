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
} from "lucide-react"
import { useMemo } from "react"
import { IconTooltip } from "@/components/icon-tooltip"
import { Badge } from "@/components/ui/base-ui/badge"
import { Button } from "@/components/ui/base-ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/base-ui/dropdown-menu"
import { i18n } from "@/utils/i18n"
import { openOptionsPage } from "@/utils/navigation"
import { cn } from "@/utils/styles/utils"
import { LanguageSelectorDropdown } from "../common/language-selector-dropdown"
import { ModelSelectorDropdown } from "../common/model-selector-dropdown"

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

  sublineTranslate?: boolean
  onToggleSubline?: () => void

  isOverridden: boolean
  onResetDefaults: () => void
  disabled?: boolean
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
  sublineTranslate = false,
  onToggleSubline,
  isOverridden,
  onResetDefaults,
  disabled = false,
}: ChatContextHeaderProps) {
  const platformColors: Record<string, string> = {
    zalo: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    telegram: "bg-sky-500/10 text-sky-500 border-sky-500/20",
    slack: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    generic: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  }

  const platformKey = room?.platform || "generic"

  const rawName = room?.name?.trim()
  const displayRoomName = disabled
    ? i18n.t("options.webChat.sidepanel.unsupportedTitle")
    : rawName &&
        rawName !== "undefined" &&
        rawName !== "null" &&
        rawName.toLowerCase() !== "undefined" &&
        rawName.toLowerCase() !== "null"
      ? rawName
      : i18n.t("options.webChat.sidepanel.noRoomDetected")

  const displayLanguages = useMemo(() => {
    const exists = CHAT_LANGUAGES.some((l) => l.code.toLowerCase() === selectedLang.toLowerCase())
    if (!exists && selectedLang) {
      return [{ code: selectedLang, name: selectedLang.toUpperCase() }, ...CHAT_LANGUAGES]
    }
    return CHAT_LANGUAGES
  }, [selectedLang])

  const activeToneLabel = getToneLabel(selectedTone)

  return (
    <div className="flex flex-col select-none">
      {/* Row 1: Header h-11 */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border/40 bg-background/80 px-3 backdrop-blur-xs">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="size-3.5" />
          </div>
          {disabled || !room?.platform ? (
            <button
              type="button"
              onClick={() => void openOptionsPage({ route: "/web-chat" })}
              className="cursor-pointer transition-opacity hover:opacity-80"
              title={i18n.t("options.webChat.sidepanel.configureGenericChat")}
            >
              <Badge
                variant="outline"
                className="border-border/40 bg-muted/60 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase hover:bg-muted"
              >
                {i18n.t("options.webChat.sidepanel.unsupportedBadge")}
              </Badge>
            </button>
          ) : (
            <Badge
              variant="outline"
              className={`text-[10px] font-semibold tracking-wider uppercase ${platformColors[platformKey]}`}
            >
              {room?.platform || "Web Chat"}
            </Badge>
          )}
          <span
            className="truncate text-xs font-semibold tracking-tight text-foreground"
            title={displayRoomName}
          >
            {displayRoomName}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {messageCount > 0 && (
            <span className="mr-1 text-[10px] text-muted-foreground">
              {i18n.t("options.webChat.sidepanel.messagesCount", [messageCount])}
            </span>
          )}
          {isOverridden && (
            <Button
              variant="ghost"
              size="icon"
              disabled={disabled}
              onClick={onResetDefaults}
              className="size-6 text-warning hover:text-warning/80"
              title={i18n.t("options.webChat.sidepanel.resetDefaults")}
            >
              <RotateCcw className="size-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={loading || disabled}
            className="size-6 text-muted-foreground hover:text-foreground"
            title={i18n.t("options.webChat.sidepanel.refreshTooltip")}
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
          </Button>
        </div>
      </header>

      {/* Row 2: Secondary Toolbar (Model, Language, Tone, Auto-reply, Subline, PII) */}
      <div
        className={cn(
          "no-scrollbar flex items-center justify-between gap-1.5 overflow-x-auto border-b border-border/60 bg-muted/20 px-3 py-1.5",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <div className="flex items-center gap-1.5">
          {/* Model Pill Dropdown */}
          <ModelSelectorDropdown
            selectedProviderId={selectedProviderId}
            onSelectModel={(id) => onSelectProvider(id)}
            availableProviders={availableProviders}
            variant="pill"
            disabled={disabled}
            title={i18n.t("options.webChat.sidepanel.model")}
            triggerClassName="max-w-[120px] px-1"
          />

          {/* Target Language Pill Dropdown */}
          <LanguageSelectorDropdown
            selectedCode={selectedLang}
            onSelect={(lang) => onSelectLang(lang.code)}
            options={displayLanguages}
            variant="pill"
            disabled={disabled}
            displayMode="code"
            showIcon
            title={i18n.t("options.webChat.sidepanel.language")}
            ariaLabel={i18n.t("options.webChat.sidepanel.language")}
          />

          {/* Tone Pill Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={disabled}
              className={cn(
                "flex h-6.5 shrink-0 items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 text-[11px] font-medium text-foreground/90 transition-colors hover:bg-muted focus-visible:outline-hidden",
                disabled && "cursor-not-allowed opacity-50",
              )}
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
              disabled={disabled}
              className={cn(
                "flex h-6.5 shrink-0 items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 text-[11px] font-medium text-foreground/90 transition-colors hover:bg-muted focus-visible:outline-hidden",
                autoReplyMode !== "none" &&
                  "border-success/40 bg-success/10 font-semibold text-success",
                disabled && "cursor-not-allowed opacity-50",
              )}
              title={i18n.t("options.webChat.sidepanel.autoReply.title")}
            >
              <Bot
                className={cn(
                  "size-3",
                  autoReplyMode !== "none" ? "text-success" : "text-muted-foreground",
                  isAutoReplying && "animate-spin text-success",
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

          {/* Sub-line Inbound Translation Toggle Button */}
          {onToggleSubline && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={onToggleSubline}
              className={cn(
                "h-6.5 shrink-0 gap-1 rounded-md border-border/60 bg-muted/40 px-2 text-[11px] font-medium text-foreground/90 transition-colors hover:bg-muted focus-visible:outline-hidden",
                sublineTranslate && "border-primary/40 bg-primary/10 font-semibold text-primary",
                disabled && "cursor-not-allowed opacity-50",
              )}
              title={i18n.t("options.webChat.sidepanel.subline.tooltip")}
            >
              <Languages
                className={cn(
                  "size-3",
                  sublineTranslate ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span className="truncate">{i18n.t("options.webChat.sidepanel.subline.title")}</span>
            </Button>
          )}
        </div>

        {/* PII Status */}
        <div className="flex shrink-0 items-center">
          <IconTooltip
            icon={<ShieldCheck className="size-3.5 cursor-help text-success" aria-hidden="true" />}
            aria-label={i18n.t("options.webChat.sidepanel.piiMasked")}
          >
            {i18n.t("options.webChat.sidepanel.piiMasked")}
          </IconTooltip>
        </div>
      </div>
    </div>
  )
}
