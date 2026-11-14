import { z } from "zod"
import { storage } from "#imports"

export type TranslateLength = "standard" | "concise" | "expanded"
export type TranslateTone = "neutral" | "casual" | "formal" | "authoritative" | "empathetic"
export type TranslateStyle = "dynamic" | "literal" | "creative"
export type TranslateComplexity = "standard" | "layman" | "expert"

export interface TranslatePreferences {
  length: TranslateLength
  tone: TranslateTone
  style: TranslateStyle
  complexity: TranslateComplexity
  customPrompt: string
}

export const DEFAULT_TRANSLATE_PREFERENCES: TranslatePreferences = {
  length: "standard",
  tone: "neutral",
  style: "dynamic",
  complexity: "standard",
  customPrompt: "",
}

export const translatePreferencesSchema = z.object({
  length: z.enum(["standard", "concise", "expanded"]).catch("standard"),
  tone: z.enum(["neutral", "casual", "formal", "authoritative", "empathetic"]).catch("neutral"),
  style: z.enum(["dynamic", "literal", "creative"]).catch("dynamic"),
  complexity: z.enum(["standard", "layman", "expert"]).catch("standard"),
  customPrompt: z.string().catch(""),
})

export const TRANSLATE_PREFERENCES_STORAGE_KEY = "sidepanelTranslatePreferences"

export function isDefaultPreferences(prefs: TranslatePreferences): boolean {
  return (
    prefs.length === "standard" &&
    prefs.tone === "neutral" &&
    prefs.style === "dynamic" &&
    prefs.complexity === "standard" &&
    !prefs.customPrompt.trim()
  )
}

export async function getLocalTranslatePreferences(): Promise<TranslatePreferences> {
  try {
    const raw = await storage.getItem<unknown>(`local:${TRANSLATE_PREFERENCES_STORAGE_KEY}`)
    const parsed = translatePreferencesSchema.safeParse(raw)
    if (parsed.success) {
      return parsed.data
    }
  } catch (error) {
    console.warn("[SidePanel] Failed to load translate preferences from storage:", error)
  }
  return DEFAULT_TRANSLATE_PREFERENCES
}

export async function setLocalTranslatePreferences(prefs: TranslatePreferences): Promise<void> {
  try {
    const parsed = translatePreferencesSchema.parse(prefs)
    await storage.setItem(`local:${TRANSLATE_PREFERENCES_STORAGE_KEY}`, parsed)
  } catch (error) {
    console.error("[SidePanel] Failed to save translate preferences to storage:", error)
  }
}

export function buildTranslateInstructions(
  targetLangName: string,
  sourceLangName?: string,
  preferences?: Partial<TranslatePreferences>,
): string {
  const {
    length = "standard",
    tone = "neutral",
    style = "dynamic",
    complexity = "standard",
    customPrompt = "",
  } = preferences || {}

  const lengthGuide: Record<TranslateLength, string> = {
    standard: "Độ dài tiêu chuẩn, trung thực với dung lượng bản gốc.",
    concise: "Ngắn gọn, súc tích, cô đọng ý chính.",
    expanded: "Diễn giải chi tiết, làm rõ nghĩa đầy đủ hơn.",
  }

  const toneGuide: Record<TranslateTone, string> = {
    neutral: "Trung tính, tự nhiên, khách quan.",
    casual: "Thân mật, gần gũi, giao tiếp tự nhiên.",
    formal: "Trang trọng, chuẩn mực công sở hoặc học thuật.",
    authoritative: "Quyết đoán, chuyên môn, mang tính định hướng.",
    empathetic: "Đồng cảm, ấm áp, thấu hiểu.",
  }

  const styleGuide: Record<TranslateStyle, string> = {
    dynamic: "Tương đương động (Dynamic Equivalence) - tự nhiên theo văn phong bản ngữ.",
    literal: "Dịch sát nghĩa (Literal) - bám sát từng từ và cấu trúc câu gốc.",
    creative: "Chuyển soạn sáng tạo (Creative Adaptation) - linh hoạt ngôn từ sinh động.",
  }

  const complexityGuide: Record<TranslateComplexity, string> = {
    standard: "Độ phức tạp tiêu chuẩn, đại chúng dễ tiếp cận.",
    layman: "Dễ hiểu cho đại chúng (Layman) - từ ngữ đơn giản, tránh biệt ngữ.",
    expert: "Chuyên sâu (Expert) - sử dụng thuật ngữ chuyên ngành chuẩn xác.",
  }

  const lines = [
    `Bạn là chuyên gia dịch thuật xuất sắc. Hãy dịch văn bản ${
      sourceLangName && sourceLangName !== "Auto Detect" ? `từ ${sourceLangName} ` : ""
    }sang ${targetLangName} một cách tự nhiên, chuẩn xác, lưu loát và giữ đúng ngữ cảnh.`,
    "",
    "## Quy chuẩn dịch thuật:",
    `- Độ dài: ${lengthGuide[length]}`,
    `- Giọng điệu: ${toneGuide[tone]}`,
    `- Phương pháp dịch: ${styleGuide[style]}`,
    `- Mức độ phức tạp: ${complexityGuide[complexity]}`,
  ]

  if (customPrompt.trim()) {
    lines.push("", `## Yêu cầu bổ sung của người dùng:\n${customPrompt.trim()}`)
  }

  lines.push(
    "",
    "## Quy tắc đầu ra:",
    "- Chỉ trả về duy nhất bản dịch hoàn chỉnh.",
    "- Tuyệt đối KHÔNG kèm theo lời chào, giải thích, hay ghi chú thừa.",
  )

  return lines.join("\n")
}
