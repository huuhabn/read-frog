import type { BackgroundTextStreamSnapshot } from "@/types/background-stream"
import { useAtomValue } from "jotai"
import { Check, Copy, FileEdit, Languages, Sparkles, Square } from "lucide-react"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/base-ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/base-ui/dropdown-menu"
import { Textarea } from "@/components/ui/base-ui/textarea"
import { isLLMProviderConfig } from "@/types/config/provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { selectedChatModelAtom } from "@/utils/atoms/sidepanel"
import { streamBackgroundText } from "@/utils/content-script/background-stream-client"
import { i18n } from "@/utils/i18n"
import { getActiveTabContent } from "@/utils/sidepanel/page-context"

interface LanguageOption {
  code: string
  name: string
}

const POPULAR_LANGUAGES: LanguageOption[] = [
  { code: "vi", name: "Tiếng Việt" },
  { code: "en", name: "English" },
  { code: "zh-CN", name: "中文 (Giản thể)" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "es", name: "Español" },
  { code: "ru", name: "Русский" },
]

export function TranslateView() {
  const selectedModel = useAtomValue(selectedChatModelAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

  const [sourceText, setSourceText] = useState("")
  const [translatedText, setTranslatedText] = useState("")
  const [targetLang, setTargetLang] = useState<LanguageOption>(
    POPULAR_LANGUAGES[0] || { code: "vi", name: "Tiếng Việt" },
  )
  const [isTranslating, setIsTranslating] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)

  const handlePasteSelection = async () => {
    const tabInfo = await getActiveTabContent()
    if (tabInfo?.selectedText) {
      setSourceText(tabInfo.selectedText)
    }
  }

  const handleCopy = async () => {
    if (!translatedText) return
    await navigator.clipboard.writeText(translatedText)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleTranslate = async () => {
    if (!sourceText.trim() || isTranslating) return

    setTranslatedText("")
    setIsTranslating(true)

    const controller = new AbortController()
    abortControllerRef.current = controller

    const matchedProvider = providersConfig.find((p) => p.id === selectedModel.providerId)

    try {
      await streamBackgroundText(
        {
          providerKind: "local",
          providerId: selectedModel.providerId,
          providerConfig:
            matchedProvider && isLLMProviderConfig(matchedProvider) ? matchedProvider : undefined,
          instructions: `Bạn là chuyên gia dịch thuật xuất sắc. Hãy dịch văn bản của người dùng sang ${targetLang.name} một cách tự nhiên, chuẩn xác, lưu loát và giữ đúng giọng điệu. Chỉ trả về bản dịch hoàn chỉnh, không thêm lời chào hay giải thích thừa.`,
          messages: [
            {
              role: "user",
              content: sourceText,
            },
          ],
          temperature: 0.3,
          sourceFeature: `Sidepanel Translate (${targetLang.name})`,
        },
        {
          signal: controller.signal,
          onChunk: (snapshot: BackgroundTextStreamSnapshot) => {
            setTranslatedText(snapshot.output || "")
          },
        },
      )
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setTranslatedText(
          `*(${i18n.t("sidePanel.translate.error", [(err as Error)?.message || ""])})*`,
        )
      }
    } finally {
      setIsTranslating(false)
      abortControllerRef.current = null
    }
  }

  const handleStop = () => {
    abortControllerRef.current?.abort()
    setIsTranslating(false)
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex h-12 items-center justify-between border-b border-border/60 px-4">
        <div className="flex items-center gap-2">
          <Languages className="size-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight">
            {i18n.t("sidePanel.translate.title")}
          </h2>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-[11px]"
          onClick={() => void handlePasteSelection()}
        >
          <FileEdit className="size-3" />
          {i18n.t("sidePanel.translate.pasteSelection")}
        </Button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Source Text */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {i18n.t("sidePanel.translate.autoDetect")}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {i18n.t("sidePanel.translate.charsCount", [sourceText.length])}
            </span>
          </div>
          <Textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder={i18n.t("sidePanel.translate.placeholder")}
            rows={4}
            className="resize-none text-xs"
          />
        </div>

        {/* Language & Action Controls */}
        <div className="flex items-center justify-between border-y border-border/40 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {i18n.t("sidePanel.translate.translateTo")}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-7 items-center justify-between gap-1.5 rounded-md border border-input bg-transparent px-2.5 text-xs font-medium hover:bg-muted">
                {targetLang.name}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44 text-xs">
                {POPULAR_LANGUAGES.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => setTargetLang(lang)}
                    className="flex items-center justify-between"
                  >
                    <span>{lang.name}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{lang.code}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {isTranslating ? (
            <Button
              size="sm"
              variant="destructive"
              className="h-7 gap-1 px-3 text-xs"
              onClick={handleStop}
            >
              <Square className="size-3" />
              {i18n.t("sidePanel.translate.stop")}
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={!sourceText.trim()}
              className="h-7 gap-1 px-3 text-xs"
              onClick={() => void handleTranslate()}
            >
              <Sparkles className="size-3" />
              {i18n.t("sidePanel.translate.action")}
            </Button>
          )}
        </div>

        {/* Translation Output */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {i18n.t("sidePanel.translate.outputLabel", [targetLang.name])}
            </span>
            {translatedText && (
              <Button
                size="icon"
                variant="ghost"
                className="size-6 text-muted-foreground hover:text-foreground"
                onClick={() => void handleCopy()}
              >
                {isCopied ? (
                  <Check className="size-3 text-emerald-500" />
                ) : (
                  <Copy className="size-3" />
                )}
              </Button>
            )}
          </div>
          <div className="min-h-[120px] rounded-lg border border-border/70 bg-muted/20 p-3 text-xs leading-relaxed">
            {translatedText ? (
              <p className="whitespace-pre-wrap">{translatedText}</p>
            ) : (
              <div className="flex h-24 items-center justify-center text-xs text-muted-foreground/60 italic">
                {isTranslating
                  ? i18n.t("sidePanel.translate.translating")
                  : i18n.t("sidePanel.translate.empty")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
