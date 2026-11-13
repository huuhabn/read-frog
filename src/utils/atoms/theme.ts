import type { ThemeMode } from "@/types/config/theme"
import { atom } from "jotai"
import { DEFAULT_THEME_MODE, themeModeSchema } from "@/types/config/theme"
import {
  isExtensionContextAlive,
  isExtensionContextInvalidatedError,
} from "@/utils/error/extension-context"
import { createLogger } from "@/utils/logging/logger"
import { THEME_STORAGE_KEY } from "../constants/config"
import { storageAdapter } from "./storage-adapter"

const log = createLogger("atoms/theme")

// Private base atom. Only export this for top-level hydration before ThemeProvider mounts.
export const baseThemeModeAtom = atom<ThemeMode>(DEFAULT_THEME_MODE)

// Public atom with read/write - write always goes through storageAdapter
export const themeModeAtom = atom(
  (get) => get(baseThemeModeAtom),
  async (get, set, newValue: ThemeMode) => {
    const prev = get(baseThemeModeAtom)
    set(baseThemeModeAtom, newValue)
    try {
      await storageAdapter.set(THEME_STORAGE_KEY, newValue, themeModeSchema)
    } catch (error) {
      log.error("Failed to persist theme mode", { themeMode: newValue, error })
      set(baseThemeModeAtom, prev)
    }
  },
)

baseThemeModeAtom.onMount = (setAtom: (newValue: ThemeMode) => void) => {
  if (!isExtensionContextAlive()) return () => {}

  void storageAdapter
    .get<ThemeMode>(THEME_STORAGE_KEY, DEFAULT_THEME_MODE, themeModeSchema)
    .then(setAtom)
    .catch((error) => {
      if (!isExtensionContextInvalidatedError(error)) {
        log.warn("Failed to load theme preference", { error })
      }
    })

  const unwatch = storageAdapter.watch<ThemeMode>(THEME_STORAGE_KEY, setAtom)

  const handleVisibilityChange = () => {
    if (!isExtensionContextAlive()) {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      return
    }
    if (document.visibilityState === "visible") {
      log.debug("baseThemeModeAtom reloaded on visibility change")
      void storageAdapter
        .get<ThemeMode>(THEME_STORAGE_KEY, DEFAULT_THEME_MODE, themeModeSchema)
        .then(setAtom)
        .catch((error) => {
          if (!isExtensionContextInvalidatedError(error)) {
            log.warn("Failed to refresh theme preference", { error })
          }
        })
    }
  }
  document.addEventListener("visibilitychange", handleVisibilityChange)

  return () => {
    unwatch()
    document.removeEventListener("visibilitychange", handleVisibilityChange)
  }
}
