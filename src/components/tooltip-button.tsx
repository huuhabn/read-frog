import type { ComponentProps, ReactNode } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { cn } from "@/utils/styles/utils"

const SIZE_CLASSES = {
  xs: "size-5",
  sm: "size-6",
  md: "size-7.5",
  lg: "size-9",
} as const

const VARIANT_CLASSES = {
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
  outline: "border border-border text-muted-foreground hover:bg-muted hover:text-foreground",
  destructive: "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
} as const

const ACTIVE_CLASSES = "bg-primary/15 font-medium text-primary shadow-xs ring-1 ring-primary/20"

interface TooltipButtonProps extends Omit<ComponentProps<typeof TooltipTrigger>, "children"> {
  label: ReactNode
  children: ReactNode
  active?: boolean
  size?: keyof typeof SIZE_CLASSES
  variant?: keyof typeof VARIANT_CLASSES
  shortcut?: ReactNode
  badge?: boolean
  side?: ComponentProps<typeof TooltipContent>["side"]
  sideOffset?: number
  contentClassName?: string
}

export function TooltipButton({
  label,
  children,
  active = false,
  size = "sm",
  variant = "ghost",
  shortcut,
  badge = false,
  side = "left",
  sideOffset = 6,
  className,
  contentClassName,
  ...triggerProps
}: TooltipButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={typeof label === "string" ? label : undefined}
        aria-pressed={active || undefined}
        {...triggerProps}
        className={cn(
          "relative flex items-center justify-center rounded-lg transition-all",
          "disabled:pointer-events-none disabled:opacity-50",
          SIZE_CLASSES[size],
          VARIANT_CLASSES[variant],
          active && ACTIVE_CLASSES,
          className,
        )}
      >
        {children}
        {badge && (
          <span
            aria-hidden="true"
            className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-destructive"
          />
        )}
      </TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={sideOffset}
        className={cn("px-2 py-1.5 text-xs font-medium", contentClassName)}
      >
        {shortcut ? (
          <span className="flex items-center gap-2">
            <span>{label}</span>
            <kbd className="rounded bg-background/20 px-1 font-mono text-[10px]">{shortcut}</kbd>
          </span>
        ) : (
          label
        )}
      </TooltipContent>
    </Tooltip>
  )
}
