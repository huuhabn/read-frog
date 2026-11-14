import type { BackgroundTextStreamSnapshot } from "@/types/background-stream"
import type { ChatMessageItem } from "@/utils/db/dexie/tables/chat-session"
import { Icon } from "@iconify/react"
import { useAtom, useAtomValue } from "jotai"
import {
  Check,
  ChevronDown,
  Copy,
  Globe,
  History,
  Languages,
  Plus,
  Send,
  Sparkles,
  Square,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { browser } from "#imports"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { Badge } from "@/components/ui/base-ui/badge"
import { Button } from "@/components/ui/base-ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/base-ui/dropdown-menu"
import { Textarea } from "@/components/ui/base-ui/textarea"
import { isLLMProviderConfig, type LLMProviderConfig } from "@/types/config/provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import {
  activeChatSessionIdAtom,
  includePageContextAtom,
  selectedChatModelAtom,
  sidepanelNavTabAtom,
} from "@/utils/atoms/sidepanel"
import { streamBackgroundText } from "@/utils/content-script/background-stream-client"
import { db } from "@/utils/db/dexie/db"
import { i18n } from "@/utils/i18n"
import { createLogger } from "@/utils/logging/logger"
import { getSelectableProvidersForCapability } from "@/utils/providers/provider-registry"
import {
  getLocalSelectedChatModel,
  setLocalSelectedChatModel,
  type SelectedModelConfig,
} from "@/utils/sidepanel/chat-model-storage"
import {
  getActiveTabContent,
  isRestrictedUrl,
  type ActiveTabContent,
} from "@/utils/sidepanel/page-context"
import {
  buildUpworkCoverLetterPrompt,
  extractUpworkJobData,
  fillUpworkCoverLetter,
  isUpworkJobDetailUrl,
  translateTextWithProvider,
  UPWORK_QUICK_PROMPT_ANALYZE_JOB,
  UPWORK_QUICK_PROMPT_COVER_LETTER,
  UPWORK_TRANSLATE_LANGUAGES,
} from "@/utils/sidepanel/upwork"
import { cn } from "@/utils/styles/utils"
import { ChatHistoryDrawer } from "./chat-history-drawer"
import { filterCustomAIActions, type CustomAIAction } from "./custom-ai-actions"
import { SlashPromptPopover } from "./slash-prompt-popover"

const QUICK_PROMPTS = [
  "Tóm tắt các ý chính trên trang này",
  "Giải thích các thuật ngữ chuyên môn trong bài",
  "Phân tích ưu điểm và nhược điểm của chủ đề này",
  "Viết một email tóm tắt gửi cho đồng nghiệp",
]

const log = createLogger("sidepanel:chat")

function getTimestamp(): Date {
  return new Date()
}

export function ChatView() {
  const [activeSessionId, setActiveSessionId] = useAtom(activeChatSessionIdAtom)
  const [selectedModel, setSelectedModel] = useAtom(selectedChatModelAtom)
  const [usePageContext, setUsePageContext] = useAtom(includePageContextAtom)
  const [navTab, setNavTab] = useAtom(sidepanelNavTabAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const [upworkConfig, setUpworkConfig] = useAtom(configFieldsAtomMap.upwork)

  const translationProviders = useMemo(
    () => getSelectableProvidersForCapability("pageTranslation", providersConfig),
    [providersConfig],
  )

  const [messages, setMessages] = useState<ChatMessageItem[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [translatingMsgId, setTranslatingMsgId] = useState<string | null>(null)
  const [showOriginalMap, setShowOriginalMap] = useState<Record<string, boolean>>({})
  const [showTranslatedResponseMap, setShowTranslatedResponseMap] = useState<
    Record<string, boolean>
  >({})
  const [activeTab, setActiveTab] = useState<ActiveTabContent | null>(null)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [fillStatusIndex, setFillStatusIndex] = useState<{ index: number; text: string } | null>(
    null,
  )

  const isUpworkJob = Boolean(
    upworkConfig?.enabled && activeTab?.url && isUpworkJobDetailUrl(activeTab.url),
  )

  const isHistoryVisible = isHistoryOpen || navTab === "history"

  const handleCloseHistory = useCallback(() => {
    setIsHistoryOpen(false)
    if (navTab === "history") {
      setNavTab("chat")
    }
  }, [navTab, setNavTab])

  // Custom AI Actions slash menu state
  const [isSlashOpen, setIsSlashOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState("")
  const [selectedActionIndex, setSelectedActionIndex] = useState(0)

  const loadedSessionIdRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputContainerRef = useRef<HTMLDivElement>(null)

  const filteredActions = useMemo(() => {
    return filterCustomAIActions(slashQuery)
  }, [slashQuery])

  const safeSelectedActionIndex =
    filteredActions.length === 0 ? 0 : Math.min(selectedActionIndex, filteredActions.length - 1)

  // Close slash popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isSlashOpen &&
        inputContainerRef.current &&
        !inputContainerRef.current.contains(e.target as Node)
      ) {
        setIsSlashOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isSlashOpen])

  // Filter available LLM providers from config
  const llmProviders = providersConfig.filter((p) => isLLMProviderConfig(p) && p.enabled)

  // Auto-fallback if the current selected provider is not enabled/configured
  useEffect(() => {
    if (!activeSessionId && llmProviders.length > 0) {
      const isCurrentProviderValid = llmProviders.some((p) => p.id === selectedModel.providerId)
      if (!isCurrentProviderValid) {
        const fallbackProvider = llmProviders[0]
        if (fallbackProvider) {
          const modelName = isLLMProviderConfig(fallbackProvider)
            ? typeof fallbackProvider.model === "string"
              ? fallbackProvider.model
              : fallbackProvider.model.customModel || fallbackProvider.model.model
            : fallbackProvider.id
          const fallbackModel: SelectedModelConfig = {
            providerId: fallbackProvider.id,
            model: modelName,
          }
          setSelectedModel(fallbackModel)
          void setLocalSelectedChatModel(fallbackModel)
        }
      }
    }
  }, [activeSessionId, llmProviders, selectedModel.providerId, setSelectedModel])

  // Auto load active tab content and listen to tab changes
  useEffect(() => {
    let isSubscribed = true

    const updateTabContent = () => {
      void getActiveTabContent(true).then((content) => {
        if (isSubscribed && content) {
          setActiveTab(content)
          if (content.url && !isRestrictedUrl(content.url)) {
            setUsePageContext(true)
          }
        }
      })
    }

    updateTabContent()

    const handleActivated = () => {
      updateTabContent()
    }

    const handleUpdated = (_tabId: number, changeInfo: { status?: string; url?: string }) => {
      if (changeInfo.status === "complete" || changeInfo.url) {
        updateTabContent()
      }
    }

    browser.tabs?.onActivated?.addListener(handleActivated)
    browser.tabs?.onUpdated?.addListener(handleUpdated)

    return () => {
      isSubscribed = false
      browser.tabs?.onActivated?.removeListener(handleActivated)
      browser.tabs?.onUpdated?.removeListener(handleUpdated)
    }
  }, [setUsePageContext])

  // Load existing session messages
  useEffect(() => {
    let isSubscribed = true
    if (activeSessionId && loadedSessionIdRef.current !== activeSessionId) {
      void db.chatSession.get(activeSessionId).then((session) => {
        if (isSubscribed && session) {
          loadedSessionIdRef.current = activeSessionId
          setMessages(session.messages || [])
          if (session.providerId && session.model) {
            setSelectedModel({ providerId: session.providerId, model: session.model })
          }
        }
      })
    }
    return () => {
      isSubscribed = false
    }
  }, [activeSessionId, setSelectedModel])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior,
      })
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior })
    }
  }, [])

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 120
  }, [])

  const messageCount = messages.length
  useEffect(() => {
    if (messageCount > 0) {
      isAtBottomRef.current = true
      requestAnimationFrame(() => {
        scrollToBottom("smooth")
      })
    }
  }, [messageCount, scrollToBottom])

  const lastMessageContent = messages[messages.length - 1]?.content
  useEffect(() => {
    if (isStreaming && isAtBottomRef.current && lastMessageContent !== undefined) {
      scrollToBottom("auto")
    }
  }, [isStreaming, lastMessageContent, scrollToBottom])

  useEffect(() => {
    if (isTranslating && isAtBottomRef.current) {
      scrollToBottom("smooth")
    }
  }, [isTranslating, scrollToBottom])

  const handleSelectModel = useCallback(
    async (providerId: string, model: string) => {
      const next: SelectedModelConfig = { providerId, model }
      setSelectedModel(next)
      await setLocalSelectedChatModel(next)
      if (activeSessionId) {
        await db.chatSession.update(activeSessionId, {
          providerId,
          model,
          updatedAt: getTimestamp(),
        })
      }
    },
    [activeSessionId, setSelectedModel],
  )

  const handleNewChat = useCallback(async () => {
    if (isStreaming && abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsStreaming(false)
    }
    loadedSessionIdRef.current = null
    setActiveSessionId(null)
    setMessages([])
    setInput("")
    const savedModel = await getLocalSelectedChatModel()
    setSelectedModel(savedModel)
  }, [isStreaming, setActiveSessionId, setSelectedModel])

  const handleCopy = async (text: string, idx: number) => {
    await navigator.clipboard.writeText(text)
    setCopiedIndex(idx)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const handleUpworkCoverLetter = async () => {
    if (isStreaming) return
    await handleSend(UPWORK_QUICK_PROMPT_COVER_LETTER)
  }

  const handleFillCoverLetter = async (content: string, idx: number) => {
    if (!activeTab?.id) return
    const res = await fillUpworkCoverLetter(
      activeTab.id,
      upworkConfig.coverLetterInputSelector,
      content,
    )
    if (res.success) {
      setFillStatusIndex({
        index: idx,
        text: i18n.t("options.upwork.sidepanel.filledSuccess"),
      })
      setTimeout(() => setFillStatusIndex(null), 2500)
    } else {
      await navigator.clipboard.writeText(content)
      setFillStatusIndex({
        index: idx,
        text: i18n.t("options.upwork.sidepanel.copiedSuccess"),
      })
      setTimeout(() => setFillStatusIndex(null), 2500)
    }
  }

  const handleToggleResponseTranslation = async (msg: ChatMessageItem) => {
    if (showTranslatedResponseMap[msg.id]) {
      setShowTranslatedResponseMap((prev) => ({ ...prev, [msg.id]: false }))
      return
    }

    if (msg.translatedContent) {
      setShowTranslatedResponseMap((prev) => ({ ...prev, [msg.id]: true }))
      return
    }

    setTranslatingMsgId(msg.id)
    try {
      const targetLang = upworkConfig.translateLang || "en"
      const destLang = targetLang === "vi" ? "en" : "vi"

      const translated = await translateTextWithProvider(
        msg.content,
        destLang,
        upworkConfig.translateProviderId,
        providersConfig,
      )

      if (translated && translated !== msg.content) {
        msg.translatedContent = translated
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, translatedContent: translated } : m)),
        )

        if (activeSessionId) {
          const session = await db.chatSession.get(activeSessionId)
          if (session) {
            const updated = session.messages.map((m) =>
              m.id === msg.id ? { ...m, translatedContent: translated } : m,
            )
            await db.chatSession.update(activeSessionId, { messages: updated })
          }
        }
      }
      setShowTranslatedResponseMap((prev) => ({ ...prev, [msg.id]: true }))
    } catch (err) {
      log.warn("Failed to translate assistant response", { error: err })
    } finally {
      setTranslatingMsgId(null)
    }
  }

  const handleSend = async (customPrompt?: string, customSystemPrompt?: string) => {
    let rawText = (customPrompt || input).trim()
    if (!rawText || isStreaming || isTranslating) return

    setInput("")

    const isBaseQuickPrompt = QUICK_PROMPTS.includes(rawText)
    const isUpworkCoverLetter = rawText === UPWORK_QUICK_PROMPT_COVER_LETTER
    const isUpworkAnalyze = rawText === UPWORK_QUICK_PROMPT_ANALYZE_JOB
    const isQuickPrompt = isBaseQuickPrompt || isUpworkCoverLetter || isUpworkAnalyze

    // Ensure we have fresh tab content for quick prompts or when context is needed
    let tab = activeTab
    if (isQuickPrompt || !tab?.pageText) {
      const freshTab = await getActiveTabContent(true)
      if (freshTab) {
        tab = freshTab
        setActiveTab(freshTab)
      }
    }

    const isRestricted = !tab?.url || isRestrictedUrl(tab.url)

    // If user clicks a quick prompt to summarize this page, but there's only restricted/settings pages
    if (isQuickPrompt && isRestricted) {
      let currentId = activeSessionId
      if (!currentId) {
        currentId = crypto.randomUUID()
        loadedSessionIdRef.current = currentId
        setActiveSessionId(currentId)
      }

      const userMsg: ChatMessageItem = {
        id: crypto.randomUUID(),
        role: "user",
        content: rawText,
        createdAt: getTimestamp(),
      }
      const assistantMsg: ChatMessageItem = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `⚠️ Không thể lấy nội dung từ trang cài đặt extension hoặc trang nội bộ trình duyệt (${tab?.url || "chrome://"}). Vui lòng mở hoặc chuyển sang một trang web thông thường (http/https) để sử dụng tính năng tóm tắt này.`,
        createdAt: getTimestamp(),
      }
      const finalMsgs = [...messages, userMsg, assistantMsg]
      setMessages(finalMsgs)

      if (currentId) {
        await db.chatSession.put({
          id: currentId,
          title: rawText.slice(0, 35),
          providerId: selectedModel.providerId,
          model: selectedModel.model,
          messages: finalMsgs,
          createdAt: getTimestamp(),
          updatedAt: getTimestamp(),
        })
      }
      return
    }

    let systemInstruction = customSystemPrompt
    let originalText: string | undefined

    const targetLang = upworkConfig.translateLang || "en"
    const providerId = upworkConfig.translateProviderId

    if (isUpworkCoverLetter && tab?.id) {
      const extracted = await extractUpworkJobData(tab.id, {
        jobDetailsSelector: upworkConfig.jobDetailsSelector,
        screeningQuestionsSelector: upworkConfig.screeningQuestionsSelector,
      })

      let finalDescription = extracted.description || tab.pageText || ""
      let finalQuestions = extracted.screeningQuestions || []

      // Build untranslated prompt as original reference
      const originalBuilt = buildUpworkCoverLetterPrompt(
        { ...upworkConfig, translateLang: "original" },
        {
          title: extracted.title || tab.title,
          url: tab.url,
          description: finalDescription,
          screeningQuestions: finalQuestions,
          pageTextFallback: tab.pageText,
        },
      )
      originalText = originalBuilt.userPrompt

      if (targetLang && targetLang !== "original") {
        setIsTranslating(true)
        try {
          if (finalDescription) {
            finalDescription = await translateTextWithProvider(
              finalDescription,
              targetLang,
              providerId,
              providersConfig,
            )
          }
          if (finalQuestions.length > 0) {
            finalQuestions = await Promise.all(
              finalQuestions.map((q) =>
                translateTextWithProvider(q, targetLang, providerId, providersConfig),
              ),
            )
          }
        } finally {
          setIsTranslating(false)
        }
      }

      const built = buildUpworkCoverLetterPrompt(upworkConfig, {
        title: extracted.title || tab.title,
        url: tab.url,
        description: finalDescription,
        screeningQuestions: finalQuestions,
        pageTextFallback: tab.pageText,
      })
      rawText = built.userPrompt
      systemInstruction = built.systemPrompt
    } else if (isUpworkAnalyze && tab?.id) {
      const extracted = await extractUpworkJobData(tab.id, {
        jobDetailsSelector: upworkConfig.jobDetailsSelector,
        screeningQuestionsSelector: upworkConfig.screeningQuestionsSelector,
      })
      let jobDesc = extracted.description || tab.pageText || "Xem nội dung trang"
      originalText = `Hãy phân tích chi tiết yêu cầu, kỹ năng cần thiết và các rủi ro cần lưu ý của công việc Upwork sau:\n\nTIÊU ĐỀ: ${extracted.title || tab.title}\nURL: ${tab.url || ""}\n\nMÔ TẢ CÔNG VIỆC:\n${jobDesc}`

      if (targetLang && targetLang !== "original") {
        setIsTranslating(true)
        try {
          jobDesc = await translateTextWithProvider(
            jobDesc,
            targetLang,
            providerId,
            providersConfig,
          )
        } finally {
          setIsTranslating(false)
        }
      }

      rawText = `Hãy phân tích chi tiết yêu cầu, kỹ năng cần thiết và các rủi ro cần lưu ý của công việc Upwork sau:\n\nTIÊU ĐỀ: ${extracted.title || tab.title}\nURL: ${tab.url || ""}\n\nMÔ TẢ CÔNG VIỆC:\n${jobDesc}`
    } else if (isUpworkJob && targetLang && targetLang !== "original") {
      setIsTranslating(true)
      try {
        const translatedPrompt = await translateTextWithProvider(
          rawText,
          targetLang,
          providerId,
          providersConfig,
        )
        if (translatedPrompt && translatedPrompt !== rawText) {
          originalText = rawText
          rawText = translatedPrompt
        }
      } finally {
        setIsTranslating(false)
      }
    }

    if (isQuickPrompt && tab?.url && !isRestricted) {
      setUsePageContext(true)
    }

    // Attach target page info to user prompt if it's a base quick action
    const textToSend =
      isBaseQuickPrompt && tab?.url && !isRestricted
        ? `${rawText}\n\n*Nguồn: [${tab.title || tab.url}](${tab.url})*`
        : rawText

    const userMessage: ChatMessageItem = {
      id: crypto.randomUUID(),
      role: "user",
      content: textToSend,
      originalContent: originalText && originalText !== textToSend ? originalText : undefined,
      createdAt: getTimestamp(),
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)

    const sessionTitle = isUpworkCoverLetter
      ? "Upwork Cover Letter"
      : isUpworkAnalyze
        ? "Phân tích Job Upwork"
        : rawText.slice(0, 35)

    // Prepare session in Dexie
    let currentId = activeSessionId
    if (!currentId) {
      currentId = crypto.randomUUID()
      loadedSessionIdRef.current = currentId
      setActiveSessionId(currentId)
      await db.chatSession.add({
        id: currentId,
        title: sessionTitle,
        providerId: selectedModel.providerId,
        model: selectedModel.model,
        messages: updatedMessages,
        createdAt: getTimestamp(),
        updatedAt: getTimestamp(),
      })
    } else {
      await db.chatSession.update(currentId, {
        providerId: selectedModel.providerId,
        model: selectedModel.model,
        messages: updatedMessages,
        updatedAt: getTimestamp(),
      })
    }

    // Assistant placeholder message
    const assistantMessage: ChatMessageItem = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      createdAt: getTimestamp(),
    }
    setMessages([...updatedMessages, assistantMessage])
    setIsStreaming(true)

    // Build LLM messages and system instructions
    const formattedMessages: Array<{ role: string; content: string }> = []

    const shouldIncludeContext =
      (usePageContext || isQuickPrompt) && tab?.url && !isRestrictedUrl(tab.url)

    let instructions: string | undefined = systemInstruction
    if (!instructions && shouldIncludeContext && tab) {
      instructions = `Ngữ cảnh từ trang web người dùng đang xem:
Tiêu đề: ${tab.title || "Không có tiêu đề"}
URL: ${tab.url}
${tab.pageText ? `Nội dung trang:\n${tab.pageText}` : ""}
${tab.selectedText ? `\nĐoạn văn bản bôi đen:\n${tab.selectedText}` : ""}
Hãy thực hiện yêu cầu của người dùng dựa trên nội dung và URL của trang web trên.`
    }

    for (const msg of updatedMessages) {
      if (msg.role === "system") {
        instructions = instructions ? `${instructions}\n\n${msg.content}` : msg.content
      } else {
        formattedMessages.push({
          role: msg.role,
          content: msg.content,
        })
      }
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    const isUpworkTask = isUpworkCoverLetter || isUpworkAnalyze
    const upworkCustomProvider =
      isUpworkTask && upworkConfig.providerId
        ? llmProviders.find((p) => p.id === upworkConfig.providerId)
        : null

    const matchedProvider =
      upworkCustomProvider || llmProviders.find((p) => p.id === selectedModel.providerId)
    const targetProviderId = matchedProvider?.id || selectedModel.providerId

    const effectiveProviderConfig =
      matchedProvider && isLLMProviderConfig(matchedProvider)
        ? ({
            ...matchedProvider,
            model:
              typeof matchedProvider.model === "object"
                ? {
                    ...matchedProvider.model,
                    model: selectedModel.model || matchedProvider.model.model,
                    customModel:
                      matchedProvider.model.customModel !== null &&
                      selectedModel.model !== matchedProvider.model.model
                        ? selectedModel.model
                        : matchedProvider.model.customModel,
                  }
                : selectedModel.model || matchedProvider.model,
          } as LLMProviderConfig)
        : undefined

    let accumulatedText = ""

    try {
      await streamBackgroundText(
        {
          providerKind: "local",
          providerId: targetProviderId,
          providerConfig: effectiveProviderConfig,
          instructions,
          messages: formattedMessages,
          temperature: 0.7,
          sourceFeature: isUpworkTask ? "Upwork Assistant" : "Sidepanel Chat",
          url: activeTab?.url,
        },
        {
          signal: controller.signal,
          onChunk: (snapshot: BackgroundTextStreamSnapshot) => {
            const chunk = snapshot.output || ""
            accumulatedText = chunk
            setMessages((prev) => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last?.role === "assistant") {
                next[next.length - 1] = { ...last, content: chunk }
              } else {
                next.push({
                  id: assistantMessage.id,
                  role: "assistant",
                  content: chunk,
                  createdAt: assistantMessage.createdAt,
                })
              }
              return next
            })
          },
        },
      )
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") {
        console.info("Chat generation stopped by user")
      } else {
        const rawErrMessage =
          (err as Error)?.message || "Lỗi kết nối AI Provider. Vui lòng kiểm tra API Key."
        const formattedErr = `*(Lỗi: ${rawErrMessage})*`
        accumulatedText = accumulatedText ? `${accumulatedText}\n\n${formattedErr}` : formattedErr
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last?.role === "assistant") {
            next[next.length - 1] = { ...last, content: accumulatedText }
          } else {
            next.push({
              id: assistantMessage.id,
              role: "assistant",
              content: accumulatedText,
              createdAt: assistantMessage.createdAt,
            })
          }
          return next
        })
      }
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null

      // Final save to Dexie and state sync
      const finalContent = accumulatedText || "Không nhận được phản hồi."
      const finalAssistant: ChatMessageItem = {
        ...assistantMessage,
        content: finalContent,
      }
      const finalMessages = [...updatedMessages, finalAssistant]

      setMessages((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last?.role === "assistant") {
          next[next.length - 1] = { ...last, content: finalContent }
          return next
        }
        return finalMessages
      })

      if (currentId) {
        await db.chatSession.update(currentId, {
          messages: finalMessages,
          updatedAt: getTimestamp(),
        })
      }
    }
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setIsStreaming(false)
    setIsTranslating(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInput(value)

    if (value.startsWith("/")) {
      setIsSlashOpen(true)
      setSlashQuery(value.slice(1))
      setSelectedActionIndex(0)
    } else {
      setIsSlashOpen(false)
      setSlashQuery("")
    }
  }

  const handleSelectAction = useCallback((action: CustomAIAction) => {
    setIsSlashOpen(false)
    setSlashQuery("")
    setInput(action.prompt)

    // Move cursor to end of prompt
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        const len = action.prompt.length
        textareaRef.current.setSelectionRange(len, len)
      }
    }, 0)
  }, [])

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
      void handleSend()
    }
  }

  return (
    <div className="relative flex h-full w-full min-w-0 flex-col overflow-x-hidden bg-background text-foreground">
      {/* Top Header */}
      <header className="flex h-12 w-full min-w-0 items-center justify-between border-b border-border/60 px-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-foreground/90 transition-colors hover:bg-muted">
            <Sparkles className="size-3.5 text-primary" />
            <span className="max-w-[120px] truncate">{selectedModel.model || "Select Model"}</span>
            <ChevronDown className="size-3 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 text-xs">
            {llmProviders.length === 0 ? (
              <div className="p-2 text-center text-muted-foreground">
                Chưa có provider. Nhấn nút Settings ở cột trái để thêm API Key.
              </div>
            ) : (
              llmProviders.map((p) => {
                const modelName = isLLMProviderConfig(p)
                  ? typeof p.model === "string"
                    ? p.model
                    : p.model.customModel || p.model.model
                  : p.id
                return (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => void handleSelectModel(p.id, modelName)}
                    className="flex items-center justify-between"
                  >
                    <span className="truncate font-medium">{p.name || p.id}</span>
                    <span className="text-[10px] text-muted-foreground">{modelName}</span>
                  </DropdownMenuItem>
                )
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-1">
          {/* Translation Config Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors hover:bg-muted",
                upworkConfig.translateLang && upworkConfig.translateLang !== "original"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "text-muted-foreground",
              )}
              title={i18n.t("options.upwork.parametersSection.translateLangTitle")}
            >
              <Languages className="size-3.5" />
              <span className="text-[11px] font-medium uppercase">
                {upworkConfig.translateLang || "en"}
              </span>
              <ChevronDown className="size-2.5 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1 text-xs">
              <div className="px-2 py-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                {i18n.t("options.upwork.sidepanel.translateTo")}
              </div>
              {UPWORK_TRANSLATE_LANGUAGES.map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  onClick={() =>
                    void setUpworkConfig({ ...upworkConfig, translateLang: lang.code })
                  }
                  className="flex items-center justify-between py-1 text-xs"
                >
                  <span>{lang.name}</span>
                  {upworkConfig.translateLang === lang.code && (
                    <Check className="size-3 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}

              <div className="my-1 border-t border-border/40" />

              <div className="px-2 py-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                {i18n.t("options.upwork.parametersSection.translateProviderTitle")}
              </div>
              <DropdownMenuItem
                onClick={() => void setUpworkConfig({ ...upworkConfig, translateProviderId: "" })}
                className="flex items-center justify-between py-1 text-xs"
              >
                <span>{i18n.t("options.upwork.parametersSection.translateProviderAuto")}</span>
                {!upworkConfig.translateProviderId && <Check className="size-3 text-primary" />}
              </DropdownMenuItem>
              {translationProviders.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() =>
                    void setUpworkConfig({ ...upworkConfig, translateProviderId: p.id })
                  }
                  className="flex items-center justify-between py-1 text-xs"
                >
                  <span className="truncate">{p.name || p.id}</span>
                  {upworkConfig.translateProviderId === p.id && (
                    <Check className="size-3 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="icon"
            variant="ghost"
            className="size-7.5"
            onClick={() => setIsHistoryOpen(true)}
            title="Chat History"
          >
            <History className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7.5"
            onClick={handleNewChat}
            title="New Chat"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </header>

      {/* Messages Scroll View */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-3"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold tracking-tight">Workmate AI Assistant</h3>
              <p className="max-w-[240px] text-xs text-muted-foreground">
                Đặt câu hỏi, tóm tắt bài viết hoặc dịch thuật với các mô hình AI thông minh.
              </p>
            </div>

            {/* Quick prompt suggestions */}
            <div className="grid w-full grid-cols-1 gap-2 pt-2 text-left">
              {isUpworkJob && (
                <>
                  <button
                    type="button"
                    onClick={() => void handleSend(UPWORK_QUICK_PROMPT_COVER_LETTER)}
                    className="flex items-center gap-2 rounded-lg border border-emerald-600/40 bg-emerald-500/10 p-2.5 text-xs font-medium text-emerald-800 transition-all hover:border-emerald-600/60 hover:bg-emerald-500/20 dark:text-emerald-300"
                  >
                    <Icon
                      icon="tabler:briefcase"
                      className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                    />
                    <span>{UPWORK_QUICK_PROMPT_COVER_LETTER}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSend(UPWORK_QUICK_PROMPT_ANALYZE_JOB)}
                    className="flex items-center gap-2 rounded-lg border border-emerald-600/30 bg-emerald-500/5 p-2.5 text-xs text-emerald-700 transition-all hover:border-emerald-600/50 hover:bg-emerald-500/15 dark:text-emerald-400"
                  >
                    <Icon
                      icon="tabler:file-search"
                      className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                    />
                    <span>{UPWORK_QUICK_PROMPT_ANALYZE_JOB}</span>
                  </button>
                </>
              )}
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  type="button"
                  key={prompt}
                  onClick={() => void handleSend(prompt)}
                  className="rounded-lg border border-border/60 bg-muted/30 p-2.5 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:bg-muted/70 hover:text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, idx) => {
              const isUser = msg.role === "user"
              const displayedUserContent =
                showOriginalMap[msg.id] && msg.originalContent ? msg.originalContent : msg.content
              return (
                <div
                  key={msg.id || idx}
                  className={cn(
                    "flex w-full min-w-0 flex-col gap-1",
                    isUser ? "items-end" : "items-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[88%] min-w-0 rounded-xl px-3 py-2 text-xs leading-relaxed [overflow-wrap:anywhere] break-words",
                      isUser
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "border border-border/50 bg-muted/40 text-foreground",
                    )}
                  >
                    {isUser ? (
                      <div className="group/user-msg flex min-w-0 flex-col gap-1.5">
                        <p className="[overflow-wrap:anywhere] break-words whitespace-pre-wrap">
                          {displayedUserContent}
                        </p>
                        <div
                          className={cn(
                            "flex items-center justify-end gap-2 pt-1 transition-opacity",
                            msg.originalContent
                              ? "border-t border-primary-foreground/20"
                              : "opacity-70 group-hover/user-msg:opacity-100 hover:opacity-100",
                          )}
                        >
                          {msg.originalContent && (
                            <button
                              type="button"
                              onClick={() =>
                                setShowOriginalMap((prev) => ({
                                  ...prev,
                                  [msg.id]: !prev[msg.id],
                                }))
                              }
                              className="flex cursor-pointer items-center gap-1 text-[10px] text-primary-foreground/85 underline decoration-dotted underline-offset-2 hover:text-primary-foreground"
                            >
                              <Languages className="size-3 shrink-0" />
                              <span className="truncate">
                                {showOriginalMap[msg.id]
                                  ? i18n.t("options.upwork.sidepanel.viewTranslated")
                                  : i18n.t("options.upwork.sidepanel.viewOriginal")}
                              </span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleCopy(displayedUserContent, idx)}
                            className="flex cursor-pointer items-center gap-1 text-[10px] text-primary-foreground/85 hover:text-primary-foreground"
                            title="Copy"
                          >
                            {copiedIndex === idx ? (
                              <Check className="size-3 text-emerald-300" />
                            ) : (
                              <Copy className="size-3 shrink-0" />
                            )}
                            <span>{copiedIndex === idx ? "Đã copy" : "Copy"}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="group/msg relative max-w-full min-w-0 [overflow-wrap:anywhere] break-words">
                        {msg.content ? (
                          <MarkdownRenderer
                            content={
                              showTranslatedResponseMap[msg.id] && msg.translatedContent
                                ? msg.translatedContent
                                : msg.content
                            }
                            className="max-w-full min-w-0 [overflow-wrap:anywhere] break-words"
                          />
                        ) : isStreaming && idx === messages.length - 1 ? (
                          <div className="flex items-center gap-1.5 py-1 text-muted-foreground">
                            <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                            <span className="size-1.5 animate-pulse rounded-full bg-primary [animation-delay:200ms]" />
                            <span className="size-1.5 animate-pulse rounded-full bg-primary [animation-delay:400ms]" />
                            <span className="ml-1 text-[11px]">Đang suy nghĩ...</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">
                            Không có phản hồi
                          </span>
                        )}
                        {msg.content && (
                          <div className="mt-2 flex items-center justify-end gap-1 pt-1 opacity-70 transition-opacity group-hover/msg:opacity-100 hover:opacity-100">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                              disabled={translatingMsgId === msg.id}
                              onClick={() => void handleToggleResponseTranslation(msg)}
                              title={
                                showTranslatedResponseMap[msg.id]
                                  ? i18n.t("options.upwork.sidepanel.viewOriginal")
                                  : i18n.t("options.upwork.sidepanel.viewTranslated")
                              }
                            >
                              <Languages
                                className={cn(
                                  "size-3",
                                  translatingMsgId === msg.id && "animate-spin text-primary",
                                )}
                              />
                              <span>
                                {translatingMsgId === msg.id
                                  ? i18n.t("options.upwork.sidepanel.translating")
                                  : showTranslatedResponseMap[msg.id]
                                    ? i18n.t("options.upwork.sidepanel.viewOriginal")
                                    : i18n.t("options.upwork.sidepanel.viewTranslated")}
                              </span>
                            </Button>
                            {isUpworkJob && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 gap-1 px-1.5 text-[11px] text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-800 dark:text-emerald-400"
                                onClick={() => void handleFillCoverLetter(msg.content, idx)}
                                title={i18n.t("options.upwork.sidepanel.fillIntoUpwork")}
                              >
                                <Icon
                                  icon="tabler:arrow-down-to-arc"
                                  className="size-3 text-emerald-600 dark:text-emerald-400"
                                />
                                <span>
                                  {fillStatusIndex?.index === idx
                                    ? fillStatusIndex.text
                                    : i18n.t("options.upwork.sidepanel.fillIntoUpwork")}
                                </span>
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-6 text-muted-foreground hover:text-foreground"
                              onClick={() =>
                                void handleCopy(
                                  showTranslatedResponseMap[msg.id] && msg.translatedContent
                                    ? msg.translatedContent
                                    : msg.content,
                                  idx,
                                )
                              }
                            >
                              {copiedIndex === idx ? (
                                <Check className="size-3 text-emerald-500" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {isTranslating && (
              <div className="flex items-center gap-1.5 py-1 text-muted-foreground">
                <Languages className="size-3.5 animate-pulse text-primary" />
                <span className="text-[11px]">
                  {i18n.t("options.upwork.sidepanel.translating")}
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Page Context Badge */}
      {activeTab?.title && (
        <div className="flex w-full min-w-0 items-center justify-between border-t border-border/40 bg-muted/20 px-3 py-1.5 text-[11px]">
          <div className="mr-2 flex min-w-0 flex-1 items-center gap-1.5">
            <Globe className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate text-muted-foreground" title={activeTab.url}>
              {activeTab.title}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!isRestrictedUrl(activeTab.url)) {
                setUsePageContext(!usePageContext)
              }
            }}
            disabled={isRestrictedUrl(activeTab.url)}
            className="shrink-0 cursor-pointer disabled:cursor-not-allowed"
          >
            <Badge
              variant={usePageContext && !isRestrictedUrl(activeTab.url) ? "default" : "outline"}
              className={cn(
                "h-5 text-[10px] transition-colors",
                isRestrictedUrl(activeTab.url)
                  ? "border-dashed text-muted-foreground opacity-60"
                  : usePageContext
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground",
              )}
            >
              {isRestrictedUrl(activeTab.url)
                ? "Trang nội bộ"
                : usePageContext
                  ? "Tab Context: On"
                  : "Tab Context: Off"}
            </Badge>
          </button>
        </div>
      )}

      {/* Upwork Job Quick Action Bar */}
      {isUpworkJob && (
        <div className="flex w-full min-w-0 items-center justify-between gap-2 border-t border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-900 dark:text-emerald-200">
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="flex min-w-0 items-center gap-1 font-medium">
              <Icon
                icon="tabler:briefcase"
                className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
              />
              <span className="max-w-[85px] truncate sm:max-w-none">
                {i18n.t("options.upwork.sidepanel.quickActionLabel")}
              </span>
            </div>

            {/* Translation Language & Provider Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex h-5.5 items-center gap-1 rounded-md border border-emerald-600/30 bg-background/80 px-1.5 text-[11px] font-medium text-foreground hover:bg-background"
                title={i18n.t("options.upwork.parametersSection.translateLangTitle")}
              >
                <Languages className="size-3 text-emerald-600 dark:text-emerald-400" />
                <span className="max-w-[70px] truncate text-[10px] font-semibold uppercase">
                  {upworkConfig.translateLang || "en"}
                </span>
                <ChevronDown className="size-2.5 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 p-1 text-xs">
                <div className="px-2 py-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {i18n.t("options.upwork.sidepanel.translateTo")}
                </div>
                {UPWORK_TRANSLATE_LANGUAGES.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() =>
                      void setUpworkConfig({ ...upworkConfig, translateLang: lang.code })
                    }
                    className="flex items-center justify-between py-1 text-xs"
                  >
                    <span>{lang.name}</span>
                    {upworkConfig.translateLang === lang.code && (
                      <Check className="size-3 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}

                <div className="my-1 border-t border-border/40" />

                <div className="px-2 py-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {i18n.t("options.upwork.parametersSection.translateProviderTitle")}
                </div>
                <DropdownMenuItem
                  onClick={() => void setUpworkConfig({ ...upworkConfig, translateProviderId: "" })}
                  className="flex items-center justify-between py-1 text-xs"
                >
                  <span>{i18n.t("options.upwork.parametersSection.translateProviderAuto")}</span>
                  {!upworkConfig.translateProviderId && <Check className="size-3 text-primary" />}
                </DropdownMenuItem>
                {translationProviders.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() =>
                      void setUpworkConfig({ ...upworkConfig, translateProviderId: p.id })
                    }
                    className="flex items-center justify-between py-1 text-xs"
                  >
                    <span className="truncate">{p.name || p.id}</span>
                    {upworkConfig.translateProviderId === p.id && (
                      <Check className="size-3 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-6 shrink-0 gap-1 border-emerald-600/30 bg-emerald-600/15 px-2 text-[11px] font-medium text-emerald-700 hover:bg-emerald-600/25 dark:text-emerald-300"
            disabled={isStreaming || isTranslating}
            onClick={() => void handleUpworkCoverLetter()}
          >
            <Sparkles className="size-3 text-emerald-600 dark:text-emerald-400" />
            <span>{i18n.t("options.upwork.sidepanel.coverLetter")}</span>
          </Button>
        </div>
      )}

      {/* Input Box */}
      <div
        ref={inputContainerRef}
        className="relative w-full min-w-0 border-t border-border/60 bg-background p-3"
      >
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

        <div className="relative flex w-full min-w-0 flex-col rounded-xl border border-border/80 bg-muted/20 p-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Hỏi bất kỳ điều gì, hoặc gõ '/' để chọn Custom AI Actions... (Enter để gửi)"
            rows={2}
            className="max-h-32 min-h-[44px] w-full resize-none border-0 bg-transparent p-1 text-xs shadow-none focus-visible:ring-0"
          />
          <div className="flex w-full min-w-0 items-center justify-between gap-1 pt-1">
            <span className="flex min-w-0 items-center gap-1 truncate text-[10px] text-muted-foreground/70">
              <span>Gõ</span>
              <kbd className="shrink-0 rounded border border-border/50 bg-muted px-1 font-mono text-[9px]">
                /
              </kbd>
              <span className="truncate">để chọn Custom AI Actions</span>
            </span>
            {isStreaming || isTranslating ? (
              <Button
                size="sm"
                variant="destructive"
                className="h-7 gap-1 px-2 text-xs"
                onClick={handleStop}
              >
                <Square className="size-3" />
                Dừng
              </Button>
            ) : (
              <Button
                size="icon"
                disabled={!input.trim()}
                className="size-7 rounded-lg"
                onClick={() => void handleSend()}
              >
                <Send className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* History Drawer Modal */}
      <ChatHistoryDrawer
        isOpen={isHistoryVisible}
        currentSessionId={activeSessionId}
        onClose={handleCloseHistory}
        onSelectSession={(id) => setActiveSessionId(id)}
        onNewChat={handleNewChat}
      />
    </div>
  )
}
