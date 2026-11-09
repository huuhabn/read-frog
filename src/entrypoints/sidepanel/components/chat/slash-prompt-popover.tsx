import type { CustomAIAction } from "./custom-ai-actions"
import { Sparkles, X } from "lucide-react"
import { useEffect, useRef } from "react"
import { Kbd } from "@/components/ui/base-ui/kbd"
import { cn } from "@/utils/styles/utils"

interface SlashPromptPopoverProps {
  query: string
  actions: CustomAIAction[]
  selectedIndex: number
  onSelect: (action: CustomAIAction) => void
  onClose: () => void
  onHoverIndex: (index: number) => void
}

export function SlashPromptPopover({
  query,
  actions,
  selectedIndex,
  onSelect,
  onClose,
  onHoverIndex,
}: SlashPromptPopoverProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const activeItemRef = useRef<HTMLButtonElement>(null)

  // Scroll active item into view on index change
  useEffect(() => {
    if (
      selectedIndex >= 0 &&
      activeItemRef.current &&
      typeof activeItemRef.current.scrollIntoView === "function"
    ) {
      activeItemRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      })
    }
  }, [selectedIndex])

  return (
    <div
      data-testid="slash-prompt-popover"
      className="absolute right-0 bottom-[calc(100%+8px)] left-0 z-30 flex animate-in flex-col overflow-hidden rounded-xl border border-border/80 bg-popover/95 text-popover-foreground shadow-2xl backdrop-blur-md duration-150 fade-in-0 zoom-in-95"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="flex size-5 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Sparkles className="size-3" />
          </div>
          <span className="font-semibold text-foreground">Custom AI Actions</span>
          <span className="py-0.2 rounded-full bg-primary/15 px-1.5 text-[10px] font-medium text-primary">
            {actions.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1 text-[10px] text-muted-foreground sm:flex">
            <Kbd className="h-4 px-1 text-[9px]">↑↓</Kbd>
            <span>chọn</span>
            <Kbd className="h-4 px-1 text-[9px]">Enter</Kbd>
            <span>dùng</span>
            <Kbd className="h-4 px-1 text-[9px]">Esc</Kbd>
            <span>đóng</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Đóng menu"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* List */}
      <div ref={listRef} className="max-h-64 space-y-0.5 overflow-y-auto p-1.5">
        {actions.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs font-medium text-foreground">
              Không tìm thấy action phù hợp với &ldquo;/{query}&rdquo;
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Thử gõ <span className="font-mono text-primary">/tom</span>,{" "}
              <span className="font-mono text-primary">/dich</span> hoặc{" "}
              <span className="font-mono text-primary">/code</span>
            </p>
          </div>
        ) : (
          actions.map((action, idx) => {
            const isSelected = idx === selectedIndex
            const Icon = action.icon

            return (
              <button
                type="button"
                key={action.id}
                ref={isSelected ? activeItemRef : null}
                onClick={() => onSelect(action)}
                onMouseEnter={() => onHoverIndex(idx)}
                className={cn(
                  "group flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                  isSelected
                    ? "bg-accent text-accent-foreground ring-1 ring-primary/30"
                    : "hover:bg-muted/50",
                )}
              >
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors",
                    isSelected
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border/60 bg-muted/60 text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-xs font-medium">{action.title}</span>
                    <span className="py-0.2 shrink-0 rounded bg-muted px-1.5 font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
                      {action.category}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[11px] leading-normal text-muted-foreground">
                    {action.description}
                  </p>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
