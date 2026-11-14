import type { Theme, ThemeMode, ThemeName } from "@/types/config/theme"
import i18next from "i18next"
import { useAtom } from "jotai"
import { createContext, use, useLayoutEffect, useMemo, useSyncExternalStore } from "react"
import { themeModeAtom, themeNameAtom, themeScaledAtom } from "@/utils/atoms/theme"
import { getUiLocale } from "@/utils/i18n"
import { applyTheme } from "@/utils/theme"

const THEME_MIRROR_KEY = "workmate-theme-v1"

function subscribeToLocale(callback: () => void) {
  i18next.on("languageChanged", callback)
  return () => i18next.off("languageChanged", callback)
}

interface ThemeContextI {
  theme: Theme
  themeName: ThemeName
  themeMode: ThemeMode
  scaled: boolean
  setThemeName: (theme: ThemeName) => Promise<void>
  setThemeMode: (mode: ThemeMode) => Promise<void>
  setScaled: (scaled: boolean) => Promise<void>
}

export const ThemeContext = createContext<ThemeContextI | undefined>(undefined)

export function ThemeProvider({
  children,
  container,
  forcedTheme,
}: {
  children: React.ReactNode
  container?: HTMLElement
  forcedTheme?: Theme
}) {
  const [themeMode, setThemeMode] = useAtom(themeModeAtom)
  const [themeName, setThemeName] = useAtom(themeNameAtom)
  const [scaled, setScaled] = useAtom(themeScaledAtom)
  const locale = useSyncExternalStore(subscribeToLocale, getUiLocale)

  const prefersDark = useSyncExternalStore(
    (cb) => {
      const mq = window?.matchMedia?.("(prefers-color-scheme: dark)")
      if (!mq) {
        return () => {}
      }

      mq.addEventListener("change", cb)
      return () => mq.removeEventListener("change", cb)
    },
    () => window?.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false,
  )

  const theme: Theme =
    forcedTheme ?? (themeMode === "system" ? (prefersDark ? "dark" : "light") : themeMode)

  // Apply theme to document or shadow root container
  useLayoutEffect(() => {
    const target = container ?? document.documentElement
    applyTheme(target, { theme: themeName, mode: theme, scaled }, locale)
    if (!container) {
      try {
        localStorage.setItem(
          THEME_MIRROR_KEY,
          JSON.stringify({ version: 1, theme: themeName, mode: themeMode, scaled }),
        )
      } catch {
        // The sync storage values remain authoritative when localStorage is unavailable.
      }
    }
  }, [theme, themeName, themeMode, scaled, locale, container])

  const contextValue = useMemo(
    () => ({ theme, themeName, themeMode, scaled, setThemeName, setThemeMode, setScaled }),
    [theme, themeName, themeMode, scaled, setThemeName, setThemeMode, setScaled],
  )

  return <ThemeContext value={contextValue}>{children}</ThemeContext>
}

export function useTheme(): ThemeContextI {
  const context = use(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
