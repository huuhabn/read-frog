import type { ChatMessage } from "../adapter/types"
import type { LLMProviderConfig } from "@/types/config/provider"
import type { AuditLogTokenUsage } from "@/utils/db/dexie/tables/audit-log"
import { generateText } from "ai"
import { recordAuditLog } from "@/utils/audit-log/audit-log-service"
import { getLocalConfig } from "@/utils/config/storage"
import { getModelById } from "@/utils/providers/model"
import { maskPII } from "../pii/mask"
import { unmaskPII } from "../pii/unmask"

export interface SmartReplyResult {
  replyText: string
  viGloss?: string
}

export type RewriteTone = "professional" | "friendly" | "brief"

export interface RoomSummaryResult {
  summary: string
  actionItems: string[]
  extractedEntities: {
    phones: string[]
    bankAccounts: string[]
    links: string[]
    dates: string[]
  }
}

export interface CallWebChatLLMOptions {
  systemPrompt: string
  userPrompt: string
  maskPii?: boolean
  providerId?: string
  sourceFeature?: string
  url?: string
}

/**
 * Finds the preferred LLM provider for web-chat tasks (Gemini preferred, or first enabled LLM provider).
 */
export async function getWebChatProvider(): Promise<LLMProviderConfig | null> {
  try {
    const config = await getLocalConfig()
    if (!config?.providersConfig) return null

    // 1. Check feature provider setting from config.webChat.providerId
    const configuredId = config.webChat?.providerId
    if (configuredId) {
      const configuredProvider = config.providersConfig.find(
        (p) => p.id === configuredId && p.enabled,
      ) as LLMProviderConfig | undefined
      if (configuredProvider) return configuredProvider
    }

    // 2. Prefer Gemini (Google Generative AI)
    const gemini = config.providersConfig.find((p) => p.enabled && p.provider === "google") as
      | LLMProviderConfig
      | undefined
    if (gemini) return gemini

    // 3. Fallback to any enabled LLM provider
    const anyLlm = config.providersConfig.find(
      (p) =>
        p.enabled &&
        p.provider !== "google-translate" &&
        p.provider !== "microsoft-translate" &&
        p.provider !== "deepl" &&
        p.provider !== "deeplx",
    ) as LLMProviderConfig | undefined

    return anyLlm || null
  } catch {
    return null
  }
}

/**
 * Core LLM caller with optional PII masking and automated Audit Log recording.
 */
export async function callWebChatLLM(options: CallWebChatLLMOptions): Promise<string> {
  const {
    systemPrompt,
    userPrompt,
    maskPii = true,
    providerId,
    sourceFeature = "Web Chat Assistant",
    url,
  } = options

  let processedPrompt = userPrompt
  let piiMap: Record<string, string> = {}

  if (maskPii) {
    const piiResult = maskPII(userPrompt)
    processedPrompt = piiResult.masked
    piiMap = piiResult.map
  }

  const providerConfig = await getWebChatProvider()
  const targetProviderId = providerId || providerConfig?.id

  if (!targetProviderId) {
    throw new Error("No configured LLM provider found for Web Chat.")
  }

  const model = await getModelById(targetProviderId)
  const startTime = performance.now()
  let status: "success" | "error" = "success"
  let errorMessage: string | undefined
  let outputText = ""
  let tokenUsage: AuditLogTokenUsage | undefined

  try {
    const response = await generateText({
      model,
      system: systemPrompt,
      prompt: processedPrompt,
      temperature: 0.7,
    })

    outputText = response.text || ""

    if (response.usage) {
      const u = response.usage as Record<string, unknown>
      const promptTokens =
        typeof u.promptTokens === "number"
          ? u.promptTokens
          : typeof u.inputTokens === "number"
            ? u.inputTokens
            : undefined
      const completionTokens =
        typeof u.completionTokens === "number"
          ? u.completionTokens
          : typeof u.outputTokens === "number"
            ? u.outputTokens
            : undefined
      const totalTokens =
        typeof u.totalTokens === "number"
          ? u.totalTokens
          : promptTokens !== undefined || completionTokens !== undefined
            ? (promptTokens ?? 0) + (completionTokens ?? 0)
            : undefined

      if (
        promptTokens !== undefined ||
        completionTokens !== undefined ||
        totalTokens !== undefined
      ) {
        tokenUsage = { promptTokens, completionTokens, totalTokens }
      }
    }

    if (maskPii && Object.keys(piiMap).length > 0) {
      outputText = unmaskPII(outputText, piiMap)
    }

    return outputText.trim()
  } catch (err) {
    status = "error"
    errorMessage = (err as Error)?.message || String(err)
    throw err
  } finally {
    const latencyMs = Math.round(performance.now() - startTime)
    const currentUrl =
      url ||
      (typeof window !== "undefined" && window.location?.href ? window.location.href : undefined)

    const modelVal = providerConfig?.model
    const modelName =
      typeof modelVal === "object" && modelVal !== null
        ? (modelVal as { customModel?: string; model?: string }).customModel ||
          (modelVal as { customModel?: string; model?: string }).model ||
          ""
        : typeof modelVal === "string"
          ? modelVal
          : ""

    void recordAuditLog({
      sourceFeature,
      url: currentUrl,
      providerId: targetProviderId,
      providerName: providerConfig?.name,
      providerType: "llm",
      model: modelName,
      systemPrompt,
      prompt: userPrompt,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: processedPrompt },
      ],
      parameters: {
        maskPii,
        temperature: 0.7,
      },
      responseOutput: outputText,
      latencyMs,
      status,
      errorMessage,
      tokenUsage,
      rawPayload: {
        sourceFeature,
        providerId: targetProviderId,
        model: modelName,
        url: currentUrl,
        latencyMs,
        status,
        errorMessage,
        tokenUsage,
      },
    })
  }
}

/**
 * Smart reply generator: takes recent chat messages and returns dual preview: reply_text + vi_gloss.
 */
export async function generateSmartReply(options: {
  contextMessages: ChatMessage[]
  customInstruction?: string
  targetLang?: string
  tone?: RewriteTone
  sourceFeature?: string
  url?: string
}): Promise<SmartReplyResult> {
  const {
    contextMessages,
    customInstruction,
    targetLang = "vi",
    tone = "friendly",
    sourceFeature = "Web Chat (Smart Reply)",
    url,
  } = options

  const formattedContext = contextMessages
    .map((m) => `${m.author} (${m.isOwn ? "Tôi" : "Đối phương"}): ${m.content}`)
    .join("\n")

  const toneGuide = {
    professional: "polite, formal, professional, well-crafted",
    friendly: "warm, approachable, natural, friendly",
    brief: "concise, direct, to-the-point",
  }[tone]

  const systemPrompt = `You are an intelligent Web Chat AI Assistant.
Analyze the recent messages in this conversation and compose the most natural and appropriate reply.
Tone: ${toneGuide}.
Target Language of the reply: ${targetLang}.
Strict Output Requirement: Return ONLY raw JSON without markdown formatting (\`\`\`json):
{
  "replyText": "Reply content in the requested target language",
  "viGloss": "Meaning in Vietnamese (or English if target is already Vietnamese)"
}`

  const userPrompt = `Recent conversation context:
${formattedContext || "(No prior context)"}

${customInstruction ? `User specific instruction: ${customInstruction}` : "Please suggest the most natural reply."}`

  try {
    const raw = await callWebChatLLM({
      systemPrompt,
      userPrompt,
      maskPii: true,
      sourceFeature,
      url,
    })

    const clean = raw
      .replace(/^```json\s*/i, "")
      .replace(/```$/i, "")
      .trim()
    const parsed = JSON.parse(clean) as { replyText?: string; viGloss?: string }
    return {
      replyText: parsed.replyText || clean,
      viGloss: parsed.viGloss,
    }
  } catch {
    // Fallback if JSON parsing failed
    const fallback = await callWebChatLLM({
      systemPrompt: `You are an intelligent Web Chat AI Assistant. Compose an appropriate reply for the conversation in ${targetLang} using a ${toneGuide} tone. Return ONLY the reply content without explanation.`,
      userPrompt: formattedContext || "(No prior context)",
      maskPii: true,
      sourceFeature: `${sourceFeature} [Fallback]`,
      url,
    })
    return { replyText: fallback }
  }
}

/**
 * Direct conversational translation for chat messages using the configured Web Chat LLM.
 */
export async function translateChatText(options: {
  text: string
  targetLang?: string
  providerId?: string
  sourceFeature?: string
  url?: string
}): Promise<string> {
  const {
    text,
    targetLang = "vi",
    providerId,
    sourceFeature = "Web Chat (Translate)",
    url,
  } = options
  const trimmed = text.trim()
  if (!trimmed) return ""

  const systemPrompt = `You are a professional conversational chat translator.
Accurately translate the user's message into target language: "${targetLang}".
Preserve all formatting, emoji, mentions, URLs, code snippets, and placeholders (e.g. __URL_..., __MENTION_...).
Output STRICTLY and ONLY the translated text without any quotes, introduction, markdown headers, or explanations.`

  return callWebChatLLM({
    systemPrompt,
    userPrompt: trimmed,
    maskPii: true,
    providerId,
    sourceFeature,
    url,
  })
}

/**
 * Rewrite selected text into one of three tones: professional, friendly, brief.
 */
export async function rewriteChatText(
  text: string,
  tone: RewriteTone = "professional",
  options?: {
    sourceFeature?: string
    url?: string
  },
): Promise<string> {
  const toneDesc = {
    professional: "professional, formal, polite, workplace-appropriate",
    friendly: "friendly, casual, warm, conversational",
    brief: "brief, concise, direct, eliminating filler words",
  }[tone]

  const systemPrompt = `You are an expert message editor. Rewrite the user's message so that it sounds ${toneDesc}. Keep the core meaning and essential facts intact. Respond ONLY with the rewritten message without preface or explanation.`

  return callWebChatLLM({
    systemPrompt,
    userPrompt: text,
    maskPii: true,
    sourceFeature: options?.sourceFeature || `Web Chat (Rewrite - ${tone})`,
    url: options?.url,
  })
}

/**
 * Summarize 50-100 unread room messages, group by topics, extract action items and key details.
 */
export async function summarizeChatRoom(
  messages: ChatMessage[],
  roomName = "Chat",
  options?: {
    sourceFeature?: string
    url?: string
  },
): Promise<RoomSummaryResult> {
  const context = messages.map((m) => `${m.author}: ${m.content}`).join("\n")

  const systemPrompt = `You are a professional conversation summarizer.
Summarize the conversation in the chat room "${roomName}".
Return STRICT JSON format (without markdown code blocks):
{
  "summary": "Concise summary of the key discussion topics in 3-5 sentences.",
  "actionItems": ["Action item 1", "Action item 2"],
  "extractedEntities": {
    "phones": ["09..."],
    "bankAccounts": ["19..."],
    "links": ["https://..."],
    "dates": ["Tomorrow at 2pm"]
  }
}`

  try {
    const raw = await callWebChatLLM({
      systemPrompt,
      userPrompt: context,
      maskPii: true,
      sourceFeature: options?.sourceFeature || "Web Chat (Summary)",
      url: options?.url,
    })
    const clean = raw
      .replace(/^```json\s*/i, "")
      .replace(/```$/i, "")
      .trim()
    const parsed = JSON.parse(clean) as RoomSummaryResult
    return {
      summary: parsed.summary || "Đã phân tích hội thoại.",
      actionItems: parsed.actionItems || [],
      extractedEntities: parsed.extractedEntities || {
        phones: [],
        bankAccounts: [],
        links: [],
        dates: [],
      },
    }
  } catch {
    return {
      summary: "Không thể tự động phân tích chi tiết hội thoại.",
      actionItems: [],
      extractedEntities: {
        phones: [],
        bankAccounts: [],
        links: [],
        dates: [],
      },
    }
  }
}
