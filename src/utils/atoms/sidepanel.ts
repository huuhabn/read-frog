import type { SelectedModelConfig } from "@/utils/sidepanel/chat-model-storage"
import type { ActiveTabContent } from "@/utils/sidepanel/page-context"
import { atom } from "jotai"
import { DEFAULT_SELECTED_CHAT_MODEL } from "@/utils/sidepanel/chat-model-storage"

export type { SelectedModelConfig } from "@/utils/sidepanel/chat-model-storage"
export { DEFAULT_SELECTED_CHAT_MODEL } from "@/utils/sidepanel/chat-model-storage"

export type SidePanelNavTab = "chat" | "read" | "write" | "translate" | "history" | "web-chat"

export const sidepanelNavTabAtom = atom<SidePanelNavTab>("chat")

export const activeChatSessionIdAtom = atom<string | null>(null)

export const includePageContextAtom = atom<boolean>(false)

export const activeTabContentAtom = atom<ActiveTabContent | null>(null)

export const selectedChatModelAtom = atom<SelectedModelConfig>(DEFAULT_SELECTED_CHAT_MODEL)
