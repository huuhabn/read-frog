import type ChatSession from "@/utils/db/dexie/tables/chat-session"
import { MessageSquare, Plus, Search, Trash2, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Input } from "@/components/ui/base-ui/input"
import { db } from "@/utils/db/dexie/db"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"

interface HistorySessionItemProps {
  session: ChatSession
  isSelected: boolean
  onSelect: (id: string) => void
  onDelete: (e: React.MouseEvent, id: string) => void
}

function HistorySessionItem({ session, isSelected, onSelect, onDelete }: HistorySessionItemProps) {
  const messageCount = session.messages?.length || 0
  const dateStr = session.updatedAt
    ? new Date(session.updatedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : ""

  return (
    <div
      onClick={() => onSelect(session.id)}
      className={cn(
        "group relative flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:bg-muted/70",
        isSelected && "border-primary/25 bg-primary/10 hover:bg-primary/15",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <MessageSquare
          className={cn(
            "mt-0.5 size-3.5 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-primary",
            isSelected && "text-primary",
          )}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className={cn(
              "truncate text-xs font-medium text-foreground/90 transition-colors group-hover:text-foreground",
              isSelected && "font-semibold text-primary",
            )}
            title={session.title || i18n.t("sidePanel.historyDrawer.untitled")}
          >
            {session.title || i18n.t("sidePanel.historyDrawer.untitled")}
          </span>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="shrink-0">{dateStr}</span>
            <span>•</span>
            <span className="shrink-0">
              {i18n.t("sidePanel.historyDrawer.messagesCount", [messageCount])}
            </span>
            {session.model && (
              <>
                <span>•</span>
                <span className="py-0.2 max-w-[90px] truncate rounded bg-muted/80 px-1 font-mono text-[9px] text-muted-foreground/90">
                  {session.model}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <Button
        size="icon"
        variant="ghost"
        className="size-6.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
        onClick={(e) => onDelete(e, session.id)}
        title={i18n.t("sidePanel.historyDrawer.delete")}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
}

interface ChatHistoryDrawerProps {
  isOpen: boolean
  currentSessionId: string | null
  onClose: () => void
  onSelectSession: (sessionId: string) => void
  onNewChat: () => void
}

export function ChatHistoryDrawer({
  isOpen,
  currentSessionId,
  onClose,
  onSelectSession,
  onNewChat,
}: ChatHistoryDrawerProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  const loadSessions = useCallback(async () => {
    try {
      const list = await db.chatSession.orderBy("updatedAt").reverse().toArray()
      setSessions(list)
    } catch (err) {
      console.error("Failed to load chat sessions:", err)
    }
  }, [])

  useEffect(() => {
    let isSubscribed = true
    if (isOpen) {
      void db.chatSession
        .orderBy("updatedAt")
        .reverse()
        .toArray()
        .then((list) => {
          if (isSubscribed) {
            setSessions(list)
          }
        })
        .catch((err) => {
          console.error("Failed to load chat sessions:", err)
        })
    }
    return () => {
      isSubscribed = false
    }
  }, [isOpen])

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      await db.chatSession.delete(id)
      await loadSessions()
    } catch (err) {
      console.error("Failed to delete chat session:", err)
    }
  }

  const filteredSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return sessions
    return sessions.filter((s) => {
      const title = (s.title || "").toLowerCase()
      const model = (s.model || "").toLowerCase()
      return title.includes(query) || model.includes(query)
    })
  }, [sessions, searchQuery])

  if (!isOpen) return null

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-xs transition-all">
      {/* Header */}
      <div className="flex h-11 items-center justify-between border-b border-border/60 px-3.5">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-primary" />
          <h2 className="text-xs font-semibold tracking-tight text-foreground">
            {i18n.t("sidePanel.historyDrawer.title")}
          </h2>
          <span className="py-0.2 rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            {sessions.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 rounded-md px-2 text-xs"
            onClick={() => {
              onNewChat()
              onClose()
            }}
          >
            <Plus className="size-3" />
            <span>{i18n.t("sidePanel.historyDrawer.newChat")}</span>
          </Button>
          <Button size="icon" variant="ghost" className="size-7 rounded-md" onClick={onClose}>
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Search Bar (shown when more than 3 sessions) */}
      {sessions.length > 3 && (
        <div className="border-b border-border/40 px-3 py-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-3 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={i18n.t("sidePanel.historyDrawer.search")}
              className="h-7 w-full rounded-md bg-muted/30 pr-7 pl-7 text-xs placeholder:text-muted-foreground/60 focus-visible:ring-1"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute top-1/2 right-2 flex size-4 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              >
                <X className="size-2.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sessions List */}
      <div className="scrollbar-slim flex-1 overflow-y-auto p-2.5">
        {sessions.length === 0 ? (
          <div className="flex h-44 flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <MessageSquare className="size-7 opacity-30" />
            <p>{i18n.t("sidePanel.historyDrawer.empty")}</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="flex h-36 flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
            <Search className="size-5 opacity-40" />
            <p>{i18n.t("sidePanel.historyDrawer.noResults")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filteredSessions.map((session) => (
              <HistorySessionItem
                key={session.id}
                session={session}
                isSelected={session.id === currentSessionId}
                onSelect={(id) => {
                  onSelectSession(id)
                  onClose()
                }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
