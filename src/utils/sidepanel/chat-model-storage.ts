import { z } from "zod"
import { storage } from "#imports"
import { SIDEPANEL_CHAT_MODEL_STORAGE_KEY } from "@/utils/constants/config"

export interface SelectedModelConfig {
  providerId: string
  model: string
}

export const selectedModelConfigSchema = z.object({
  providerId: z.string().min(1),
  model: z.string().min(1),
})

export const DEFAULT_SELECTED_CHAT_MODEL: SelectedModelConfig = {
  providerId: "openrouter",
  model: "google/gemma-4-31b-it:free",
}

export async function getLocalSelectedChatModel(): Promise<SelectedModelConfig> {
  try {
    const raw = await storage.getItem<unknown>(`local:${SIDEPANEL_CHAT_MODEL_STORAGE_KEY}`)
    const parsed = selectedModelConfigSchema.safeParse(raw)
    if (parsed.success) {
      return parsed.data
    }
  } catch (error) {
    console.warn("[SidePanel] Failed to load selected chat model from storage:", error)
  }
  return DEFAULT_SELECTED_CHAT_MODEL
}

export async function setLocalSelectedChatModel(model: SelectedModelConfig): Promise<void> {
  try {
    const parsed = selectedModelConfigSchema.parse(model)
    await storage.setItem(`local:${SIDEPANEL_CHAT_MODEL_STORAGE_KEY}`, parsed)
  } catch (error) {
    console.error("[SidePanel] Failed to save selected chat model to storage:", error)
  }
}
