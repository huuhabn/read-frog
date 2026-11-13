import type { PromptResolver } from "./api/ai"
import type { Config } from "@/types/config/config"
import type { ProviderConfig } from "@/types/config/provider"
import type { TranslationTextFormat } from "@/types/config/translate"
import type { MatchedTerm } from "@/utils/glossary/types"
import { LANGUAGE_ENGLISH_NAMES } from "@read-frog/definitions"
import { isLLMProviderConfig, isNonAPIProvider, isPureAPIProvider } from "@/types/config/provider"
import { recordAuditLog } from "@/utils/audit-log/audit-log-service"
import { aiTranslate } from "./api/ai"
import { deeplTranslate } from "./api/deepl"
import { deeplxTranslate } from "./api/deeplx"
import { googleTranslate } from "./api/google"
import {
  toGoogleLanguageCode,
  toGoogleSourceCode,
  toMicrosoftLanguageCode,
  toMicrosoftSourceCode,
} from "./api/language-codes"
import { microsoftTranslate } from "./api/microsoft"
import { prepareTranslationText } from "./text-preparation"
import { normalizeTranslationOutput } from "./translation-output-normalization"

export async function executeTranslate<TContext>(
  text: string,
  langConfig: Config["language"],
  providerConfig: ProviderConfig,
  promptResolver: PromptResolver<TContext>,
  options?: {
    isBatch?: boolean
    context?: TContext
    textFormat?: TranslationTextFormat
    // Only Google needs protection: its translateHtml transport collapses
    // "\n" as HTML whitespace. Microsoft preserves newlines in both textTypes
    // (live-verified); LLM prompts already mandate format preservation.
    preserveLineBreaks?: boolean
    signal?: AbortSignal
    glossaryTerms?: readonly MatchedTerm[]
  },
) {
  const preparedText = prepareTranslationText(text)
  if (preparedText === "") {
    return ""
  }

  const { provider } = providerConfig
  let translatedText = ""

  const startTime = performance.now()
  let status: "success" | "error" = "success"
  let errorMessage: string | undefined
  let finalResult = ""

  try {
    if (isNonAPIProvider(provider)) {
      const google = provider === "google-translate"
      const sourceLang = (google ? toGoogleSourceCode : toMicrosoftSourceCode)(
        langConfig.sourceCode,
      )
      const targetLang = (google ? toGoogleLanguageCode : toMicrosoftLanguageCode)(
        langConfig.targetCode,
      )
      if (provider === "google-translate") {
        translatedText = await googleTranslate(preparedText, sourceLang, targetLang, {
          textFormat: options?.textFormat,
          preserveLineBreaks: options?.preserveLineBreaks,
          signal: options?.signal,
        })
      } else if (provider === "microsoft-translate") {
        translatedText = await microsoftTranslate(preparedText, sourceLang, targetLang, {
          textFormat: options?.textFormat,
          signal: options?.signal,
        })
      }
    } else if (isPureAPIProvider(provider)) {
      const { sourceCode, targetCode } = langConfig
      if (provider === "deeplx") {
        translatedText = await deeplxTranslate(
          preparedText,
          sourceCode,
          targetCode,
          providerConfig,
          {
            textFormat: options?.textFormat,
            signal: options?.signal,
          },
        )
      } else if (provider === "deepl") {
        translatedText = await deeplTranslate(text, sourceCode, targetCode, providerConfig, {
          textFormat: options?.textFormat,
          signal: options?.signal,
        })
      }
    } else if (isLLMProviderConfig(providerConfig)) {
      const targetLangName = LANGUAGE_ENGLISH_NAMES[langConfig.targetCode]
      translatedText = await aiTranslate(
        preparedText,
        targetLangName,
        providerConfig,
        promptResolver,
        options,
      )
    } else {
      throw new Error(`Unknown provider: ${provider}`)
    }

    finalResult = normalizeTranslationOutput(providerConfig, translatedText).trim()
    return finalResult
  } catch (err) {
    status = "error"
    errorMessage = (err as Error)?.message || String(err)
    throw err
  } finally {
    if (!isLLMProviderConfig(providerConfig)) {
      const currentUrl = typeof window !== "undefined" ? window.location?.href : undefined
      const sourceFeature = options?.isBatch ? "Batch Translation" : "Page Translation"
      void recordAuditLog({
        sourceFeature,
        url: currentUrl,
        providerId: providerConfig.id,
        providerType: "translation",
        prompt: preparedText,
        messages: [{ role: "user", content: preparedText }],
        parameters: {
          sourceLang: langConfig.sourceCode,
          targetLang: langConfig.targetCode,
        },
        responseOutput: finalResult,
        latencyMs: Math.round(performance.now() - startTime),
        status,
        errorMessage,
        rawPayload: {
          sourceFeature,
          url: currentUrl,
          providerId: providerConfig.id,
          providerType: "translation",
          prompt: preparedText,
          parameters: {
            sourceLang: langConfig.sourceCode,
            targetLang: langConfig.targetCode,
          },
          responseOutput: finalResult,
          latencyMs: Math.round(performance.now() - startTime),
          status,
          errorMessage,
        },
      })
    }
  }
}
