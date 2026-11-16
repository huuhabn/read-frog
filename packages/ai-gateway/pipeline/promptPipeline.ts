/**
 * 5-Phase Prompt Pipeline: Resolve -> Aggregate -> Layers -> Interpolate -> Post-appends
 */

import type {
  StyleProfile,
  ConversationContext,
  CompiledPrompt,
  ConditionalLayerContext,
} from "./types"

export const DEFAULT_BASE_RULES = [
  "You are an expert AI translation and language assistant.",
  "Preserve the original formatting, code blocks, and placeholders exactly as provided.",
  "Maintain the requested tone and natural fluency without hallucinating or adding unsolicited commentary.",
].join(" ")

export class PromptPipeline {
  private baseRules: string

  constructor(baseRules: string = DEFAULT_BASE_RULES) {
    this.baseRules = baseRules
  }

  /**
   * Compiles user input and context into deterministic system prompt and messages.
   */
  public compile(
    input: string,
    options?: {
      styleProfile?: StyleProfile
      styleOverride?: string
      conversation?: Partial<ConversationContext>
      history?: Array<{ role: "user" | "assistant"; content: string }>
      glossary?: Record<string, string>
      targetLanguage?: string
      customVariables?: Record<string, string>
      structuredSchema?: Record<string, unknown>
    },
  ): CompiledPrompt {
    const profile = options?.styleProfile ?? options?.conversation?.styleProfile
    const styleOverride = options?.styleOverride ?? options?.conversation?.styleOverride
    const targetLanguage = options?.targetLanguage ?? profile?.targetLanguage
    const tone = profile?.tone ?? "natural and accurate"

    // ─────────────────────────────────────────────────────────────
    // Phase 1: Resolve System Prompt
    // Priority: BASE_RULES < profile.systemPrompt < styleOverride
    // ─────────────────────────────────────────────────────────────
    let resolvedSystem = this.baseRules
    if (profile?.systemPrompt && profile.systemPrompt.trim().length > 0) {
      resolvedSystem = `${resolvedSystem}\n\n${profile.systemPrompt.trim()}`
    }
    if (profile?.rules && profile.rules.length > 0) {
      resolvedSystem = `${resolvedSystem}\n\nRules:\n${profile.rules.map((r) => `- ${r}`).join("\n")}`
    }
    if (styleOverride && styleOverride.trim().length > 0) {
      resolvedSystem = `${resolvedSystem}\n\nOverride Directives:\n${styleOverride.trim()}`
    }

    // ─────────────────────────────────────────────────────────────
    // Phase 2: Aggregate Context (Glossary Matching & History)
    // ─────────────────────────────────────────────────────────────
    const fullGlossary = { ...(profile?.glossary ?? {}), ...(options?.glossary ?? {}) }
    const matchedGlossary: Record<string, string> = {}

    if (Object.keys(fullGlossary).length > 0) {
      const lowerInput = input.toLowerCase()
      for (const [term, translation] of Object.entries(fullGlossary)) {
        if (term.trim().length > 0 && lowerInput.includes(term.toLowerCase())) {
          matchedGlossary[term] = translation
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // Phase 3: Conditional Layers
    // ─────────────────────────────────────────────────────────────
    const appliedLayers: string[] = []
    const layerContext: ConditionalLayerContext = {
      input,
      targetLanguage,
      hasHtmlMarkers: /<[^>]+>|&[a-z]+;|\[ph id=.*?\]/i.test(input),
      hasMathFormulas: /\$|\\\(|\\\[|\\frac|\\sum/i.test(input),
      isBatch: input.includes("\n---\n") || input.includes("===BATCH==="),
      structuredSchema: options?.structuredSchema,
    }

    const conditionalRules: string[] = []

    if (layerContext.hasHtmlMarkers) {
      appliedLayers.push("HtmlMarkerLayer")
      conditionalRules.push(
        "HTML & Marker Rule: The input contains HTML tags or placeholder markers (e.g., <ph>, <span>, &nbsp;). You MUST preserve all markers and HTML tags in their exact position without omitting, altering, or translating tag names or attributes.",
      )
    }

    if (layerContext.hasMathFormulas) {
      appliedLayers.push("MathFormulaLayer")
      conditionalRules.push(
        "Math Rule: The input contains LaTeX / math formulas ($...$, \\(...\\)). Keep all formula symbols, equations, and mathematical tokens completely untouched.",
      )
    }

    if (layerContext.isBatch) {
      appliedLayers.push("BatchLayer")
      conditionalRules.push(
        "Batch Processing Rule: The input contains batch segments separated by delimiters. Translate each segment independently and output them with the exact same delimiters in the identical order.",
      )
    }

    if (layerContext.structuredSchema) {
      appliedLayers.push("StructuredOutputLayer")
      conditionalRules.push(
        `Structured Output Rule: Your response MUST be valid JSON adhering strictly to this schema:\n${JSON.stringify(layerContext.structuredSchema, null, 2)}`,
      )
    }

    if (conditionalRules.length > 0) {
      resolvedSystem = `${resolvedSystem}\n\nConditional Directives:\n${conditionalRules.join("\n\n")}`
    }

    // ─────────────────────────────────────────────────────────────
    // Phase 4: Safe Template Interpolation
    // (Only interpolate system prompt template tokens; NOT user content)
    // ─────────────────────────────────────────────────────────────
    const variables: Record<string, string> = {
      targetLanguage: targetLanguage || "the target language",
      tone: tone || "natural and fluent",
      ...(options?.customVariables ?? {}),
    }

    let interpolatedSystem = resolvedSystem
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g")
      interpolatedSystem = interpolatedSystem.replace(regex, value)
    }

    // ─────────────────────────────────────────────────────────────
    // Phase 5: Post-appends
    // (Glossary and user inputs appended strictly AFTER interpolation)
    // ─────────────────────────────────────────────────────────────
    if (Object.keys(matchedGlossary).length > 0) {
      const glossaryLines = Object.entries(matchedGlossary)
        .map(([k, v]) => `- "${k}" -> "${v}"`)
        .join("\n")
      interpolatedSystem = `${interpolatedSystem}\n\nMatched Glossary (Use these exact translations where applicable):\n${glossaryLines}`
    }

    // Assemble messages: Few-shots -> History -> User Input
    const messages: Array<{ role: "user" | "assistant"; content: string }> = []

    // Few-shot examples
    if (profile?.fewShotExamples && profile.fewShotExamples.length > 0) {
      for (const ex of profile.fewShotExamples) {
        messages.push({ role: "user", content: ex.user })
        messages.push({ role: "assistant", content: ex.assistant })
      }
    }

    // Conversation history
    const history = options?.history ?? options?.conversation?.history ?? []
    for (const msg of history) {
      messages.push({ role: msg.role, content: msg.content })
    }

    // Current user message (Never interpolated, appended as-is)
    messages.push({ role: "user", content: input })

    return {
      system: interpolatedSystem,
      messages,
      matchedGlossary,
      appliedLayers,
    }
  }
}
