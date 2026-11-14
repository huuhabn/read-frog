import type { ThemeMode, ThemeSettings } from "@/types/config/theme"
import { storage } from "#imports"
import {
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_NAME,
  DEFAULT_THEME_SCALED,
  themeNameSchema,
  themeModeSchema,
} from "@/types/config/theme"

export const themeStorage = storage.defineItem("sync:theme", {
  fallback: DEFAULT_THEME_NAME,
})

export const themeModeStorage = storage.defineItem("sync:mode", {
  fallback: DEFAULT_THEME_MODE,
})

export const themeScaledStorage = storage.defineItem("sync:scaled", {
  fallback: DEFAULT_THEME_SCALED,
})

let migrationPromise: Promise<void> | undefined

export function migrateLegacyThemeMode(): Promise<void> {
  migrationPromise ??= (async () => {
    const syncMode = await storage.getItem<unknown>("sync:mode")
    if (syncMode !== null) return

    const legacyMode = await storage.getItem<unknown>("local:theme")
    const parsedMode = themeModeSchema.safeParse(legacyMode)
    if (!parsedMode.success) return

    await themeModeStorage.setValue(parsedMode.data)
    await storage.removeItem("local:theme")
  })().catch((error) => {
    migrationPromise = undefined
    throw error
  })
  return migrationPromise
}

export async function getThemeSettings(): Promise<ThemeSettings> {
  await migrateLegacyThemeMode()
  const [theme, mode, scaled] = await Promise.all([
    themeStorage.getValue(),
    themeModeStorage.getValue(),
    themeScaledStorage.getValue(),
  ])
  return {
    theme: themeNameSchema.catch(DEFAULT_THEME_NAME).parse(theme),
    mode: themeModeSchema.catch(DEFAULT_THEME_MODE).parse(mode),
    scaled: typeof scaled === "boolean" ? scaled : DEFAULT_THEME_SCALED,
  }
}

export async function getThemeMode(): Promise<ThemeMode> {
  return (await getThemeSettings()).mode
}

export function resetThemeMigrationForTests() {
  migrationPromise = undefined
}
