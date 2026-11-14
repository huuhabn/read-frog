export interface PlaceholderExtractionResult {
  text: string
  placeholders: Record<string, string>
}

const MENTION_REGEX = /(@[a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF.-]+)/g
const URL_REGEX = /(https?:\/\/[^\s]+)/g
const CODE_REGEX = /(```[\s\S]*?```|`[^`]+`)/g

/**
 * Replaces mentions, URLs, and code blocks with placeholders before passing to translation engine.
 */
export function extractPlaceholders(rawText: string): PlaceholderExtractionResult {
  if (!rawText) {
    return { text: rawText, placeholders: {} }
  }

  const placeholders: Record<string, string> = {}
  let counter = 0
  let processed = rawText

  // 1. Code blocks
  processed = processed.replace(CODE_REGEX, (match) => {
    const key = `__CODE_${counter++}__`
    placeholders[key] = match
    return key
  })

  // 2. URLs
  processed = processed.replace(URL_REGEX, (match) => {
    const key = `__URL_${counter++}__`
    placeholders[key] = match
    return key
  })

  // 3. Mentions
  processed = processed.replace(MENTION_REGEX, (match) => {
    const key = `__MENTION_${counter++}__`
    placeholders[key] = match
    return key
  })

  return { text: processed, placeholders }
}

/**
 * Restores extracted placeholders back into the translated text.
 */
export function restorePlaceholders(
  translatedText: string,
  placeholders: Record<string, string>,
): string {
  if (!translatedText || !placeholders || Object.keys(placeholders).length === 0) {
    return translatedText
  }

  let result = translatedText
  for (const [key, value] of Object.entries(placeholders)) {
    result = result.split(key).join(value)
  }

  return result
}
