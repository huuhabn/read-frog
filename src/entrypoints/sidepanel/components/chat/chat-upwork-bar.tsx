import type { UpworkConfig } from "@/types/config/upwork"
import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import { Icon } from "@iconify/react"
import { Check, ChevronDown, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/base-ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/base-ui/dropdown-menu"
import { i18n } from "@/utils/i18n"
import { UPWORK_TRANSLATE_LANGUAGES } from "@/utils/sidepanel/upwork"

interface ChatUpworkBarProps {
  isUpworkJob: boolean
  upworkConfig: UpworkConfig
  setUpworkConfig: (cfg: UpworkConfig) => void | Promise<void>
  translationProviders: ProviderSelectorOption[]
  onCoverLetter: () => void | Promise<void>
  isStreaming: boolean
  isTranslating: boolean
}

export function ChatUpworkBar({
  isUpworkJob,
  upworkConfig,
  setUpworkConfig,
  translationProviders,
  onCoverLetter,
  isStreaming,
  isTranslating,
}: ChatUpworkBarProps) {
  if (!isUpworkJob) return null

  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-2 border-t border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-900 dark:text-emerald-200">
      <div className="flex min-w-0 items-center gap-1.5">
        <div className="flex min-w-0 items-center gap-1 font-medium">
          <Icon
            icon="tabler:briefcase"
            className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
          />
          <span className="max-w-[85px] truncate sm:max-w-none">
            {i18n.t("options.upwork.sidepanel.quickActionLabel")}
          </span>
        </div>

        {/* Translation Language & Provider Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex h-5.5 cursor-pointer items-center gap-1 rounded-md border border-emerald-600/30 bg-background/80 px-1.5 text-[11px] font-medium text-foreground hover:bg-background"
            title={i18n.t("options.upwork.parametersSection.translateLangTitle")}
          >
            <Icon
              icon="tabler:language"
              className="size-3 text-emerald-600 dark:text-emerald-400"
            />
            <span className="max-w-[70px] truncate text-[10px] font-semibold uppercase">
              {upworkConfig.translateLang || "en"}
            </span>
            <ChevronDown className="size-2.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 p-1 text-xs">
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
      </div>

      <Button
        size="sm"
        variant="outline"
        className="h-6 shrink-0 gap-1 border-emerald-600/30 bg-emerald-600/15 px-2 text-[11px] font-medium text-emerald-700 hover:bg-emerald-600/25 dark:text-emerald-300"
        disabled={isStreaming || isTranslating}
        onClick={() => void onCoverLetter()}
      >
        <Sparkles className="size-3 text-emerald-600 dark:text-emerald-400" />
        <span>{i18n.t("options.upwork.sidepanel.coverLetter")}</span>
      </Button>
    </div>
  )
}
