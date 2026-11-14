import {
  CCCD_REGEX,
  EMAIL_REGEX,
  PHONE_REGEX,
  type PiiType,
  STK_STANDALONE_REGEX,
  STK_WITH_PREFIX_REGEX,
} from "./patterns"

export interface PiiMaskResult {
  masked: string
  map: Record<string, string>
  piiCount: number
}

export interface MaskOptions {
  maskPhone?: boolean
  maskBankStk?: boolean
  maskCccd?: boolean
  maskEmail?: boolean
  /** If true, identical values will get the same placeholder tag across the text */
  preserveIdentity?: boolean
}

const DEFAULT_OPTIONS: Required<MaskOptions> = {
  maskPhone: true,
  maskBankStk: true,
  maskCccd: true,
  maskEmail: true,
  preserveIdentity: true,
}

export function maskPII(text: string, options?: MaskOptions): PiiMaskResult {
  if (!text) {
    return { masked: text, map: {}, piiCount: 0 }
  }

  const opts = { ...DEFAULT_OPTIONS, ...options }
  const map: Record<string, string> = {}
  const valueToPlaceholder = new Map<string, string>()
  const counters: Record<PiiType, number> = {
    PHONE: 0,
    STK: 0,
    CCCD: 0,
    EMAIL: 0,
  }

  let result = text

  const replaceMatch = (type: PiiType, rawVal: string): string => {
    const normalized = rawVal.trim()
    if (opts.preserveIdentity && valueToPlaceholder.has(normalized)) {
      return valueToPlaceholder.get(normalized)!
    }

    counters[type]++
    const placeholder = `[${type}_${counters[type]}]`
    map[placeholder] = normalized
    if (opts.preserveIdentity) {
      valueToPlaceholder.set(normalized, placeholder)
    }
    return placeholder
  }

  // 1. Email (high specificity)
  if (opts.maskEmail) {
    result = result.replace(EMAIL_REGEX, (match) => replaceMatch("EMAIL", match))
  }

  // 2. Phone (VN phone patterns)
  if (opts.maskPhone) {
    result = result.replace(PHONE_REGEX, (match) => replaceMatch("PHONE", match))
  }

  // 3. Bank Account with prefix (e.g. "STK 1903456789")
  if (opts.maskBankStk) {
    result = result.replace(STK_WITH_PREFIX_REGEX, (fullMatch, digits) => {
      const placeholder = replaceMatch("STK", digits)
      return fullMatch.replace(digits, placeholder)
    })
  }

  // 4. CCCD (12 digits or 9 digits)
  // Ensure we don't accidentally match something already masked or parts of other placeholders
  if (opts.maskCccd) {
    result = result.replace(CCCD_REGEX, (match) => {
      // Avoid masking if already inside a placeholder bracket
      return replaceMatch("CCCD", match)
    })
  }

  // 5. Standalone STK (9-19 digits that weren't caught as CCCD/Phone)
  if (opts.maskBankStk) {
    result = result.replace(STK_STANDALONE_REGEX, (match) => {
      // Don't re-mask if it looks like timestamp or already masked
      return replaceMatch("STK", match)
    })
  }

  const piiCount = Object.keys(map).length
  return { masked: result, map, piiCount }
}
