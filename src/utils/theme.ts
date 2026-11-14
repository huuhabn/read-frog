import type { Theme, ThemeMode, ThemeSettings } from "@/types/config/theme"
import { DEFAULT_THEME_NAME, DEFAULT_THEME_SCALED } from "@/types/config/theme"
import { getThemeMode } from "./theme-storage"

export function isDarkMode(themeMode: ThemeMode = "system"): boolean {
  if (themeMode === "system") {
    return (
      typeof window !== "undefined" &&
      (window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false)
    )
  }
  return themeMode === "dark"
}

const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"])

export function getTextDirection(locale: string): "ltr" | "rtl" {
  const language = locale.trim().toLowerCase().split(/[-_]/)[0] ?? ""
  return RTL_LANGUAGES.has(language) ? "rtl" : "ltr"
}

export function resolveThemeMode(mode: ThemeMode): Theme {
  return isDarkMode(mode) ? "dark" : "light"
}

export function applyTheme(
  target: HTMLElement,
  settingsOrTheme: ThemeSettings | Theme,
  locale = document.documentElement.lang || "en",
) {
  const settings: ThemeSettings =
    typeof settingsOrTheme === "string"
      ? { theme: DEFAULT_THEME_NAME, mode: settingsOrTheme, scaled: DEFAULT_THEME_SCALED }
      : settingsOrTheme
  const resolvedMode = resolveThemeMode(settings.mode)

  target.dataset.theme = settings.theme
  target.classList.toggle("dark", resolvedMode === "dark")
  target.classList.toggle("theme-scaled", settings.scaled)
  target.dir = getTextDirection(locale)
  target.style.colorScheme = resolvedMode
}

export function initDocumentTheme(root: HTMLElement = document.documentElement) {
  if (typeof document === "undefined" || !root) return
  let value: { version?: number; theme?: string; mode?: string; scaled?: boolean } | null = null
  try {
    const raw = localStorage.getItem("workmate-theme-v1")
    if (raw) {
      value = JSON.parse(raw) as {
        version?: number
        theme?: string
        mode?: string
        scaled?: boolean
      }
    }
  } catch {}

  const mode: ThemeMode =
    value?.version === 1 && typeof value.mode === "string" ? (value.mode as ThemeMode) : "system"
  const dark = isDarkMode(mode)
  root.dataset.theme = value?.theme === "default" ? value.theme : "default"
  root.classList.toggle("dark", dark)
  root.classList.toggle("theme-scaled", value?.version === 1 && value.scaled === true)
  root.style.colorScheme = dark ? "dark" : "light"
}

export async function getLocalThemeMode(): Promise<ThemeMode> {
  try {
    return await getThemeMode()
  } catch {
    return "system"
  }
}
