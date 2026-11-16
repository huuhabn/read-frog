import { ChevronDown, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/base-ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/base-ui/popover"
import { Textarea } from "@/components/ui/base-ui/textarea"
import {
  DEFAULT_TRANSLATE_PREFERENCES,
  type TranslateComplexity,
  type TranslateLength,
  type TranslatePreferences,
  type TranslateStyle,
  type TranslateTone,
} from "@/utils/sidepanel/translate-preferences"
import { cn } from "@/utils/styles/utils"

interface TranslationPreferencesPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preferences: TranslatePreferences
  onChange: (preferences: TranslatePreferences) => void
  isCustom?: boolean
}

const LENGTH_OPTIONS: { value: TranslateLength; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "concise", label: "Concise" },
  { value: "expanded", label: "Expanded" },
]

const TONE_OPTIONS: { value: TranslateTone; label: string }[] = [
  { value: "neutral", label: "Neutral" },
  { value: "casual", label: "Casual" },
  { value: "formal", label: "Formal" },
  { value: "authoritative", label: "Authoritative" },
  { value: "empathetic", label: "Empathetic" },
]

const STYLE_OPTIONS: { value: TranslateStyle; label: string }[] = [
  { value: "dynamic", label: "Dynamic Equivalence" },
  { value: "literal", label: "Literal" },
  { value: "creative", label: "Creative Adaptation" },
]

const COMPLEXITY_OPTIONS: { value: TranslateComplexity; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "layman", label: "Layman" },
  { value: "expert", label: "Expert" },
]

export function TranslationPreferencesPopover({
  open,
  onOpenChange,
  preferences,
  onChange,
  isCustom = false,
}: TranslationPreferencesPopoverProps) {
  const handleReset = () => {
    onChange({ ...DEFAULT_TRANSLATE_PREFERENCES })
  }

  const updateField = <K extends keyof TranslatePreferences>(
    key: K,
    value: TranslatePreferences[K],
  ) => {
    onChange({
      ...preferences,
      [key]: value,
    })
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        title={isCustom ? "Custom preferences" : "Default preferences"}
        className={cn(
          "flex h-6.5 cursor-pointer items-center gap-1 rounded-md border px-2 text-[11px] font-medium outline-hidden transition-colors",
          isCustom
            ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
            : "border-border/60 bg-muted/40 text-foreground/90 hover:bg-muted",
        )}
      >
        <span>{isCustom ? "Custom" : "Default"}</span>
        <ChevronDown
          className={cn(
            "size-3 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={6}
        className="scrollbar-slim max-h-[85vh] w-[320px] overflow-y-auto rounded-2xl border border-border/80 bg-background/95 p-4 shadow-xl backdrop-blur-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            Translation preferences
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={handleReset}
            title="Reset to default"
          >
            <RotateCcw className="size-3.5" />
          </Button>
        </div>

        <div className="space-y-3.5 pt-3">
          {/* Length */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">Length</span>
            <div className="flex flex-wrap gap-1.5">
              {LENGTH_OPTIONS.map((opt) => {
                const isSelected = preferences.length === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateField("length", opt.value)}
                    className={cn(
                      "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors outline-none",
                      isSelected
                        ? "bg-primary/15 text-primary shadow-xs dark:bg-primary/25"
                        : "bg-muted/50 text-foreground/80 hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tone */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">Tone</span>
            <div className="flex flex-wrap gap-1.5">
              {TONE_OPTIONS.map((opt) => {
                const isSelected = preferences.tone === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateField("tone", opt.value)}
                    className={cn(
                      "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors outline-none",
                      isSelected
                        ? "bg-primary/15 text-primary shadow-xs dark:bg-primary/25"
                        : "bg-muted/50 text-foreground/80 hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Style */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">Style</span>
            <div className="flex flex-wrap gap-1.5">
              {STYLE_OPTIONS.map((opt) => {
                const isSelected = preferences.style === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateField("style", opt.value)}
                    className={cn(
                      "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors outline-none",
                      isSelected
                        ? "bg-primary/15 text-primary shadow-xs dark:bg-primary/25"
                        : "bg-muted/50 text-foreground/80 hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Complexity */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">Complexity</span>
            <div className="flex flex-wrap gap-1.5">
              {COMPLEXITY_OPTIONS.map((opt) => {
                const isSelected = preferences.complexity === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateField("complexity", opt.value)}
                    className={cn(
                      "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors outline-none",
                      isSelected
                        ? "bg-primary/15 text-primary shadow-xs dark:bg-primary/25"
                        : "bg-muted/50 text-foreground/80 hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Custom System Prompt */}
          <div className="space-y-1.5 border-t border-border/40 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">
                Custom system prompt
              </span>
              {preferences.customPrompt && (
                <span className="text-[10px] text-muted-foreground">
                  {preferences.customPrompt.length} chars
                </span>
              )}
            </div>
            <Textarea
              value={preferences.customPrompt}
              onChange={(e) => updateField("customPrompt", e.target.value)}
              placeholder="e.g. Keep tech terminology in English, translate idioms naturally..."
              rows={2}
              className="resize-none rounded-xl border border-input/80 bg-muted/20 text-xs focus:bg-background"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
