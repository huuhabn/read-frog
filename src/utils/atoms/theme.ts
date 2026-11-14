import type { ThemeMode, ThemeName } from "@/types/config/theme"
import { atom } from "jotai"
import { DEFAULT_THEME_MODE, DEFAULT_THEME_NAME, DEFAULT_THEME_SCALED } from "@/types/config/theme"
import { createLogger } from "@/utils/logging/logger"
import {
  getThemeSettings,
  themeModeStorage,
  themeScaledStorage,
  themeStorage,
} from "@/utils/theme-storage"

const log = createLogger("atoms/theme")

function persistedAtom<T>(
  fallback: T,
  load: () => Promise<T>,
  save: (value: T) => Promise<void>,
  watch: (callback: (value: T) => void) => () => void,
) {
  const baseAtom = atom(fallback)
  const publicAtom = atom(
    (get) => get(baseAtom),
    async (get, set, value: T) => {
      const previous = get(baseAtom)
      set(baseAtom, value)
      try {
        await save(value)
      } catch (error) {
        set(baseAtom, previous)
        log.error("Failed to persist theme setting", { error })
      }
    },
  )
  baseAtom.onMount = (set) => {
    void load()
      .then(set)
      .catch((error) => log.warn("Failed to load theme setting", { error }))
    return watch(set)
  }
  return { baseAtom, publicAtom }
}

const mode = persistedAtom<ThemeMode>(
  DEFAULT_THEME_MODE,
  async () => (await getThemeSettings()).mode,
  (value) => themeModeStorage.setValue(value),
  (callback) => themeModeStorage.watch(callback),
)
const name = persistedAtom<ThemeName>(
  DEFAULT_THEME_NAME,
  async () => (await getThemeSettings()).theme,
  (value) => themeStorage.setValue(value),
  (callback) => themeStorage.watch(callback),
)
const scaled = persistedAtom<boolean>(
  DEFAULT_THEME_SCALED,
  async () => (await getThemeSettings()).scaled,
  (value) => themeScaledStorage.setValue(value),
  (callback) => themeScaledStorage.watch(callback),
)

export const baseThemeModeAtom = mode.baseAtom
export const themeModeAtom = mode.publicAtom
export const baseThemeNameAtom = name.baseAtom
export const themeNameAtom = name.publicAtom
export const baseThemeScaledAtom = scaled.baseAtom
export const themeScaledAtom = scaled.publicAtom
