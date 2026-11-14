import type { WebChatAutoReplyMode, WebChatTone } from "@/types/config/web-chat"
import type { ChatMessage, ChatRoom } from "@/utils/web-chat/adapter/types"
import { useAtomValue } from "jotai"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { createLogger } from "@/utils/logging/logger"
import { getSelectableProvidersForCapability } from "@/utils/providers/provider-registry"
import { getActiveTabInfo } from "@/utils/sidepanel/page-context"
import { getActiveChatMessagesFromTab, insertTextToActiveChatTab } from "@/utils/sidepanel/web-chat"
import {
  generateSmartReply,
  summarizeChatRoom,
  translateChatText,
} from "@/utils/web-chat/ai/service"
import { ActionChips, type WebChatActionType } from "./ActionChips"
import { ChatContextHeader } from "./ChatContextHeader"
import { ResultStream } from "./ResultStream"

interface RoomCacheData {
  messages: ChatMessage[]
  lastResult?: string
  lastSecondaryResult?: string
  activeAction?: WebChatActionType
}

const log = createLogger("sidepanel:web-chat-view")

export function WebChatView() {
  const webChatConfig = useAtomValue(configFieldsAtomMap.webChat)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

  const llmProviders = useMemo(
    () => getSelectableProvidersForCapability("webChat", providersConfig),
    [providersConfig],
  )

  // Session overrides (scoped to sidepanel session)
  const [sessionModel, setSessionModel] = useState<string | null>(null)
  const [sessionLang, setSessionLang] = useState<string | null>(null)
  const [sessionTone, setSessionTone] = useState<WebChatTone | null>(null)
  const [autoReplyMode, setAutoReplyMode] = useState<WebChatAutoReplyMode>("none")
  const [isAutoReplying, setIsAutoReplying] = useState(false)
  const lastRepliedMessageIdRef = useRef<string | null>(null)

  const effectiveModel = sessionModel ?? webChatConfig?.providerId ?? ""
  const effectiveLang = sessionLang ?? webChatConfig?.outboundTargetLang ?? "vi"
  const effectiveTone: WebChatTone = sessionTone ?? webChatConfig?.tone ?? "friendly"
  const isOverridden =
    sessionModel !== null ||
    sessionLang !== null ||
    sessionTone !== null ||
    autoReplyMode !== "none"

  const handleResetDefaults = () => {
    setSessionModel(null)
    setSessionLang(null)
    setSessionTone(null)
    setAutoReplyMode("none")
  }

  const handleSelectAutoReplyMode = (mode: WebChatAutoReplyMode) => {
    setAutoReplyMode(mode)
    if (mode !== "none") {
      const lastMsg = messages[messages.length - 1]
      if (lastMsg?.id) {
        lastRepliedMessageIdRef.current = lastMsg.id
      }
    }
  }

  const [currentTabId, setCurrentTabId] = useState<number | null>(null)
  const [currentTabUrl, setCurrentTabUrl] = useState<string | undefined>()
  const [room, setRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [activeAction, setActiveAction] = useState<WebChatActionType | null>(null)
  const [resultContent, setResultContent] = useState<string>("")
  const [secondaryResult, setSecondaryResult] = useState<string | undefined>()

  // Room cache: Map<roomId, RoomCacheData>
  const roomCacheRef = useRef<Map<string, RoomCacheData>>(new Map())

  const loadActiveChat = useCallback(
    async (forceRefresh = false) => {
      setLoading(true)
      try {
        const tabInfo = await getActiveTabInfo(true)
        if (!tabInfo?.id) {
          setLoading(false)
          return
        }

        setCurrentTabId(tabInfo.id)
        setCurrentTabUrl(tabInfo.url)
        const data = await getActiveChatMessagesFromTab(tabInfo.id)
        const currentRoom = data.room
        setRoom(currentRoom)
        setMessages(data.messages)

        const roomId = currentRoom?.id || "unknown"
        const cached = roomCacheRef.current.get(roomId)

        if (cached && !forceRefresh) {
          // Restore from cache, do NOT call LLM
          setResultContent(cached.lastResult || "")
          setSecondaryResult(cached.lastSecondaryResult)
          setActiveAction(cached.activeAction || null)
        } else if (forceRefresh || !cached) {
          // Reset results on room switch if not in cache
          if (!cached) {
            setResultContent("")
            setSecondaryResult(undefined)
            setActiveAction(null)
          }
        }
      } finally {
        setLoading(false)
      }
    },
    [
      setCurrentTabId,
      setCurrentTabUrl,
      setRoom,
      setMessages,
      setResultContent,
      setSecondaryResult,
      setActiveAction,
    ],
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadActiveChat(false)
    }, 0)
    return () => clearTimeout(timer)
  }, [loadActiveChat])

  // Periodic Auto Reply checker
  useEffect(() => {
    if (autoReplyMode === "none") {
      return () => {}
    }

    let isSubscribed = true

    const checkAndAutoReply = async () => {
      if (isAutoReplying || !isSubscribed) return
      const tabInfo = await getActiveTabInfo(true)
      if (!tabInfo?.id || !isSubscribed) return

      const data = await getActiveChatMessagesFromTab(tabInfo.id)
      const msgs = data.messages
      if (!msgs || msgs.length === 0 || !isSubscribed) return

      const lastMsg = msgs[msgs.length - 1]
      if (
        lastMsg &&
        !lastMsg.isOwn &&
        lastMsg.id &&
        lastMsg.id !== lastRepliedMessageIdRef.current &&
        lastMsg.content.trim().length > 0
      ) {
        lastRepliedMessageIdRef.current = lastMsg.id
        setIsAutoReplying(true)
        try {
          if (data.room) setRoom(data.room)
          setMessages(msgs)

          const res = await generateSmartReply({
            contextMessages: msgs.slice(-5),
            targetLang: effectiveLang,
            tone: effectiveTone,
            rules: webChatConfig?.rules,
            providerId: effectiveModel || undefined,
            sourceFeature: `Web Chat (Auto Reply - ${autoReplyMode})`,
            url: tabInfo.url,
          })

          if (res.replyText && isSubscribed) {
            await insertTextToActiveChatTab(tabInfo.id, res.replyText, {
              autoSend: autoReplyMode === "send",
            })
            setResultContent(res.replyText)
            setSecondaryResult(
              autoReplyMode === "send"
                ? i18n.t("options.webChat.sidepanel.autoReply.statusSent")
                : i18n.t("options.webChat.sidepanel.autoReply.statusDrafted"),
            )
          } else {
            lastRepliedMessageIdRef.current = ""
          }
        } catch (err) {
          log.error("Failed to execute auto reply", { err, lastMsgId: lastMsg.id })
          lastRepliedMessageIdRef.current = ""
          if (isSubscribed) {
            const errStr = (err as Error)?.message || String(err)
            setResultContent(`[Auto Reply Error]: ${errStr}`)
            setSecondaryResult(undefined)
          }
        } finally {
          if (isSubscribed) {
            setIsAutoReplying(false)
          }
        }
      }
    }

    const interval = setInterval(() => {
      void checkAndAutoReply()
    }, 3500)

    return () => {
      isSubscribed = false
      clearInterval(interval)
    }
  }, [
    autoReplyMode,
    isAutoReplying,
    effectiveLang,
    effectiveTone,
    effectiveModel,
    webChatConfig?.rules,
  ])

  const handleActionSelect = async (action: WebChatActionType) => {
    setActiveAction(action)
    setLoading(true)

    const roomId = room?.id || "unknown"

    try {
      if (action === "summary") {
        const res = await summarizeChatRoom(messages, room?.name, {
          rules: webChatConfig?.rules,
          providerId: effectiveModel || undefined,
          sourceFeature: "Web Chat (Summary)",
          url: currentTabUrl,
        })
        let formatted = `${i18n.t("options.webChat.sidepanel.summaryTitle")}\n${res.summary}\n\n`
        if (res.actionItems.length > 0) {
          formatted += `${i18n.t("options.webChat.sidepanel.actionItemsTitle")}\n${res.actionItems.map((a) => `- ${a}`).join("\n")}\n\n`
        }
        setResultContent(formatted)
        setSecondaryResult(undefined)

        roomCacheRef.current.set(roomId, {
          messages,
          lastResult: formatted,
          activeAction: "summary",
        })
      } else if (action === "reply") {
        const res = await generateSmartReply({
          contextMessages: messages.slice(-5),
          targetLang: effectiveLang,
          tone: effectiveTone,
          rules: webChatConfig?.rules,
          providerId: effectiveModel || undefined,
          sourceFeature: "Web Chat (Smart Reply)",
          url: currentTabUrl,
        })

        setResultContent(res.replyText)
        setSecondaryResult(
          res.viGloss
            ? `${i18n.t("options.webChat.floatingMenu.glossPrefix")} ${res.viGloss}`
            : undefined,
        )

        roomCacheRef.current.set(roomId, {
          messages,
          lastResult: res.replyText,
          lastSecondaryResult: res.viGloss
            ? `${i18n.t("options.webChat.floatingMenu.glossPrefix")} ${res.viGloss}`
            : undefined,
          activeAction: "reply",
        })
      } else if (action === "extract") {
        const res = await summarizeChatRoom(messages, room?.name, {
          rules: webChatConfig?.rules,
          providerId: effectiveModel || undefined,
          sourceFeature: "Web Chat (Extract Entities)",
          url: currentTabUrl,
        })
        const entities = res.extractedEntities
        let formatted = `${i18n.t("options.webChat.sidepanel.entitiesTitle")}\n\n`
        if (entities.phones.length > 0) {
          formatted += `${i18n.t("options.webChat.sidepanel.phoneLabel")} ${entities.phones.join(", ")}\n`
        }
        if (entities.bankAccounts.length > 0) {
          formatted += `${i18n.t("options.webChat.sidepanel.bankLabel")} ${entities.bankAccounts.join(", ")}\n`
        }
        if (entities.links.length > 0) {
          formatted += `${i18n.t("options.webChat.sidepanel.linkLabel")} ${entities.links.join(", ")}\n`
        }
        if (entities.dates.length > 0) {
          formatted += `${i18n.t("options.webChat.sidepanel.dateLabel")} ${entities.dates.join(", ")}\n`
        }
        if (
          entities.phones.length === 0 &&
          entities.bankAccounts.length === 0 &&
          entities.links.length === 0 &&
          entities.dates.length === 0
        ) {
          formatted += i18n.t("options.webChat.sidepanel.noEntitiesFound")
        }

        setResultContent(formatted)
        setSecondaryResult(undefined)

        roomCacheRef.current.set(roomId, {
          messages,
          lastResult: formatted,
          activeAction: "extract",
        })
      } else if (action === "translate") {
        const lastMsg = messages[messages.length - 1]
        const textToTranslate = lastMsg?.content || "No message to translate."
        const translated = await translateChatText({
          text: textToTranslate,
          targetLang: effectiveLang,
          rules: webChatConfig?.rules,
          providerId: effectiveModel || undefined,
          sourceFeature: "Web Chat (Translate)",
          url: currentTabUrl,
        })

        setResultContent(translated)
        setSecondaryResult(`Original: "${textToTranslate}"`)

        roomCacheRef.current.set(roomId, {
          messages,
          lastResult: translated,
          lastSecondaryResult: `Original: "${textToTranslate}"`,
          activeAction: "translate",
        })
      }
    } catch {
      setResultContent(i18n.t("options.webChat.sidepanel.errorProcessing"))
    } finally {
      setLoading(false)
    }
  }

  const handleInsertToChat = async (text: string) => {
    if (!currentTabId) return
    await insertTextToActiveChatTab(currentTabId, text)
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <ChatContextHeader
        room={room}
        messageCount={messages.length}
        loading={loading}
        onRefresh={() => void loadActiveChat(true)}
        availableProviders={llmProviders}
        selectedProviderId={effectiveModel}
        onSelectProvider={(id) => setSessionModel(id)}
        selectedLang={effectiveLang}
        onSelectLang={(lang) => setSessionLang(lang)}
        selectedTone={effectiveTone}
        onSelectTone={(tone) => setSessionTone(tone)}
        autoReplyMode={autoReplyMode}
        onSelectAutoReplyMode={handleSelectAutoReplyMode}
        isAutoReplying={isAutoReplying}
        isOverridden={isOverridden}
        onResetDefaults={handleResetDefaults}
      />

      <ActionChips
        loading={loading}
        activeAction={activeAction}
        onSelectAction={(action) => void handleActionSelect(action)}
      />

      <div className="flex-1 overflow-y-auto">
        <ResultStream
          content={resultContent}
          secondaryContent={secondaryResult}
          loading={loading}
          onInsertToChat={(text) => void handleInsertToChat(text)}
        />
      </div>
    </div>
  )
}
