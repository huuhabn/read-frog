import type { WebChatAutoReplyMode, WebChatTone } from "@/types/config/web-chat"
import type { ChatMessage, ChatRoom } from "@/utils/web-chat/adapter/types"
import { useAtomValue } from "jotai"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { browser } from "#imports"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { createLogger } from "@/utils/logging/logger"
import { getSelectableProvidersForCapability } from "@/utils/providers/provider-registry"
import { getActiveTabInfo } from "@/utils/sidepanel/page-context"
import {
  getActiveChatMessagesFromTab,
  insertTextToActiveChatTab,
  isSupportedChatUrl,
} from "@/utils/sidepanel/web-chat"
import {
  generateSmartReply,
  summarizeChatRoom,
  translateChatText,
} from "@/utils/web-chat/ai/service"
import {
  clearRoomSettings,
  getRoomSettings,
  saveRoomSettings,
} from "@/utils/web-chat/storage/room-settings"
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

  // Session overrides (scoped per chat room)
  const [sessionModel, setSessionModel] = useState<string | null>(null)
  const [sessionLang, setSessionLang] = useState<string | null>(null)
  const [sessionTone, setSessionTone] = useState<WebChatTone | null>(null)
  const [autoReplyMode, setAutoReplyMode] = useState<WebChatAutoReplyMode>("none")
  const [sublineTranslate, setSublineTranslate] = useState(false)
  const [isAutoReplying, setIsAutoReplying] = useState(false)
  const isAutoReplyingRef = useRef(false)
  const lastRepliedPerRoomRef = useRef<Map<string, string>>(new Map())
  const currentRoomIdRef = useRef<string | null>(null)

  const effectiveModel = sessionModel ?? webChatConfig?.providerId ?? ""
  const effectiveLang = sessionLang ?? webChatConfig?.outboundTargetLang ?? "vi"
  const effectiveTone: WebChatTone = sessionTone ?? webChatConfig?.tone ?? "friendly"
  const isOverridden =
    sessionModel !== null ||
    sessionLang !== null ||
    sessionTone !== null ||
    autoReplyMode !== "none" ||
    sublineTranslate

  const autoReplyModeRef = useRef<WebChatAutoReplyMode>(autoReplyMode)
  const effectiveModelRef = useRef<string>(effectiveModel)
  const effectiveLangRef = useRef<string>(effectiveLang)
  const effectiveToneRef = useRef<WebChatTone>(effectiveTone)

  useEffect(() => {
    autoReplyModeRef.current = autoReplyMode
    effectiveModelRef.current = effectiveModel
    effectiveLangRef.current = effectiveLang
    effectiveToneRef.current = effectiveTone
  }, [autoReplyMode, effectiveModel, effectiveLang, effectiveTone])

  const [currentTabId, setCurrentTabId] = useState<number | null>(null)
  const [currentTabUrl, setCurrentTabUrl] = useState<string | undefined>()
  const [room, setRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [activeAction, setActiveAction] = useState<WebChatActionType | null>(null)
  const [resultContent, setResultContent] = useState<string>("")
  const [secondaryResult, setSecondaryResult] = useState<string | undefined>()

  const applyRoomSettings = useCallback(async (roomId: string) => {
    const saved = await getRoomSettings(roomId)
    setAutoReplyMode(saved?.autoReplyMode ?? "none")
    setSessionModel(saved?.model ?? null)
    setSessionLang(saved?.lang ?? null)
    setSessionTone(saved?.tone ?? null)
    setSublineTranslate(Boolean(saved?.sublineTranslate))
  }, [])

  const handleResetDefaults = () => {
    setSessionModel(null)
    setSessionLang(null)
    setSessionTone(null)
    setAutoReplyMode("none")
    setSublineTranslate(false)
    if (room?.id) {
      void clearRoomSettings(room.id)
    }
  }

  const handleToggleSubline = () => {
    const nextVal = !sublineTranslate
    setSublineTranslate(nextVal)
    if (room?.id) {
      void saveRoomSettings(room.id, { sublineTranslate: nextVal })
    }
  }

  const handleSelectAutoReplyMode = (mode: WebChatAutoReplyMode) => {
    setAutoReplyMode(mode)
    const roomId = room?.id
    if (roomId) {
      void saveRoomSettings(roomId, { autoReplyMode: mode })
      if (mode !== "none") {
        const lastMsg = messages[messages.length - 1]
        if (lastMsg?.id) {
          lastRepliedPerRoomRef.current.set(roomId, lastMsg.id)
        }
      }
    }
  }

  const handleSelectModel = (modelId: string | null) => {
    setSessionModel(modelId)
    if (room?.id) {
      void saveRoomSettings(room.id, { model: modelId })
    }
  }

  const handleSelectLang = (lang: string | null) => {
    setSessionLang(lang)
    if (room?.id) {
      void saveRoomSettings(room.id, { lang })
    }
  }

  const handleSelectTone = (tone: WebChatTone | null) => {
    setSessionTone(tone)
    if (room?.id) {
      void saveRoomSettings(room.id, { tone })
    }
  }

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

        const isSupported = isSupportedChatUrl(tabInfo.url, webChatConfig?.genericMatchUrls || [])
        if (!isSupported) {
          setRoom(null)
          setMessages([])
          setResultContent("")
          setSecondaryResult(undefined)
          setActiveAction(null)
          setAutoReplyMode("none")
          setIsAutoReplying(false)
          currentRoomIdRef.current = null
          return
        }

        const data = await getActiveChatMessagesFromTab(
          tabInfo.id,
          webChatConfig?.genericMatchUrls || [],
        )
        const currentRoom = data.room
        setRoom(currentRoom)
        setMessages(data.messages)

        if (!currentRoom) {
          setResultContent("")
          setSecondaryResult(undefined)
          setActiveAction(null)
          currentRoomIdRef.current = null
          return
        }

        const roomId = currentRoom.id || "unknown"
        if (roomId !== currentRoomIdRef.current) {
          currentRoomIdRef.current = roomId
          await applyRoomSettings(roomId)
        }

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
      applyRoomSettings,
      webChatConfig?.genericMatchUrls,
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

  // Listen to tab switches / updates to immediately sync or reset
  useEffect(() => {
    const handleTabChange = () => {
      void loadActiveChat(false)
    }

    browser.tabs?.onActivated?.addListener(handleTabChange)
    browser.tabs?.onUpdated?.addListener(handleTabChange)

    return () => {
      browser.tabs?.onActivated?.removeListener(handleTabChange)
      browser.tabs?.onUpdated?.removeListener(handleTabChange)
    }
  }, [loadActiveChat])

  // Periodic Auto Reply & Room Sync checker
  useEffect(() => {
    let isSubscribed = true

    const checkAndAutoReply = async () => {
      if (isAutoReplyingRef.current || !isSubscribed) return
      const tabInfo = await getActiveTabInfo(true)
      if (!tabInfo?.id || !isSubscribed) return

      const isSupported = isSupportedChatUrl(tabInfo.url, webChatConfig?.genericMatchUrls || [])
      if (!isSupported) {
        if (currentRoomIdRef.current !== null) {
          currentRoomIdRef.current = null
          setRoom(null)
          setMessages([])
          setResultContent("")
          setSecondaryResult(undefined)
          setActiveAction(null)
          setAutoReplyMode("none")
          setIsAutoReplying(false)
        }
        return
      }

      const data = await getActiveChatMessagesFromTab(
        tabInfo.id,
        webChatConfig?.genericMatchUrls || [],
      )
      const currentRoom = data.room
      if (!currentRoom?.id || !isSubscribed) return

      // If room changed in the active tab (e.g. user clicked another chat in Zalo/Telegram)
      if (currentRoom.id !== currentRoomIdRef.current) {
        currentRoomIdRef.current = currentRoom.id
        setRoom(currentRoom)
        setMessages(data.messages)
        await applyRoomSettings(currentRoom.id)
        return
      }

      // Check if auto reply is enabled for this active room
      const currentMode = autoReplyModeRef.current
      if (currentMode === "none") {
        return
      }

      const msgs = data.messages
      if (!msgs || msgs.length === 0 || !isSubscribed) return

      const lastMsg = msgs[msgs.length - 1]
      const lastRepliedId = lastRepliedPerRoomRef.current.get(currentRoom.id)
      if (
        lastMsg &&
        !lastMsg.isOwn &&
        lastMsg.id &&
        lastMsg.id !== lastRepliedId &&
        lastMsg.content.trim().length > 0
      ) {
        lastRepliedPerRoomRef.current.set(currentRoom.id, lastMsg.id)
        isAutoReplyingRef.current = true
        setIsAutoReplying(true)
        try {
          setMessages(msgs)

          const res = await generateSmartReply({
            contextMessages: msgs.slice(-5),
            targetLang: effectiveLangRef.current,
            tone: effectiveToneRef.current,
            rules: webChatConfig?.rules,
            providerId: effectiveModelRef.current || undefined,
            sourceFeature: `Web Chat (Auto Reply - ${currentMode})`,
            url: tabInfo.url,
          })

          if (res.replyText && isSubscribed) {
            await insertTextToActiveChatTab(tabInfo.id, res.replyText, {
              autoSend: currentMode === "send",
            })
            setResultContent(res.replyText)
            setSecondaryResult(
              currentMode === "send"
                ? i18n.t("options.webChat.sidepanel.autoReply.statusSent")
                : i18n.t("options.webChat.sidepanel.autoReply.statusDrafted"),
            )
          } else {
            lastRepliedPerRoomRef.current.delete(currentRoom.id)
          }
        } catch (err) {
          log.error("Failed to execute auto reply", {
            err,
            lastMsgId: lastMsg.id,
            roomId: currentRoom.id,
          })
          lastRepliedPerRoomRef.current.delete(currentRoom.id)
          if (isSubscribed) {
            const errStr = (err as Error)?.message || String(err)
            setResultContent(`[Auto Reply Error]: ${errStr}`)
            setSecondaryResult(undefined)
          }
        } finally {
          isAutoReplyingRef.current = false
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
  }, [applyRoomSettings, webChatConfig?.genericMatchUrls, webChatConfig?.rules])

  const handleActionSelect = async (action: WebChatActionType) => {
    if (!room) return
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

  const isSupported = Boolean(
    currentTabUrl && isSupportedChatUrl(currentTabUrl, webChatConfig?.genericMatchUrls || []),
  )

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <ChatContextHeader
        room={room}
        messageCount={messages.length}
        loading={loading}
        onRefresh={() => void loadActiveChat(true)}
        availableProviders={llmProviders}
        selectedProviderId={effectiveModel}
        onSelectProvider={(id) => handleSelectModel(id)}
        selectedLang={effectiveLang}
        onSelectLang={(lang) => handleSelectLang(lang)}
        selectedTone={effectiveTone}
        onSelectTone={(tone) => handleSelectTone(tone)}
        autoReplyMode={autoReplyMode}
        onSelectAutoReplyMode={handleSelectAutoReplyMode}
        isAutoReplying={isAutoReplying}
        sublineTranslate={sublineTranslate}
        onToggleSubline={handleToggleSubline}
        isOverridden={isOverridden}
        onResetDefaults={handleResetDefaults}
        disabled={!isSupported}
      />

      <ActionChips
        loading={loading}
        activeAction={activeAction}
        onSelectAction={(action) => void handleActionSelect(action)}
        disabled={!isSupported || !room}
      />

      <div className="scrollbar-slim flex-1 overflow-y-auto">
        <ResultStream
          content={resultContent}
          secondaryContent={secondaryResult}
          loading={loading}
          onInsertToChat={(text) => void handleInsertToChat(text)}
          isUnsupported={!isSupported && !loading}
        />
      </div>
    </div>
  )
}
