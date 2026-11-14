import type { ReactNode } from "react"
import { cn } from "@/utils/styles/utils"

export interface ConfigSectionProps {
  id?: string
  title: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
  titleClassName?: string
}

export function ConfigSection({
  id,
  title,
  action,
  children,
  className,
  contentClassName,
  titleClassName,
}: ConfigSectionProps) {
  return (
    <section id={id} className={cn("w-full", className)}>
      <div
        className={cn(
          "mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3",
          titleClassName,
        )}
      >
        <h2 className="text-base font-medium text-foreground">{title}</h2>
        {action && <div>{action}</div>}
      </div>
      <div className={cn("flex w-full flex-col gap-6", contentClassName)}>{children}</div>
    </section>
  )
}
