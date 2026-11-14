import type { BackgroundTextStreamSnapshot } from "@/types/background-stream"
import type { LLMProviderConfig } from "@/types/config/provider"
import type { SelectedModelConfig } from "@/utils/sidepanel/chat-model-storage"
import { useAtom } from "jotai"
import {
  ArrowLeftRight,
  Check,
  Copy,
  FileText,
  ImageIcon,
  Loader2,
  Mic,
  MicOff,
  Square,
  Volume2,
  X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Textarea } from "@/components/ui/base-ui/textarea"
import { env } from "@/env"
import { isLLMProviderConfig } from "@/types/config/provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { selectedChatModelAtom } from "@/utils/atoms/sidepanel"
import { streamBackgroundText } from "@/utils/content-script/background-stream-client"
import { i18n } from "@/utils/i18n"
import { useActiveTabSelection } from "@/utils/sidepanel/active-tab-selection"
import { setLocalSelectedChatModel } from "@/utils/sidepanel/chat-model-storage"
import {
  buildTranslateInstructions,
  DEFAULT_TRANSLATE_PREFERENCES,
  getLocalTranslatePreferences,
  isDefaultPreferences,
  setLocalTranslatePreferences,
  type TranslatePreferences,
} from "@/utils/sidepanel/translate-preferences"
import { cn } from "@/utils/styles/utils"
import {
  AUTO_DETECT_OPTION,
  POPULAR_LANGUAGES,
  type LanguageOption,
} from "../common/language-options"
import { LanguageSelectorDropdown } from "../common/language-selector-dropdown"
import { ModelSelectorDropdown } from "../common/model-selector-dropdown"
import { TranslationPreferencesPopover } from "./translation-preferences-popover"

export { AUTO_DETECT_OPTION, POPULAR_LANGUAGES, type LanguageOption }

type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: unknown) => void) | null
  onerror: ((event: unknown) => void) | null
  onend: (() => void) | null
}

export function TranslateView() {
  const [selectedModel, setSelectedModel] = useAtom(selectedChatModelAtom)
  const [providersConfig] = useAtom(configFieldsAtomMap.providersConfig)

  const [sourceText, setSourceText] = useState("")
  const [translatedText, setTranslatedText] = useState("")
  const [sourceLang, setSourceLang] = useState<LanguageOption>(AUTO_DETECT_OPTION)
  const [targetLang, setTargetLang] = useState<LanguageOption>(
    POPULAR_LANGUAGES[0] || { code: "vi", name: "Tiếng Việt" },
  )

  const [preferences, setPreferences] = useState<TranslatePreferences>(
    DEFAULT_TRANSLATE_PREFERENCES,
  )
  const [isPrefsOpen, setIsPrefsOpen] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [statusNotice, setStatusNotice] = useState<string | null>(null)

  const { selectedSnippet } = useActiveTabSelection()
  const lastInsertedSnippetRef = useRef<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Auto-fill selected text into textarea when selecting text on page
  useEffect(() => {
    if (selectedSnippet) {
      if (!sourceText.trim() || sourceText === lastInsertedSnippetRef.current) {
        setSourceText(selectedSnippet)
        lastInsertedSnippetRef.current = selectedSnippet
      }
    }
  }, [selectedSnippet, sourceText])

  // Filter available LLM providers
  const llmProviders = useMemo(
    () =>
      providersConfig.filter((p): p is LLMProviderConfig => isLLMProviderConfig(p) && p.enabled),
    [providersConfig],
  )

  // Load preferences from storage on mount
  useEffect(() => {
    let mounted = true
    void getLocalTranslatePreferences().then((stored) => {
      if (mounted) {
        setPreferences(stored)
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  // Auto fallback for selected model if not configured
  useEffect(() => {
    if (llmProviders.length > 0) {
      const isValid = llmProviders.some((p) => p.id === selectedModel.providerId)
      if (!isValid) {
        const fallbackProvider = llmProviders[0]
        if (fallbackProvider) {
          const modelName =
            typeof fallbackProvider.model === "string"
              ? fallbackProvider.model
              : fallbackProvider.model.customModel || fallbackProvider.model.model
          const fallbackModel: SelectedModelConfig = {
            providerId: fallbackProvider.id,
            model: modelName,
          }
          setSelectedModel(fallbackModel)
          void setLocalSelectedChatModel(fallbackModel)
        }
      }
    }
  }, [llmProviders, selectedModel.providerId, setSelectedModel])

  const handlePreferencesChange = useCallback((newPrefs: TranslatePreferences) => {
    setPreferences(newPrefs)
    void setLocalTranslatePreferences(newPrefs)
  }, [])

  const handleSelectModel = useCallback(
    (providerId: string, model: string) => {
      const nextModel: SelectedModelConfig = { providerId, model }
      setSelectedModel(nextModel)
      void setLocalSelectedChatModel(nextModel)
    },
    [setSelectedModel],
  )

  const handleSwapLanguages = () => {
    if (sourceLang.code === "auto") {
      // If auto detect, swap targetLang to source, and set new target
      const newSource = targetLang
      const newTarget =
        targetLang.code === "en"
          ? POPULAR_LANGUAGES.find((l) => l.code === "vi") || POPULAR_LANGUAGES[0]!
          : POPULAR_LANGUAGES.find((l) => l.code === "en") || POPULAR_LANGUAGES[1]!
      setSourceLang(newSource)
      setTargetLang(newTarget)
    } else {
      const currentSource = sourceLang
      const currentTarget = targetLang
      setSourceLang(currentTarget)
      setTargetLang(currentSource)
    }
  }

  const handleCopy = async () => {
    if (!translatedText) return
    await navigator.clipboard.writeText(translatedText)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleSpeak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      showNotice("Text-to-speech is not supported")
      return
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }

    if (!translatedText.trim()) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(translatedText)
    utterance.lang = targetLang.code
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  const showNotice = (msg: string) => {
    setStatusNotice(msg)
    setTimeout(() => setStatusNotice(null), 3000)
  }

  const handleMicToggle = () => {
    const SpeechRecognitionAPI =
      typeof window !== "undefined"
        ? (
            window as unknown as {
              SpeechRecognition?: new () => SpeechRecognitionInstance
              webkitSpeechRecognition?: new () => SpeechRecognitionInstance
            }
          ).SpeechRecognition ||
          (
            window as unknown as {
              SpeechRecognition?: new () => SpeechRecognitionInstance
              webkitSpeechRecognition?: new () => SpeechRecognitionInstance
            }
          ).webkitSpeechRecognition
        : null

    if (!SpeechRecognitionAPI) {
      showNotice("Speech recognition is not supported in this browser")
      return
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
      return
    }

    try {
      const recognition = new SpeechRecognitionAPI()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = sourceLang.code === "auto" ? "en-US" : sourceLang.code

      recognition.onresult = (event: unknown) => {
        const e = event as {
          results: Array<Array<{ transcript: string }>>
        }
        let transcript = ""
        for (let i = 0; i < e.results.length; i++) {
          const item = e.results[i]?.[0]
          if (item) {
            transcript += item.transcript + " "
          }
        }
        if (transcript.trim()) {
          setSourceText((prev) =>
            prev ? `${prev.trim()} ${transcript.trim()}` : transcript.trim(),
          )
        }
      }

      recognition.onerror = () => {
        setIsListening(false)
        recognitionRef.current = null
      }

      recognition.onend = () => {
        setIsListening(false)
        recognitionRef.current = null
      }

      recognitionRef.current = recognition
      recognition.start()
      setIsListening(true)
    } catch {
      setIsListening(false)
      recognitionRef.current = null
      showNotice("Failed to start speech recognition")
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const handleTranslate = async () => {
    const textToTranslate = sourceText.trim()
    if (!textToTranslate || isTranslating) return

    setTranslatedText("")
    setIsTranslating(true)

    const controller = new AbortController()
    abortControllerRef.current = controller

    const matchedProvider = providersConfig.find((p) => p.id === selectedModel.providerId)
    const instructions = buildTranslateInstructions(
      targetLang.name,
      sourceLang.code === "auto" ? undefined : sourceLang.name,
      preferences,
    )

    try {
      await streamBackgroundText(
        {
          providerKind: "local",
          providerId: selectedModel.providerId,
          providerConfig:
            matchedProvider && isLLMProviderConfig(matchedProvider) ? matchedProvider : undefined,
          instructions,
          messages: [
            {
              role: "user",
              content: textToTranslate,
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

  const isCustom = !isDefaultPreferences(preferences)
  const canTranslate = Boolean(sourceText.trim())

  return (
    <div className="flex h-full flex-col bg-background text-foreground antialiased selection:bg-primary/20">
      {/* Top Header */}
      <header className="flex h-12 shrink-0 items-center justify-between px-4">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {i18n.t("sidePanel.translate.title")}
        </h1>
      </header>

      {/* Model & Preferences Row */}
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-3">
        {/* Model Selector Dropdown */}
        <ModelSelectorDropdown
          selectedProviderId={selectedModel.providerId}
          selectedModelName={selectedModel.model}
          onSelectModel={handleSelectModel}
          llmProviders={llmProviders}
          variant="pill"
        />

        {/* Translation Preferences Popover */}
        <TranslationPreferencesPopover
          open={isPrefsOpen}
          onOpenChange={setIsPrefsOpen}
          preferences={preferences}
          onChange={handlePreferencesChange}
          isCustom={isCustom}
        />
      </div>

      {/* Main Content Area */}
      <div className="scrollbar-slim flex-1 space-y-3.5 overflow-y-auto px-4 pb-4">
        {/* Input Card */}
        <div className="space-y-2.5 rounded-2xl border border-border/80 bg-card p-3 shadow-xs">
          {/* Card Header: Language Selectors & Swap */}
          <div className="flex items-center justify-between rounded-xl bg-muted/40 px-2 py-1.5">
            {/* Source Language */}
            <LanguageSelectorDropdown
              selectedCode={sourceLang.code}
              onSelect={setSourceLang}
              options={POPULAR_LANGUAGES}
              allowAutoDetect
              variant="plain"
              align="start"
              ariaLabel={i18n.t("sidePanel.translate.autoDetect")}
            />

            {/* Swap Button */}
            <button
              type="button"
              onClick={handleSwapLanguages}
              aria-label="Swap languages"
              className="flex size-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-hidden transition-colors hover:bg-muted hover:text-foreground"
              title="Swap languages"
            >
              <ArrowLeftRight className="size-3.5" />
            </button>

            {/* Target Language */}
            <div className="flex items-center gap-1">
              <span className="sr-only">{i18n.t("sidePanel.translate.translateTo")}</span>
              <LanguageSelectorDropdown
                selectedCode={targetLang.code}
                onSelect={setTargetLang}
                options={POPULAR_LANGUAGES}
                variant="plain"
                align="end"
                ariaLabel={i18n.t("sidePanel.translate.translateTo")}
              />
            </div>
          </div>

          {/* Source Textarea */}
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder={
                i18n.t("sidePanel.translate.placeholder") || "Type or paste text here..."
              }
              rows={4}
              className="w-full resize-none border-0 bg-transparent p-1 text-xs leading-relaxed shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
            />
            {sourceText && (
              <button
                type="button"
                onClick={() => setSourceText("")}
                className="absolute top-1 right-1 flex size-5 cursor-pointer items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                title="Clear text"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Card Bottom Bar: Mic & Action Button */}
          <div className="flex items-center justify-between border-t border-border/40 pt-1">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleMicToggle}
                className={cn(
                  "flex size-7 cursor-pointer items-center justify-center rounded-full outline-hidden transition-colors",
                  isListening
                    ? "animate-pulse bg-red-500/15 text-red-500"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                title={isListening ? "Stop listening" : "Speech to text"}
              >
                {isListening ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
              </button>
              {sourceText && (
                <span className="text-[10px] text-muted-foreground">
                  {i18n.t("sidePanel.translate.charsCount", [sourceText.length])}
                </span>
              )}
            </div>

            {isTranslating ? (
              <Button
                size="sm"
                variant="destructive"
                className="h-8 cursor-pointer gap-1 rounded-xl px-4 text-xs font-medium"
                onClick={handleStop}
              >
                <Square className="size-3" />
                {i18n.t("sidePanel.translate.stop")}
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={!canTranslate}
                className="h-8 cursor-pointer rounded-xl px-5 text-xs font-medium transition-all"
                onClick={() => void handleTranslate()}
              >
                {i18n.t("sidePanel.translate.action")}
              </Button>
            )}
          </div>
        </div>

        {/* Translation Output Result Card */}
        {(translatedText || isTranslating) && (
          <div className="animate-in space-y-2 rounded-2xl border border-border/80 bg-muted/20 p-3.5 shadow-xs duration-200 fade-in-50">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-foreground">{targetLang.name}</span>
                {isTranslating && (
                  <span className="flex items-center gap-1 text-[11px] text-primary">
                    <Loader2 className="size-3 animate-spin" />
                    <span>{i18n.t("sidePanel.translate.translating")}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {translatedText && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                      onClick={handleSpeak}
                      title={isSpeaking ? "Stop speaking" : "Speak translation"}
                    >
                      <Volume2
                        className={cn("size-3.5", isSpeaking && "animate-pulse text-primary")}
                      />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                      onClick={() => void handleCopy()}
                      title="Copy translation"
                    >
                      {isCopied ? (
                        <Check className="size-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </Button>
                  </>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                  onClick={() => setTranslatedText("")}
                  title="Clear result"
                >
                  <X className="size-3" />
                </Button>
              </div>
            </div>

            <div className="text-xs leading-relaxed whitespace-pre-wrap text-foreground">
              {translatedText ? (
                <p>{translatedText}</p>
              ) : (
                <div className="flex h-16 items-center justify-center text-xs text-muted-foreground/60 italic">
                  {i18n.t("sidePanel.translate.translating")}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Temporary Notice Banner */}
        {statusNotice && (
          <div className="animate-in rounded-xl bg-muted px-3 py-1.5 text-center text-xs text-muted-foreground fade-in">
            {statusNotice}
          </div>
        )}

        {/* Quick Tools Section: "You can also translate:" */}
        <div className="space-y-2 pt-2">
          <span className="text-xs font-medium text-muted-foreground">You can also translate:</span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                window.open(`${env.WXT_WEBSITE_URL}/pdf-translation`, "_blank")
              }}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border/80 bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-muted/60"
            >
              <FileText className="size-3.5 text-muted-foreground" />
              <span>PDF</span>
            </button>

            <button
              type="button"
              onClick={() => {
                textareaRef.current?.focus()
                showNotice("Paste or type your long text in the box above")
              }}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border/80 bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-muted/60"
            >
              <FileText className="size-3.5 text-muted-foreground" />
              <span>Long text</span>
            </button>

            <button
              type="button"
              onClick={() => {
                showNotice("Image translation is coming soon!")
              }}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border/80 bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-muted/60"
            >
              <ImageIcon className="size-3.5 text-muted-foreground" />
              <span>Image</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
