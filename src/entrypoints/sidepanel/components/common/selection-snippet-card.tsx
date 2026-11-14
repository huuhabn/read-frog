import { X } from "lucide-react"
import { cn } from "@/utils/styles/utils"

interface SelectionSnippetCardProps {
  text: string
  onClear: () => void
  className?: string
}

export function SelectionSnippetCard({ text, onClear, className }: SelectionSnippetCardProps) {
  if (!text) return null

  return (
    <div
      className={cn(
        "relative mb-2 animate-in rounded-xl border border-border/80 bg-background/90 p-2.5 shadow-xs transition-all fade-in-50",
        className,
      )}
    >
      <div className="flex items-center justify-between pb-1">
        <span className="text-[11px] font-semibold tracking-tight text-foreground">
          Text from your selection
        </span>
        <button
          type="button"
          onClick={onClear}
          className="flex size-4 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-hidden transition-colors hover:bg-muted hover:text-foreground"
          title="Clear selected text"
        >
          <X className="size-2.5" />
        </button>
      </div>
      <p className="line-clamp-3 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground select-text">
        {text}
      </p>
    </div>
  )
}
