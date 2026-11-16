import type { BackgroundTextStreamSnapshot } from "@/types/background-stream"
import type { ChatMessageItem as ChatMessageType } from "@/utils/db/dexie/tables/chat-session"
import { useAtom, useAtomValue } from "jotai"
import { Languages } from "lucide-react"
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { browser } from "#imports"
import { isLLMProviderConfig, type LLMProviderConfig } from "@/types/config/provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import {
  activeChatSessionIdAtom,
  includePageContextAtom,
  selectedChatModelAtom,
  sidepanelNavTabAtom,
} from "@/utils/atoms/sidepanel"
import { streamBackgroundText } from "@/utils/content-script/background-stream-client"
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
  getActiveTabInfo,
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
} from "@/utils/sidepanel/upwork"
import { ChatEmptyState, QUICK_PROMPT_KEYS } from "./chat-empty-state"
import { ChatHeader } from "./chat-header"
import { ChatInputBox } from "./chat-input-box"
import { ChatMessageItem } from "./chat-message-item"

const getDb = () => import("@/utils/db/dexie/db").then((m) => m.db)

const ChatHistoryDrawer = lazy(() =>
  import("./chat-history-drawer").then((m) => ({ default: m.ChatHistoryDrawer })),
)

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

  const [messages, setMessages] = useState<ChatMessageType[]>([])
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

  const loadedSessionIdRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)

  // Filter available LLM providers from config
  const llmProviders = providersConfig.filter(
    (p): p is LLMProviderConfig => isLLMProviderConfig(p) && p.enabled,
  )

  // Auto-fallback if the current selected provider is not enabled/configured
  useEffect(() => {
    if (!activeSessionId && llmProviders.length > 0) {
      const isCurrentProviderValid = llmProviders.some((p) => p.id === selectedModel.providerId)
      if (!isCurrentProviderValid) {
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
  }, [activeSessionId, llmProviders, selectedModel.providerId, setSelectedModel])

  // Auto load active tab content and listen to tab changes
  useEffect(() => {
    let isSubscribed = true

    const updateTabContent = () => {
      void getActiveTabInfo(true).then((info) => {
        if (isSubscribed && info) {
          const isRestricted = isRestrictedUrl(info.url)
          setActiveTab({
            id: info.id,
            title: info.title,
            url: info.url,
            isRestricted,
          })
          if (!isRestricted) {
            setUsePageContext(true)
          }
        }
      })
    }

    // Defer initial page context extraction to post-paint frame so initial UI paints instantly
    const initialTimer = setTimeout(() => {
      if (isSubscribed) updateTabContent()
    }, 0)

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
      clearTimeout(initialTimer)
      browser.tabs?.onActivated?.removeListener(handleActivated)
      browser.tabs?.onUpdated?.removeListener(handleUpdated)
    }
  }, [setUsePageContext])

  // Load existing session messages
  useEffect(() => {
    let isSubscribed = true
    if (activeSessionId && loadedSessionIdRef.current !== activeSessionId) {
      void getDb()
        .then((database) => database.chatSession.get(activeSessionId))
        .then((session) => {
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
        const database = await getDb()
        await database.chatSession.update(activeSessionId, {
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

  const handleToggleOriginal = useCallback((msgId: string) => {
    setShowOriginalMap((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }))
  }, [])

  const handleCopy = useCallback(async (text: string, idx: number) => {
    await navigator.clipboard.writeText(text)
    setCopiedIndex(idx)
    setTimeout(() => setCopiedIndex(null), 2000)
  }, [])

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

  const handleToggleResponseTranslation = async (msg: ChatMessageType) => {
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
          const database = await getDb()
          const session = await database.chatSession.get(activeSessionId)
          if (session) {
            const updated = session.messages.map((m) =>
              m.id === msg.id ? { ...m, translatedContent: translated } : m,
            )
            await database.chatSession.update(activeSessionId, { messages: updated })
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

    const isBaseQuickPrompt = QUICK_PROMPT_KEYS.some((key) => i18n.t(key) === rawText)
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

      const userMsg: ChatMessageType = {
        id: crypto.randomUUID(),
        role: "user",
        content: rawText,
        createdAt: getTimestamp(),
      }
      const assistantMsg: ChatMessageType = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `⚠️ Không thể lấy nội dung từ trang cài đặt extension hoặc trang nội bộ trình duyệt (${tab?.url || "chrome://"}). Vui lòng mở hoặc chuyển sang một trang web thông thường (http/https) để sử dụng tính năng tóm tắt này.`,
        createdAt: getTimestamp(),
      }
      const finalMsgs = [...messages, userMsg, assistantMsg]
      setMessages(finalMsgs)

      if (currentId) {
        const database = await getDb()
        await database.chatSession.put({
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

    const userMessage: ChatMessageType = {
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
    const database = await getDb()
    if (!currentId) {
      currentId = crypto.randomUUID()
      loadedSessionIdRef.current = currentId
      setActiveSessionId(currentId)
      await database.chatSession.add({
        id: currentId,
        title: sessionTitle,
        providerId: selectedModel.providerId,
        model: selectedModel.model,
        messages: updatedMessages,
        createdAt: getTimestamp(),
        updatedAt: getTimestamp(),
      })
    } else {
      await database.chatSession.update(currentId, {
        providerId: selectedModel.providerId,
        model: selectedModel.model,
        messages: updatedMessages,
        updatedAt: getTimestamp(),
      })
    }

    // Assistant placeholder message
    const assistantMessage: ChatMessageType = {
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
          automaticRouting: true,
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
      const finalAssistant: ChatMessageType = {
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
        await database.chatSession.update(currentId, {
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

  return (
    <div className="relative flex h-full w-full min-w-0 flex-col overflow-x-hidden bg-background text-foreground">
      {/* Top Header */}
      <ChatHeader
        onNewChat={handleNewChat}
        onOpenHistory={() => setIsHistoryOpen(true)}
        upworkConfig={upworkConfig}
        setUpworkConfig={setUpworkConfig}
        translationProviders={translationProviders}
      />

      {/* Messages Scroll View */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="scrollbar-slim w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-3"
      >
        {messages.length === 0 ? (
          <ChatEmptyState
            isUpworkJob={isUpworkJob}
            onSendPrompt={(prompt) => void handleSend(prompt)}
          />
        ) : (
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <ChatMessageItem
                key={msg.id || idx}
                message={msg}
                index={idx}
                isStreaming={isStreaming}
                isLast={idx === messages.length - 1}
                isCopied={copiedIndex === idx}
                isTranslating={translatingMsgId === msg.id}
                showOriginal={Boolean(showOriginalMap[msg.id])}
                showTranslatedResponse={Boolean(showTranslatedResponseMap[msg.id])}
                isUpworkJob={isUpworkJob}
                fillStatusText={fillStatusIndex?.index === idx ? fillStatusIndex.text : null}
                onCopy={handleCopy}
                onToggleOriginal={handleToggleOriginal}
                onToggleTranslateResponse={handleToggleResponseTranslation}
                onFillCoverLetter={handleFillCoverLetter}
              />
            ))}
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

      {/* Input Box */}
      <ChatInputBox
        input={input}
        setInput={setInput}
        onSend={handleSend}
        onStop={handleStop}
        isStreaming={isStreaming}
        isTranslating={isTranslating}
        selectedModel={selectedModel}
        onSelectModel={handleSelectModel}
        llmProviders={llmProviders}
        usePageContext={usePageContext}
        setUsePageContext={setUsePageContext}
        activeTab={activeTab}
      />

      {/* History Drawer Modal */}
      {isHistoryVisible && (
        <Suspense fallback={null}>
          <ChatHistoryDrawer
            isOpen={isHistoryVisible}
            currentSessionId={activeSessionId}
            onClose={handleCloseHistory}
            onSelectSession={(id) => setActiveSessionId(id)}
            onNewChat={handleNewChat}
          />
        </Suspense>
      )}
    </div>
  )
}
