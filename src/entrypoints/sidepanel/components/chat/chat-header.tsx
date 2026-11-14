import type { UpworkConfig } from "@/types/config/upwork"
import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import { Check, ChevronDown, History, Languages, Plus, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/base-ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/base-ui/dropdown-menu"
import { i18n } from "@/utils/i18n"
import { UPWORK_TRANSLATE_LANGUAGES } from "@/utils/sidepanel/upwork"
import { cn } from "@/utils/styles/utils"

interface ChatHeaderProps {
  onNewChat: () => void
  onOpenHistory: () => void
  upworkConfig: UpworkConfig
  setUpworkConfig: (cfg: UpworkConfig) => void | Promise<void>
  translationProviders: ProviderSelectorOption[]
}

export function ChatHeader({
  onNewChat,
  onOpenHistory,
  upworkConfig,
  setUpworkConfig,
  translationProviders,
}: ChatHeaderProps) {
  return (
    <header className="flex h-11 w-full min-w-0 items-center justify-between border-b border-border/60 bg-background/80 px-3 backdrop-blur-xs">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="size-3.5" />
        </div>
        <span className="truncate text-xs font-semibold tracking-tight">
          {i18n.t("sidePanel.chat.title")}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {/* Translation Config Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors hover:bg-muted",
              upworkConfig.translateLang && upworkConfig.translateLang !== "original"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "text-muted-foreground",
            )}
            title={i18n.t("options.upwork.parametersSection.translateLangTitle")}
          >
            <Languages className="size-3.5" />
            <span className="text-[11px] font-medium uppercase">
              {upworkConfig.translateLang || "en"}
            </span>
            <ChevronDown className="size-2.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-1 text-xs">
            <div className="px-2 py-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              {i18n.t("options.upwork.sidepanel.translateTo")}
            </div>
            {UPWORK_TRANSLATE_LANGUAGES.map((lang) => (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => void setUpworkConfig({ ...upworkConfig, translateLang: lang.code })}
                className="flex items-center justify-between py-1 text-xs"
              >
                <span>{lang.name}</span>
                {upworkConfig.translateLang === lang.code && (
                  <Check className="size-3 text-primary" />
                )}
              </DropdownMenuItem>
            ))}

            <div className="my-1 border-t border-border/40" />

            <div className="px-2 py-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              {i18n.t("options.upwork.parametersSection.translateProviderTitle")}
            </div>
            <DropdownMenuItem
              onClick={() => void setUpworkConfig({ ...upworkConfig, translateProviderId: "" })}
              className="flex items-center justify-between py-1 text-xs"
            >
              <span>{i18n.t("options.upwork.parametersSection.translateProviderAuto")}</span>
              {!upworkConfig.translateProviderId && <Check className="size-3 text-primary" />}
            </DropdownMenuItem>
            {translationProviders.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => void setUpworkConfig({ ...upworkConfig, translateProviderId: p.id })}
                className="flex items-center justify-between py-1 text-xs"
              >
                <span className="truncate">{p.name || p.id}</span>
                {upworkConfig.translateProviderId === p.id && (
                  <Check className="size-3 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* History Drawer Trigger */}
        <Button
          size="icon"
          variant="ghost"
          className="size-7 text-muted-foreground hover:text-foreground"
          onClick={onOpenHistory}
          title={i18n.t("sidePanel.chat.history")}
        >
          <History className="size-4" />
        </Button>

        {/* New Chat Trigger */}
        <Button
          size="icon"
          variant="ghost"
          className="size-7 text-muted-foreground hover:text-foreground"
          onClick={onNewChat}
          title={i18n.t("sidePanel.chat.newChat")}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </header>
  )
}
