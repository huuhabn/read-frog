import type { BackgroundTextStreamSnapshot } from "@/types/background-stream"
import type { ChatMessageItem } from "@/utils/db/dexie/tables/chat-session"
import { useAtom, useAtomValue } from "jotai"
import {
  Check,
  ChevronDown,
  Copy,
  Globe,
  History,
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

function getTimestamp(): Date {
  return new Date()
}

export function ChatView() {
  const [activeSessionId, setActiveSessionId] = useAtom(activeChatSessionIdAtom)
  const [selectedModel, setSelectedModel] = useAtom(selectedChatModelAtom)
  const [usePageContext, setUsePageContext] = useAtom(includePageContextAtom)
  const [navTab, setNavTab] = useAtom(sidepanelNavTabAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

  const [messages, setMessages] = useState<ChatMessageItem[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTabContent | null>(null)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

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

  const messageCount = messages.length
  useEffect(() => {
    if (messageCount > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messageCount])

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

  const handleSend = async (customPrompt?: string) => {
    const rawText = (customPrompt || input).trim()
    if (!rawText || isStreaming) return

    setInput("")

    const isQuickPrompt = QUICK_PROMPTS.includes(rawText)

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

    if (isQuickPrompt && tab?.url && !isRestricted) {
      setUsePageContext(true)
    }

    // Attach target page info to user prompt if it's a quick action
    const textToSend =
      isQuickPrompt && tab?.url && !isRestricted
        ? `${rawText}\n\n*Nguồn: [${tab.title || tab.url}](${tab.url})*`
        : rawText

    const userMessage: ChatMessageItem = {
      id: crypto.randomUUID(),
      role: "user",
      content: textToSend,
      createdAt: getTimestamp(),
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)

    // Prepare session in Dexie
    let currentId = activeSessionId
    if (!currentId) {
      currentId = crypto.randomUUID()
      loadedSessionIdRef.current = currentId
      setActiveSessionId(currentId)
      await db.chatSession.add({
        id: currentId,
        title: rawText.slice(0, 35),
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

    let instructions: string | undefined = undefined
    if (shouldIncludeContext && tab) {
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

    const matchedProvider = llmProviders.find((p) => p.id === selectedModel.providerId)
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
          providerId: selectedModel.providerId,
          providerConfig: effectiveProviderConfig,
          instructions,
          messages: formattedMessages,
          temperature: 0.7,
          sourceFeature: "Sidepanel Chat",
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
      setIsStreaming(false)
    }
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
    <div className="relative flex h-full flex-col bg-background text-foreground">
      {/* Top Header */}
      <header className="flex h-12 items-center justify-between border-b border-border/60 px-3">
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
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold tracking-tight">Sider AI Assistant</h3>
              <p className="max-w-[240px] text-xs text-muted-foreground">
                Đặt câu hỏi, tóm tắt bài viết hoặc dịch thuật với các mô hình AI thông minh.
              </p>
            </div>

            {/* Quick prompt suggestions */}
            <div className="grid w-full grid-cols-1 gap-2 pt-2 text-left">
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
              return (
                <div
                  key={msg.id || idx}
                  className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}
                >
                  <div
                    className={cn(
                      "max-w-[88%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                      isUser
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "border border-border/50 bg-muted/40 text-foreground",
                    )}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="group/msg relative">
                        {msg.content ? (
                          <MarkdownRenderer content={msg.content} />
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
                          <div className="mt-2 flex items-center justify-end gap-1 pt-1 opacity-0 transition-opacity group-hover/msg:opacity-100">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-6 text-muted-foreground hover:text-foreground"
                              onClick={() => void handleCopy(msg.content, idx)}
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
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Page Context Badge */}
      {activeTab?.title && (
        <div className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-3 py-1.5 text-[11px]">
          <div className="flex min-w-0 items-center gap-1.5">
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
            className="cursor-pointer disabled:cursor-not-allowed"
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

      {/* Input Box */}
      <div ref={inputContainerRef} className="relative border-t border-border/60 bg-background p-3">
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

        <div className="relative flex flex-col rounded-xl border border-border/80 bg-muted/20 p-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Hỏi bất kỳ điều gì, hoặc gõ '/' để chọn Custom AI Actions... (Enter để gửi)"
            rows={2}
            className="max-h-32 min-h-[44px] resize-none border-0 bg-transparent p-1 text-xs shadow-none focus-visible:ring-0"
          />
          <div className="flex items-center justify-between pt-1">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
              <span>Gõ</span>
              <kbd className="rounded border border-border/50 bg-muted px-1 font-mono text-[9px]">
                /
              </kbd>
              <span>để chọn Custom AI Actions</span>
            </span>
            {isStreaming ? (
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
