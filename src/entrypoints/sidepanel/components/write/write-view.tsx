import type { BackgroundTextStreamSnapshot } from "@/types/background-stream"
import type { LLMProviderConfig } from "@/types/config/provider"
import { useAtom, useAtomValue } from "jotai"
import { ArrowDown, Check, Copy, PenTool, Sparkles, Square } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Textarea } from "@/components/ui/base-ui/textarea"
import { isLLMProviderConfig } from "@/types/config/provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { selectedChatModelAtom } from "@/utils/atoms/sidepanel"
import { streamBackgroundText } from "@/utils/content-script/background-stream-client"
import { i18n } from "@/utils/i18n"
import { useActiveTabSelection } from "@/utils/sidepanel/active-tab-selection"
import { setLocalSelectedChatModel } from "@/utils/sidepanel/chat-model-storage"
import { ModelSelectorDropdown } from "../common/model-selector-dropdown"

type WriteAction = "polish" | "formal" | "casual" | "shorten" | "grammar"

const ACTION_BUTTONS: Array<{
  id: WriteAction
  labelKey:
    | "sidePanel.write.actions.polish"
    | "sidePanel.write.actions.formal"
    | "sidePanel.write.actions.casual"
    | "sidePanel.write.actions.shorten"
    | "sidePanel.write.actions.grammar"
}> = [
  { id: "polish", labelKey: "sidePanel.write.actions.polish" },
  { id: "formal", labelKey: "sidePanel.write.actions.formal" },
  { id: "casual", labelKey: "sidePanel.write.actions.casual" },
  { id: "shorten", labelKey: "sidePanel.write.actions.shorten" },
  { id: "grammar", labelKey: "sidePanel.write.actions.grammar" },
]

function getInstructionForAction(action: WriteAction): string {
  switch (action) {
    case "polish":
      return "Hãy viết lại văn bản sau sao cho mượt mà, giàu sức biểu đạt và tự nhiên hơn nhưng vẫn giữ nguyên ý nghĩa cốt lõi. Giữ nguyên ngôn ngữ gốc của văn bản."
    case "formal":
      return "Hãy chuyển đổi văn bản sau sang giọng văn trang trọng, chuẩn mực công sở/kinh doanh (formal business tone). Giữ nguyên ngôn ngữ gốc."
    case "casual":
      return "Hãy chuyển đổi văn bản sau sang giọng văn thân mật, dễ hiểu, tự nhiên (casual conversational tone). Giữ nguyên ngôn ngữ gốc."
    case "shorten":
      return "Hãy rút gọn văn bản sau sao cho ngắn gọn, cô đọng nhất mà vẫn truyền tải trọn vẹn thông điệp chính. Giữ nguyên ngôn ngữ gốc."
    case "grammar":
      return "Hãy phát hiện và sửa toàn bộ lỗi chính tả, ngữ pháp, dấu câu và dùng từ trong đoạn văn sau. Trình bày lại đoạn văn đã sửa sạch đẹp."
    default:
      return "Hãy viết lại văn bản sau một cách rõ ràng và mạch lạc hơn."
  }
}

export function WriteView() {
  const [selectedModel, setSelectedModel] = useAtom(selectedChatModelAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

  const [inputText, setInputText] = useState("")
  const [outputText, setOutputText] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentAction, setCurrentAction] = useState<WriteAction>("polish")
  const [isCopied, setIsCopied] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)
  const lastInsertedSnippetRef = useRef<string | null>(null)

  const { selectedSnippet, clearSelection } = useActiveTabSelection()

  // Filter available LLM providers
  const llmProviders = useMemo(
    () =>
      providersConfig.filter((p): p is LLMProviderConfig => isLLMProviderConfig(p) && p.enabled),
    [providersConfig],
  )

  const handleSelectModel = (providerId: string, model: string) => {
    setSelectedModel({ providerId, model })
    void setLocalSelectedChatModel({ providerId, model })
  }

  // Auto-fill selected text into textarea when selecting text on page
  useEffect(() => {
    if (selectedSnippet) {
      if (!inputText.trim() || inputText === lastInsertedSnippetRef.current) {
        setInputText(selectedSnippet)
        lastInsertedSnippetRef.current = selectedSnippet
      }
    }
  }, [selectedSnippet, inputText])

  const handleCopy = async () => {
    if (!outputText) return
    await navigator.clipboard.writeText(outputText)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleExecute = async (action: WriteAction) => {
    if (!inputText.trim() || isProcessing) return

    clearSelection()
    lastInsertedSnippetRef.current = null
    setCurrentAction(action)
    setOutputText("")
    setIsProcessing(true)

    const controller = new AbortController()
    abortControllerRef.current = controller

    const instruction = getInstructionForAction(action)
    const matchedProvider = providersConfig.find((p) => p.id === selectedModel.providerId)

    try {
      await streamBackgroundText(
        {
          providerKind: "local",
          providerId: selectedModel.providerId,
          providerConfig:
            matchedProvider && isLLMProviderConfig(matchedProvider) ? matchedProvider : undefined,
          instructions: instruction,
          messages: [{ role: "user", content: inputText }],
          temperature: 0.5,
          sourceFeature: `Sidepanel Write (${action})`,
        },
        {
          signal: controller.signal,
          onChunk: (snapshot: BackgroundTextStreamSnapshot) => {
            setOutputText(snapshot.output || "")
          },
        },
      )
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setOutputText(`*(${i18n.t("sidePanel.write.error", [(err as Error)?.message || ""])})*`)
      }
    } finally {
      setIsProcessing(false)
      abortControllerRef.current = null
    }
  }

  const handleStop = () => {
    abortControllerRef.current?.abort()
    setIsProcessing(false)
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border/60 bg-background/80 px-3 backdrop-blur-xs">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <PenTool className="size-3.5" />
          </div>
          <span className="truncate text-xs font-semibold tracking-tight">
            {i18n.t("sidePanel.write.title")}
          </span>
        </div>
        <ModelSelectorDropdown
          selectedProviderId={selectedModel.providerId}
          selectedModelName={selectedModel.model}
          onSelectModel={handleSelectModel}
          llmProviders={llmProviders}
          variant="subtle"
        />
      </header>

      <div className="scrollbar-slim flex-1 space-y-4 overflow-y-auto p-4">
        {/* Input Text Box */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              {i18n.t("sidePanel.write.originalText")}
            </label>
            <span className="text-[10px] text-muted-foreground">
              {i18n.t("sidePanel.write.charsCount", [inputText.length])}
            </span>
          </div>
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={i18n.t("sidePanel.write.placeholder")}
            rows={4}
            className="resize-none text-xs"
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {i18n.t("sidePanel.write.chooseStyle")}
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {ACTION_BUTTONS.map((btn) => (
              <Button
                key={btn.id}
                size="sm"
                variant={currentAction === btn.id ? "default" : "outline"}
                className="h-8 justify-start px-2.5 text-xs font-normal"
                disabled={!inputText.trim() || isProcessing}
                onClick={() => void handleExecute(btn.id)}
              >
                <Sparkles className="mr-1 size-3 shrink-0 text-primary" />
                <span className="truncate">{i18n.t(btn.labelKey)}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Output Text Box */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              {i18n.t("sidePanel.write.outputLabel")}
            </label>
            <div className="flex items-center gap-1">
              {isProcessing && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-6 gap-1 px-2 text-[10px]"
                  onClick={handleStop}
                >
                  <Square className="size-2.5" />
                  {i18n.t("sidePanel.write.stop")}
                </Button>
              )}
              {outputText && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1 px-2 text-[10px] text-muted-foreground"
                    onClick={() => {
                      setInputText(outputText)
                      setOutputText("")
                    }}
                    title={i18n.t("sidePanel.write.useAsInputTooltip")}
                  >
                    <ArrowDown className="size-3" />
                    {i18n.t("sidePanel.write.useAsInput")}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6 text-muted-foreground hover:text-foreground"
                    onClick={() => void handleCopy()}
                  >
                    {isCopied ? (
                      <Check className="size-3 text-success" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="min-h-[120px] rounded-xl border border-border/60 bg-muted/20 p-3 text-xs leading-relaxed">
            {outputText ? (
              <p className="whitespace-pre-wrap">{outputText}</p>
            ) : (
              <div className="flex h-24 items-center justify-center text-xs text-muted-foreground/60 italic">
                {isProcessing
                  ? i18n.t("sidePanel.write.processing")
                  : i18n.t("sidePanel.write.empty")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
