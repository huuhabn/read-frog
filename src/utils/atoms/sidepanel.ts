import type { ActiveTabContent } from "@/utils/sidepanel/page-context"
import { atom } from "jotai"

export type SidePanelNavTab = "chat" | "read" | "write" | "translate" | "history"

export const sidepanelNavTabAtom = atom<SidePanelNavTab>("chat")

export const activeChatSessionIdAtom = atom<string | null>(null)

export const includePageContextAtom = atom<boolean>(false)

export const activeTabContentAtom = atom<ActiveTabContent | null>(null)

export interface SelectedModelConfig {
  providerId: string
  model: string
}

export const selectedChatModelAtom = atom<SelectedModelConfig>({
  providerId: "openrouter",
  model: "google/gemma-4-31b-it:free",
})
