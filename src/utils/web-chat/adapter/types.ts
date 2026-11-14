export type ChatPlatform = "zalo" | "telegram" | "slack" | "generic"

export interface ChatMessage {
  id: string
  author: string
  content: string
  timestamp: number
  timeText?: string
  isOwn: boolean
  element?: HTMLElement
}

export interface ChatRoom {
  id: string
  name: string
  platform: ChatPlatform
  avatar?: string
  unreadCount?: number
}

export interface IChatAdapter {
  readonly platform: ChatPlatform
  /** Check if adapter matches current page URL */
  matches(url: string): boolean
  /** Retrieve visible messages in the active conversation */
  getMessages(limit?: number): ChatMessage[]
  /** Get info about the current active room/conversation */
  getCurrentRoom(): ChatRoom | null
  /** Find current input box (textarea, contenteditable, role=textbox) */
  getInputElement(): HTMLElement | null
  /** Insert text into the active chat input with optional auto-send */
  insertText(text: string, options?: { autoSend?: boolean }): boolean
  /** Submit/send the message currently in the input box */
  submitSend?(): boolean
  /** Get last N messages as context */
  getRecentMessages(n: number): ChatMessage[]
  /** Optional observer for new messages arriving */
  observeMessages?(callback: (messages: ChatMessage[]) => void): () => void
}
