import type { LLMProviderConfig } from "@/types/config/provider"
import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import { Check, ChevronDown, Sparkles } from "lucide-react"
import { useMemo } from "react"
import ProviderIcon from "@/components/provider-icon"
import { useTheme } from "@/components/providers/theme-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/base-ui/dropdown-menu"
import { i18n } from "@/utils/i18n"
import { getProviderLogo } from "@/utils/providers/provider-display"
import { cn } from "@/utils/styles/utils"

export interface ModelSelectorDropdownProps {
  selectedProviderId: string
  selectedModelName?: string
  onSelectModel: (providerId: string, model: string) => void | Promise<void>
  llmProviders?: LLMProviderConfig[]
  availableProviders?: ProviderSelectorOption[]
  variant?: "subtle" | "pill" | "compact"
  align?: "start" | "end" | "center"
  className?: string
  triggerClassName?: string
  disabled?: boolean
  title?: string
}

export function ModelSelectorDropdown({
  selectedProviderId,
  selectedModelName,
  onSelectModel,
  llmProviders,
  availableProviders,
  variant = "subtle",
  align = "start",
  className,
  triggerClassName,
  disabled = false,
  title,
}: ModelSelectorDropdownProps) {
  const { theme } = useTheme()

  const providersList = useMemo(() => {
    return availableProviders || llmProviders || []
  }, [availableProviders, llmProviders])

  const currentProvider = useMemo(
    () => providersList.find((p) => p.id === selectedProviderId),
    [providersList, selectedProviderId],
  )

  const providerLogo = useMemo(
    () => (currentProvider ? getProviderLogo(currentProvider, theme) : ""),
    [currentProvider, theme],
  )

  const displayModelName = useMemo(() => {
    if (selectedModelName) return selectedModelName
    if (!currentProvider) return i18n.t("sidePanel.chat.selectModel")
    if ("name" in currentProvider && currentProvider.name) return currentProvider.name
    if ("model" in currentProvider) {
      const m = currentProvider.model
      return typeof m === "string" ? m : m?.customModel || m?.model || currentProvider.id
    }
    return currentProvider.id
  }, [currentProvider, selectedModelName])

  const triggerVariants = {
    subtle:
      "flex h-6.5 max-w-[180px] cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-foreground/85 outline-hidden transition-colors hover:bg-muted hover:text-foreground",
    pill: "flex h-8 items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-3 text-xs font-medium text-foreground outline-hidden transition-colors hover:bg-muted/70",
    compact: cn(
      "flex h-6.5 shrink-0 items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 text-[11px] font-medium text-foreground/90 transition-colors hover:bg-muted focus-visible:outline-hidden",
      selectedProviderId && "border-primary/30 text-foreground",
    ),
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(triggerVariants[variant], triggerClassName)}
        title={title || displayModelName}
      >
        {providerLogo ? (
          <ProviderIcon logo={providerLogo} size="sm" />
        ) : (
          <Sparkles className="size-3 shrink-0 text-primary" />
        )}
        <span className="max-w-[85px] truncate">{displayModelName}</span>
        <ChevronDown className="size-2.5 shrink-0 text-muted-foreground opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className={cn("max-h-72 w-56 overflow-y-auto rounded-xl text-xs shadow-lg", className)}
      >
        {providersList.length === 0 ? (
          <div className="p-2.5 text-center text-xs text-muted-foreground">
            {i18n.t("sidePanel.chat.noProviderConfigured")}
          </div>
        ) : (
          providersList.map((p) => {
            const modelName =
              "model" in p
                ? typeof p.model === "string"
                  ? p.model
                  : p.model?.customModel || p.model?.model || ""
                : ""
            const itemLogo = getProviderLogo(p, theme)
            const isSelected = p.id === selectedProviderId

            return (
              <DropdownMenuItem
                key={p.id}
                onClick={() => void onSelectModel(p.id, modelName)}
                className="flex cursor-pointer items-center justify-between py-1.5 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2 pr-2">
                  {itemLogo ? (
                    <ProviderIcon logo={itemLogo} size="sm" />
                  ) : (
                    <Sparkles className="size-3 shrink-0 text-muted-foreground" />
                  )}
                  <span className={cn("truncate font-medium", isSelected && "text-primary")}>
                    {p.name || p.id}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {modelName && (
                    <span className="max-w-[80px] truncate text-[10px] text-muted-foreground">
                      {modelName}
                    </span>
                  )}
                  {isSelected && <Check className="size-3 shrink-0 text-primary" />}
                </div>
              </DropdownMenuItem>
            )
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
