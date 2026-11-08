import { useCallback, useEffect, useState } from "react"
import { MessageSquare, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/base-ui/button"
import { db } from "@/utils/db/dexie/db"
import type ChatSession from "@/utils/db/dexie/tables/chat-session"
import { cn } from "@/utils/styles/utils"

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

  if (!isOpen) return null

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-xs transition-all">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight">Chat History</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            onClick={() => {
              onNewChat()
              onClose()
            }}
          >
            <Plus className="size-3.5" />
            New Chat
          </Button>
          <Button size="icon" variant="ghost" className="size-8" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {sessions.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <MessageSquare className="size-8 opacity-40" />
            <p>No chat history yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {sessions.map((session) => {
              const isSelected = session.id === currentSessionId
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
                  key={session.id}
                  onClick={() => {
                    onSelectSession(session.id)
                    onClose()
                  }}
                  className={cn(
                    "group flex cursor-pointer items-start justify-between rounded-lg border border-transparent p-2.5 text-left transition-colors hover:bg-muted/70",
                    isSelected && "border-primary/30 bg-primary/10",
                  )}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1 pr-2">
                    <span className="truncate text-xs font-medium text-foreground">
                      {session.title || "Untitled Chat"}
                    </span>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{dateStr}</span>
                      <span>•</span>
                      <span>
                        {messageCount} message{messageCount === 1 ? "" : "s"}
                      </span>
                      <span>•</span>
                      <span className="truncate max-w-[100px]">{session.model}</span>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                    onClick={(e) => void handleDelete(e, session.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
