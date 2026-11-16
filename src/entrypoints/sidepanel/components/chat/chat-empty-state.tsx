import { Icon } from "@iconify/react"
import { Sparkles } from "lucide-react"
import { i18n } from "@/utils/i18n"
import {
  UPWORK_QUICK_PROMPT_ANALYZE_JOB,
  UPWORK_QUICK_PROMPT_COVER_LETTER,
} from "@/utils/sidepanel/upwork"

export const QUICK_PROMPT_KEYS = [
  "sidePanel.chat.quickPrompts.summarize",
  "sidePanel.chat.quickPrompts.explainTerms",
  "sidePanel.chat.quickPrompts.prosAndCons",
  "sidePanel.chat.quickPrompts.emailSummary",
] as const

interface ChatEmptyStateProps {
  isUpworkJob: boolean
  onSendPrompt: (prompt: string) => void | Promise<void>
}

export function ChatEmptyState({ isUpworkJob, onSendPrompt }: ChatEmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="size-6" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold tracking-tight">{i18n.t("sidePanel.chat.title")}</h3>
        <p className="max-w-[240px] text-xs text-muted-foreground">
          {i18n.t("sidePanel.chat.description")}
        </p>
      </div>

      {/* Quick prompt suggestions */}
      <div className="grid w-full grid-cols-1 gap-2 pt-2 text-left">
        {isUpworkJob && (
          <>
            <button
              type="button"
              onClick={() => void onSendPrompt(UPWORK_QUICK_PROMPT_COVER_LETTER)}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-2.5 text-xs font-medium text-success transition-all hover:border-success/50 hover:bg-success/20"
            >
              <Icon icon="tabler:briefcase" className="size-4 shrink-0 text-success" />
              <span>{UPWORK_QUICK_PROMPT_COVER_LETTER}</span>
            </button>
            <button
              type="button"
              onClick={() => void onSendPrompt(UPWORK_QUICK_PROMPT_ANALYZE_JOB)}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-success/20 bg-success/5 p-2.5 text-xs text-success transition-all hover:border-success/40 hover:bg-success/10"
            >
              <Icon icon="tabler:file-search" className="size-4 shrink-0 text-success" />
              <span>{UPWORK_QUICK_PROMPT_ANALYZE_JOB}</span>
            </button>
          </>
        )}
        {QUICK_PROMPT_KEYS.map((key) => {
          const promptText = i18n.t(key)
          return (
            <button
              type="button"
              key={key}
              onClick={() => void onSendPrompt(promptText)}
              className="cursor-pointer rounded-lg border border-border/60 bg-muted/30 p-2.5 text-left text-xs text-muted-foreground transition-all hover:border-primary/40 hover:bg-muted/70 hover:text-foreground"
            >
              {promptText}
            </button>
          )
        })}
      </div>
    </div>
  )
}
