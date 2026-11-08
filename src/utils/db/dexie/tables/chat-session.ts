import { Entity } from "dexie"

export interface ChatMessageItem {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  createdAt: Date
}

export default class ChatSession extends Entity {
  id!: string

  title!: string

  providerId!: string

  model!: string

  messages!: ChatMessageItem[]

  createdAt!: Date

  updatedAt!: Date
}
