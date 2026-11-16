import { Check, ChevronDown, Languages } from "lucide-react"
import { useMemo } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/base-ui/dropdown-menu"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"
import { AUTO_DETECT_OPTION, POPULAR_LANGUAGES, type LanguageOption } from "./language-options"

export interface LanguageSelectorDropdownProps {
  selectedCode: string
  onSelect: (option: LanguageOption) => void
  options?: LanguageOption[]
  allowAutoDetect?: boolean
  variant?: "plain" | "pill" | "subtle"
  displayMode?: "name" | "code"
  align?: "start" | "end" | "center"
  className?: string
  triggerClassName?: string
  ariaLabel?: string
  title?: string
  showIcon?: boolean
  disabled?: boolean
}

export function LanguageSelectorDropdown({
  selectedCode,
  onSelect,
  options = POPULAR_LANGUAGES,
  allowAutoDetect = false,
  variant = "plain",
  displayMode = "name",
  align = "start",
  className,
  triggerClassName,
  ariaLabel,
  title,
  showIcon = false,
  disabled = false,
}: LanguageSelectorDropdownProps) {
  const currentOption = useMemo(() => {
    if (allowAutoDetect && (selectedCode === "auto" || selectedCode === AUTO_DETECT_OPTION.code)) {
      return {
        code: "auto",
        name: i18n.t("sidePanel.translate.autoDetect") || AUTO_DETECT_OPTION.name,
      }
    }
    return (
      options.find((item) => item.code.toLowerCase() === selectedCode.toLowerCase()) || {
        code: selectedCode,
        name: selectedCode.toUpperCase(),
      }
    )
  }, [allowAutoDetect, options, selectedCode])

  const autoDetectLabel = i18n.t("sidePanel.translate.autoDetect") || AUTO_DETECT_OPTION.name

  const triggerVariants = {
    plain:
      "flex cursor-pointer items-center gap-1 text-xs font-semibold text-foreground/90 outline-hidden hover:text-foreground",
    pill: "flex h-6.5 shrink-0 items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 text-[11px] font-medium text-foreground/90 transition-colors hover:bg-muted focus-visible:outline-hidden",
    subtle:
      "flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-foreground/85 outline-hidden transition-colors hover:bg-muted hover:text-foreground",
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={ariaLabel || currentOption.name}
        title={title || ariaLabel || currentOption.name}
        className={cn(
          triggerVariants[variant],
          disabled && "pointer-events-none cursor-not-allowed opacity-50",
          triggerClassName,
        )}
      >
        {showIcon && <Languages className="size-3 shrink-0 text-primary" />}
        {displayMode === "code" ? (
          <span className="font-semibold">{selectedCode.toUpperCase()}</span>
        ) : (
          <span className="max-w-[100px] truncate">{currentOption.name}</span>
        )}
        <ChevronDown className="size-2.5 shrink-0 text-muted-foreground opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className={cn("max-h-60 w-48 overflow-y-auto rounded-xl text-xs shadow-lg", className)}
      >
        {allowAutoDetect && (
          <DropdownMenuItem
            key="auto"
            onClick={() => onSelect({ code: "auto", name: autoDetectLabel })}
            className="flex cursor-pointer items-center justify-between font-medium"
          >
            <span>{autoDetectLabel}</span>
            <span className="text-[10px] text-muted-foreground uppercase">auto</span>
          </DropdownMenuItem>
        )}
        {options.map((lang) => {
          const isSelected = selectedCode.toLowerCase() === lang.code.toLowerCase()
          return (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => onSelect(lang)}
              className="flex cursor-pointer items-center justify-between py-1.5"
            >
              <span className={cn(isSelected && "font-semibold text-primary")}>{lang.name}</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground uppercase">{lang.code}</span>
                {isSelected && <Check className="size-3 text-primary" />}
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
