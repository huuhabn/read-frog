/// <reference types="@modyfi/vite-plugin-yaml/modules" />
import type { Resource } from "i18next"
import type { SupportedUiLocale } from "./locales"
import en from "@/locales/en.yml"

export type { SupportedUiLocale } from "./locales"
export { DEFAULT_UI_LOCALE, SUPPORTED_UI_LOCALES } from "./locales"

export interface LocaleTree {
  [key: string]: string | LocaleTree
}

/**
 * Convert WXT-style positional substitutions to i18next interpolation, applied to
 * every string leaf at build time:
 *   - `$$`      → literal `$`   (WXT escape; none currently in the YAML, handled anyway)
 *   - `$1`..`$9`→ `{{0}}`..`{{8}}` (0-indexed to match the facade's array mapping)
 *
 * Intentionally left untouched:
 *   - existing named tokens like `{{targetLanguage}}` (LLM prompt templates; no `$`)
 *   - Chrome context-menu placeholders like `%s`
 */
function convertPlaceholders(value: string): string {
  return value.replace(/\$\$|\$(\d)/g, (_match, digit: string | undefined) =>
    digit === undefined ? "$" : `{{${Number(digit) - 1}}}`,
  )
}

export function convertTree(node: LocaleTree): LocaleTree {
  const out: LocaleTree = {}
  for (const [key, val] of Object.entries(node)) {
    out[key] = typeof val === "string" ? convertPlaceholders(val) : convertTree(val)
  }
  return out
}

const loadedLocales: Partial<Record<SupportedUiLocale, LocaleTree>> = {
  en: convertTree(en),
}

const localeLoaders: Record<
  Exclude<SupportedUiLocale, "en">,
  () => Promise<{ default: LocaleTree }>
> = {
  az: () => import("@/locales/az.yml"),
  es: () => import("@/locales/es.yml"),
  ja: () => import("@/locales/ja.yml"),
  ko: () => import("@/locales/ko.yml"),
  ru: () => import("@/locales/ru.yml"),
  tr: () => import("@/locales/tr.yml"),
  vi: () => import("@/locales/vi.yml"),
  "zh-CN": () => import("@/locales/zh-CN.yml"),
  "zh-TW": () => import("@/locales/zh-TW.yml"),
}

export async function loadLocaleResource(locale: SupportedUiLocale): Promise<LocaleTree> {
  const existing = loadedLocales[locale]
  if (existing) {
    return existing
  }
  const loader = localeLoaders[locale as Exclude<SupportedUiLocale, "en">]
  if (!loader) {
    return loadedLocales.en!
  }
  const mod = await loader()
  const converted = convertTree(mod.default)
  loadedLocales[locale] = converted
  return converted
}

export function isLocaleLoaded(locale: SupportedUiLocale): boolean {
  return Boolean(loadedLocales[locale] || (resources as Record<string, unknown>)?.[locale])
}

const defaultResources: Resource = {
  en: { translation: loadedLocales.en! },
}

/**
 * i18next resource bundle: `{ [locale]: { translation: <nested string tree> } }`.
 * Default fallback locale ('en') is bundled statically; others are loaded on-demand.
 */
export const resources: Resource = new Proxy(defaultResources, {
  get(target, prop: string) {
    if (typeof prop !== "string") {
      return Reflect.get(target, prop)
    }
    if (prop in target) {
      return (target as Record<string, unknown>)[prop]
    }
    if (loadedLocales[prop as SupportedUiLocale]) {
      const entry = { translation: loadedLocales[prop as SupportedUiLocale]! }
      ;(target as Record<string, unknown>)[prop] = entry
      return entry
    }
    return undefined
  },
  has(target, prop: string) {
    return prop in target || prop in loadedLocales
  },
})
