import type { ChatMessageItem as ChatMessageType } from "@/utils/db/dexie/tables/chat-session"
import { Icon } from "@iconify/react"
import { Check, Copy, Languages } from "lucide-react"
import { lazy, Suspense } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"

const MarkdownRenderer = lazy(() =>
  import("@/components/markdown-renderer").then((m) => ({ default: m.MarkdownRenderer })),
)

export interface ChatMessageItemProps {
  message: ChatMessageType
  index: number
  isStreaming: boolean
  isLast: boolean
  isCopied: boolean
  isTranslating: boolean
  showOriginal: boolean
  showTranslatedResponse: boolean
  isUpworkJob: boolean
  fillStatusText?: string | null
  onCopy: (text: string, index: number) => void | Promise<void>
  onToggleOriginal: (id: string) => void
  onToggleTranslateResponse: (msg: ChatMessageType) => void | Promise<void>
  onFillCoverLetter?: (content: string, index: number) => void | Promise<void>
}

export function ChatMessageItem({
  message,
  index,
  isStreaming,
  isLast,
  isCopied,
  isTranslating,
  showOriginal,
  showTranslatedResponse,
  isUpworkJob,
  fillStatusText,
  onCopy,
  onToggleOriginal,
  onToggleTranslateResponse,
  onFillCoverLetter,
}: ChatMessageItemProps) {
  const isUser = message.role === "user"

  if (isUser) {
    const displayedUserContent =
      showOriginal && message.originalContent ? message.originalContent : message.content

    return (
      <div className="group/msg flex w-full min-w-0 flex-col items-end gap-1">
        {/* User Question Bubble */}
        <div className="max-w-[88%] min-w-0 rounded-2xl rounded-tr-xs bg-primary px-3.5 py-2 text-xs leading-relaxed [overflow-wrap:anywhere] break-words text-primary-foreground shadow-xs">
          <p className="[overflow-wrap:anywhere] break-words whitespace-pre-wrap">
            {displayedUserContent}
          </p>
        </div>

        {/* User Action Buttons outside bubble (icon-only) */}
        <div
          className={cn(
            "flex items-center gap-0.5 px-1 transition-opacity",
            isCopied
              ? "opacity-100"
              : "opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100",
          )}
        >
          {message.originalContent && (
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              className={cn(
                "size-6 text-muted-foreground hover:text-foreground",
                showOriginal && "bg-primary/10 text-primary",
              )}
              onClick={() => onToggleOriginal(message.id)}
              title={
                showOriginal
                  ? i18n.t("options.upwork.sidepanel.viewTranslated")
                  : i18n.t("options.upwork.sidepanel.viewOriginal")
              }
              aria-label={
                showOriginal
                  ? i18n.t("options.upwork.sidepanel.viewTranslated")
                  : i18n.t("options.upwork.sidepanel.viewOriginal")
              }
            >
              <Languages className="size-3.5" />
            </Button>
          )}

          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="size-6 text-muted-foreground hover:text-foreground"
            onClick={() => void onCopy(displayedUserContent, index)}
            title={isCopied ? i18n.t("sidePanel.chat.copied") : i18n.t("sidePanel.chat.copy")}
            aria-label={isCopied ? i18n.t("sidePanel.chat.copied") : i18n.t("sidePanel.chat.copy")}
          >
            {isCopied ? (
              <Check className="size-3.5 text-emerald-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
        </div>
      </div>
    )
  }

  // Assistant Response
  const displayedAssistantContent =
    showTranslatedResponse && message.translatedContent
      ? message.translatedContent
      : message.content

  const hasFillStatus = Boolean(fillStatusText)

  return (
    <div className="group/msg flex w-full min-w-0 flex-col items-start gap-1">
      {/* Assistant Answer Bubble */}
      <div className="max-w-[92%] min-w-0 rounded-2xl rounded-tl-xs border border-border/50 bg-muted/40 px-3.5 py-2 text-xs leading-relaxed [overflow-wrap:anywhere] break-words text-foreground">
        {message.content ? (
          <Suspense
            fallback={
              <div className="max-w-full min-w-0 [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
                {displayedAssistantContent}
              </div>
            }
          >
            <MarkdownRenderer
              content={displayedAssistantContent}
              className="max-w-full min-w-0 [overflow-wrap:anywhere] break-words"
            />
          </Suspense>
        ) : isStreaming && isLast ? (
          <div className="flex items-center gap-1.5 py-1 text-muted-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" />
            <span className="size-1.5 animate-pulse rounded-full bg-primary [animation-delay:200ms]" />
            <span className="size-1.5 animate-pulse rounded-full bg-primary [animation-delay:400ms]" />
            <span className="ml-1 text-[11px]">{i18n.t("sidePanel.chat.thinking")}</span>
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground italic">
            {i18n.t("sidePanel.chat.noResponse")}
          </span>
        )}
      </div>

      {/* Assistant Action Buttons outside bubble (icon-only) */}
      {message.content && (
        <div
          className={cn(
            "flex items-center gap-0.5 px-1 transition-opacity",
            isCopied || isTranslating || hasFillStatus
              ? "opacity-100"
              : "opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100",
          )}
        >
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className={cn(
              "size-6 text-muted-foreground hover:text-foreground",
              showTranslatedResponse && "bg-primary/10 text-primary",
            )}
            disabled={isTranslating}
            onClick={() => void onToggleTranslateResponse(message)}
            title={
              isTranslating
                ? i18n.t("options.upwork.sidepanel.translating")
                : showTranslatedResponse
                  ? i18n.t("options.upwork.sidepanel.viewOriginal")
                  : i18n.t("options.upwork.sidepanel.viewTranslated")
            }
            aria-label={
              isTranslating
                ? i18n.t("options.upwork.sidepanel.translating")
                : showTranslatedResponse
                  ? i18n.t("options.upwork.sidepanel.viewOriginal")
                  : i18n.t("options.upwork.sidepanel.viewTranslated")
            }
          >
            <Languages className={cn("size-3.5", isTranslating && "animate-spin text-primary")} />
          </Button>

          {isUpworkJob && onFillCoverLetter && (
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              className={cn(
                "size-6 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-800 dark:text-emerald-400",
                hasFillStatus && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
              )}
              onClick={() => void onFillCoverLetter(message.content, index)}
              title={fillStatusText || i18n.t("options.upwork.sidepanel.fillIntoUpwork")}
              aria-label={fillStatusText || i18n.t("options.upwork.sidepanel.fillIntoUpwork")}
            >
              {hasFillStatus ? (
                <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Icon
                  icon="tabler:arrow-down-to-arc"
                  className="size-3.5 text-emerald-600 dark:text-emerald-400"
                />
              )}
            </Button>
          )}

          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="size-6 text-muted-foreground hover:text-foreground"
            onClick={() => void onCopy(displayedAssistantContent, index)}
            title={isCopied ? i18n.t("sidePanel.chat.copied") : i18n.t("sidePanel.chat.copy")}
            aria-label={isCopied ? i18n.t("sidePanel.chat.copied") : i18n.t("sidePanel.chat.copy")}
          >
            {isCopied ? (
              <Check className="size-3.5 text-emerald-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
