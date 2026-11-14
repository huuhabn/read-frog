import type { BackgroundTextStreamSnapshot } from "@/types/background-stream"
import type { ChatMessageItem } from "@/utils/db/dexie/tables/chat-session"
import { Icon } from "@iconify/react"
import { useAtom, useAtomValue } from "jotai"
import { Check, Copy, Languages, Sparkles } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { browser } from "#imports"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { Button } from "@/components/ui/base-ui/button"
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
} from "@/utils/sidepanel/upwork"
import { cn } from "@/utils/styles/utils"
import { ChatHeader } from "./chat-header"
import { ChatHistoryDrawer } from "./chat-history-drawer"
import { ChatInputBox } from "./chat-input-box"
import { ChatUpworkBar } from "./chat-upwork-bar"

const QUICK_PROMPT_KEYS = [
  "sidePanel.chat.quickPrompts.summarize",
  "sidePanel.chat.quickPrompts.explainTerms",
  "sidePanel.chat.quickPrompts.prosAndCons",
  "sidePanel.chat.quickPrompts.emailSummary",
] as const

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
      void getActiveTabContent(true).then((content) => {
        if (isSubscribed && content) {
          setActiveTab(content)
          if (content.url && !isRestrictedUrl(content.url)) {
            setUsePageContext(true)
          }
        }
      })
    }

    // Defer initial page context extraction so the chat UI finishes initial paint smoothly
    const initialTimer = setTimeout(() => {
      if (isSubscribed) updateTabContent()
    }, 250)

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
        className="w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-3"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold tracking-tight">
                {i18n.t("sidePanel.chat.title")}
              </h3>
              <p className="max-w-[240px] text-xs text-muted-foreground">
                {i18n.t("sidePanel.chat.description")}
              </p>
            </div>

            {/* Quick prompt suggestions */}
            <div className="grid w-full grid-cols-1 gap-2 pt-2 text-left">
              {isUpworkJob && (
                <>
                  <button
                    type="button"
                    onClick={() => void handleSend(UPWORK_QUICK_PROMPT_COVER_LETTER)}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-600/40 bg-emerald-500/10 p-2.5 text-xs font-medium text-emerald-800 transition-all hover:border-emerald-600/60 hover:bg-emerald-500/20 dark:text-emerald-300"
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
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-600/30 bg-emerald-500/5 p-2.5 text-xs text-emerald-700 transition-all hover:border-emerald-600/50 hover:bg-emerald-500/15 dark:text-emerald-400"
                  >
                    <Icon
                      icon="tabler:file-search"
                      className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                    />
                    <span>{UPWORK_QUICK_PROMPT_ANALYZE_JOB}</span>
                  </button>
                </>
              )}
              {QUICK_PROMPT_KEYS.map((key) => {
                const promptText = i18n.t(key)
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => void handleSend(promptText)}
                    className="cursor-pointer rounded-lg border border-border/60 bg-muted/30 p-2.5 text-left text-xs text-muted-foreground transition-all hover:border-primary/40 hover:bg-muted/70 hover:text-foreground"
                  >
                    {promptText}
                  </button>
                )
              })}
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
                            title={i18n.t("sidePanel.chat.copy")}
                          >
                            {copiedIndex === idx ? (
                              <Check className="size-3 text-emerald-300" />
                            ) : (
                              <Copy className="size-3 shrink-0" />
                            )}
                            <span>
                              {copiedIndex === idx
                                ? i18n.t("sidePanel.chat.copied")
                                : i18n.t("sidePanel.chat.copy")}
                            </span>
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
                            <span className="ml-1 text-[11px]">
                              {i18n.t("sidePanel.chat.thinking")}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">
                            {i18n.t("sidePanel.chat.noResponse")}
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
                              title={i18n.t("sidePanel.chat.copy")}
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

      {/* Upwork Job Quick Action Bar */}
      <ChatUpworkBar
        isUpworkJob={isUpworkJob}
        upworkConfig={upworkConfig}
        setUpworkConfig={setUpworkConfig}
        translationProviders={translationProviders}
        onCoverLetter={handleUpworkCoverLetter}
        isStreaming={isStreaming}
        isTranslating={isTranslating}
      />

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
