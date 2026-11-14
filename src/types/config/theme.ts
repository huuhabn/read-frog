import { z } from "zod"

export const themeModes = ["system", "light", "dark"] as const
export type ThemeMode = (typeof themeModes)[number]
export const themeModeSchema = z.enum(themeModes)
export type Theme = "light" | "dark"
export const themeNames = ["default", "poli"] as const
export type ThemeName = (typeof themeNames)[number]
export const themeNameSchema = z.enum(themeNames)

export interface ThemeSettings {
  theme: ThemeName
  mode: ThemeMode
  scaled: boolean
}

export const THEMES = {
  default: { name: "Default", color: "#18181b" },
  poli: { name: "Poli", color: "#14a800" },
} as const satisfies Record<ThemeName, { name: string; color: string }>

export const DEFAULT_THEME_NAME: ThemeName = "default"
export const DEFAULT_THEME_MODE: ThemeMode = "system"
export const DEFAULT_THEME_SCALED = false
