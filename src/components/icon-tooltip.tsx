import type { ReactNode } from "react"
import { Icon } from "@iconify/react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { cn } from "@/utils/styles/utils"

interface IconTooltipProps {
  icon?: string | ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
  "aria-label"?: string
}

export function IconTooltip({
  icon = "tabler:help-circle",
  children,
  className,
  contentClassName,
  "aria-label": ariaLabel = "More info",
}: IconTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className={cn("inline-flex items-center", className)} />}
        aria-label={ariaLabel}
      >
        {typeof icon === "string" ? (
          <Icon
            icon={icon}
            className="size-3 cursor-help text-muted-foreground"
            aria-hidden="true"
          />
        ) : (
          icon
        )}
      </TooltipTrigger>
      <TooltipContent className={cn("max-w-64", contentClassName)}>
        <p>{children}</p>
      </TooltipContent>
    </Tooltip>
  )
}
