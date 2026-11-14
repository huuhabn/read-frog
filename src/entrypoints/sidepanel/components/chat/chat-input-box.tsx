import type { LLMProviderConfig } from "@/types/config/provider"
import type { SelectedModelConfig } from "@/utils/sidepanel/chat-model-storage"
import type { ActiveTabContent } from "@/utils/sidepanel/page-context"
import { ArrowRight, Globe, Plus, Square } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Textarea } from "@/components/ui/base-ui/textarea"
import { i18n } from "@/utils/i18n"
import { useActiveTabSelection } from "@/utils/sidepanel/active-tab-selection"
import { isRestrictedUrl } from "@/utils/sidepanel/page-context"
import { cn } from "@/utils/styles/utils"
import { ModelSelectorDropdown } from "../common/model-selector-dropdown"
import { SelectionSnippetCard } from "../common/selection-snippet-card"
import { filterCustomAIActions, type CustomAIAction } from "./custom-ai-actions"
import { SlashPromptPopover } from "./slash-prompt-popover"

interface ChatInputBoxProps {
  input: string
  setInput: (value: string) => void
  onSend: (text?: string) => void | Promise<void>
  onStop: () => void
  isStreaming: boolean
  isTranslating: boolean
  selectedModel: SelectedModelConfig
  onSelectModel: (providerId: string, model: string) => void | Promise<void>
  llmProviders: LLMProviderConfig[]
  usePageContext: boolean
  setUsePageContext: (value: boolean) => void
  activeTab: ActiveTabContent | null
}

export function ChatInputBox({
  input,
  setInput,
  onSend,
  onStop,
  isStreaming,
  isTranslating,
  selectedModel,
  onSelectModel,
  llmProviders,
  usePageContext,
  setUsePageContext,
  activeTab,
}: ChatInputBoxProps) {
  const [isSlashOpen, setIsSlashOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState("")
  const [selectedActionIndex, setSelectedActionIndex] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isRestricted = Boolean(activeTab?.url && isRestrictedUrl(activeTab.url))

  const { selectedSnippet, clearSelection } = useActiveTabSelection()

  const handleClearSnippet = () => {
    clearSelection()
  }

  const filteredActions = useMemo(() => {
    return filterCustomAIActions(slashQuery)
  }, [slashQuery])

  const safeSelectedActionIndex =
    filteredActions.length === 0 ? 0 : Math.min(selectedActionIndex, filteredActions.length - 1)

  // Auto-resize textarea height
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea || typeof input !== "string") return
    textarea.style.height = "auto"
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 36), 128)
    textarea.style.height = `${nextHeight}px`
  }, [input])

  // Close slash popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isSlashOpen && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsSlashOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isSlashOpen])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInput(val)

    // Check for slash command trigger
    const cursorPos = e.target.selectionStart ?? val.length
    const textBeforeCursor = val.slice(0, cursorPos)
    const slashMatch = textBeforeCursor.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/)

    if (slashMatch) {
      setSlashQuery(slashMatch[1] || "")
      setIsSlashOpen(true)
      setSelectedActionIndex(0)
    } else {
      setIsSlashOpen(false)
    }
  }

  const handleSelectAction = useCallback(
    (action: CustomAIAction) => {
      setIsSlashOpen(false)
      const promptToSet = action.prompt
      setInput(promptToSet)
      textareaRef.current?.focus()
    },
    [setInput],
  )

  const handleSendAction = () => {
    if (!input.trim() && !selectedSnippet) return
    const textToSend = input.trim()
      ? selectedSnippet
        ? `${input.trim()}\n\n> ${selectedSnippet}`
        : input.trim()
      : selectedSnippet || ""
    void onSend(textToSend)
    setInput("")
    clearSelection()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSlashOpen && filteredActions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedActionIndex((prev) => (prev + 1) % filteredActions.length)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedActionIndex(
          (prev) => (prev - 1 + filteredActions.length) % filteredActions.length,
        )
        return
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        const selected = filteredActions[safeSelectedActionIndex]
        if (selected) {
          handleSelectAction(selected)
        }
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setIsSlashOpen(false)
        return
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendAction()
    }
  }

  const toggleSlashMenu = () => {
    if (isSlashOpen) {
      setIsSlashOpen(false)
    } else {
      setSlashQuery("")
      setIsSlashOpen(true)
      setSelectedActionIndex(0)
      textareaRef.current?.focus()
    }
  }

  const toggleTabContext = () => {
    if (!isRestricted && activeTab) {
      setUsePageContext(!usePageContext)
    }
  }

  const tabContextTooltip = isRestricted
    ? `${i18n.t("sidePanel.chat.internalPage")} (${activeTab?.url || ""})`
    : !activeTab
      ? i18n.t("sidePanel.chat.tabContextOff")
      : usePageContext
        ? `${i18n.t("sidePanel.chat.tabContextOn")} • ${activeTab.title || activeTab.url}`
        : `${i18n.t("sidePanel.chat.tabContextOff")} • ${activeTab.title || activeTab.url}`

  return (
    <div ref={containerRef} className="relative w-full min-w-0 bg-background p-2.5">
      {/* Custom AI Actions Floating Popover */}
      {isSlashOpen && (
        <SlashPromptPopover
          query={slashQuery}
          actions={filteredActions}
          selectedIndex={safeSelectedActionIndex}
          onSelect={handleSelectAction}
          onClose={() => setIsSlashOpen(false)}
          onHoverIndex={setSelectedActionIndex}
        />
      )}

      {/* Main Input Container */}
      <div className="relative flex w-full min-w-0 flex-col rounded-2xl border border-border/70 bg-muted/25 p-2 transition-all focus-within:border-primary/50 focus-within:bg-background focus-within:ring-1 focus-within:ring-primary/20">
        {/* Selection Snippet Card */}
        {selectedSnippet && (
          <SelectionSnippetCard text={selectedSnippet} onClear={handleClearSnippet} />
        )}

        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={i18n.t("sidePanel.chat.inputPlaceholderCompact")}
          rows={1}
          className="max-h-32 min-h-[36px] w-full resize-none border-0 bg-transparent px-1.5 py-1 shadow-none focus-visible:ring-0"
        />

        {/* Bottom Toolbar */}
        <div className="flex w-full min-w-0 items-center justify-between gap-1.5 pt-1">
          {/* Left Controls: Action button + Model selector + Tab Context Icon */}
          <div className="flex min-w-0 items-center gap-1">
            {/* Quick Actions (+) Button */}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={toggleSlashMenu}
              className="size-6.5 shrink-0 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              title={i18n.t("sidePanel.chat.actions")}
            >
              <Plus className="size-3.5" />
            </Button>

            {/* Tab Context Icon Button */}
            <button
              type="button"
              onClick={toggleTabContext}
              disabled={isRestricted || !activeTab}
              title={tabContextTooltip}
              className={cn(
                "flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-[11px] font-medium outline-hidden transition-all disabled:cursor-not-allowed disabled:opacity-40",
                isRestricted
                  ? "border border-dashed border-border/60 text-muted-foreground/60"
                  : usePageContext
                    ? "border border-primary/30 bg-primary/15 text-primary hover:bg-primary/25"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Globe className="size-3.5 shrink-0" />
            </button>

            {/* Model Selector Dropdown */}
            <ModelSelectorDropdown
              selectedProviderId={selectedModel.providerId}
              selectedModelName={selectedModel.model}
              onSelectModel={onSelectModel}
              llmProviders={llmProviders}
              variant="subtle"
            />
          </div>

          {/* Right Controls: Submit or Stop Button */}
          <div className="flex shrink-0 items-center">
            {isStreaming || isTranslating ? (
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="size-6 rounded-full shadow-xs transition-transform hover:scale-105 active:scale-95"
                onClick={onStop}
                title={i18n.t("sidePanel.chat.stop")}
              >
                <Square className="size-3 fill-current" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                disabled={!input.trim() && !selectedSnippet}
                className="size-6 rounded-full shadow-xs transition-transform hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-30"
                onClick={handleSendAction}
                title={i18n.t("sidePanel.chat.send")}
              >
                <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
