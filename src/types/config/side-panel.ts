import { z } from "zod"
import { shortcutSchema } from "./shortcut"

export const DEFAULT_SIDE_PANEL_SHORTCUT_KEY = "Alt+Shift+S"

export const sidePanelSchema = z
  .object({
    shortcut: shortcutSchema,
  })
  .default({
    shortcut: DEFAULT_SIDE_PANEL_SHORTCUT_KEY,
  })

export type SidePanelConfig = z.infer<typeof sidePanelSchema>
