import type { HotkeyChord } from "@tanstack/hotkeys"
import { HotkeyManager } from "@tanstack/hotkeys"
import { getLocalConfig } from "@/utils/config/storage"
import { sendMessage } from "@/utils/message"
import { isShortcutEmpty, isValidShortcut } from "@/utils/shortcut"

/**
 * Binds in-page AI Side Panel shortcut key from user config.
 * When triggered, asks background script to toggle the Chrome Side Panel.
 */
export async function bindSidePanelShortcutKey() {
  try {
    const config = await getLocalConfig()
    if (!config?.sidePanel || isShortcutEmpty(config.sidePanel.shortcut)) {
      return () => {}
    }

    const shortcut = config.sidePanel.shortcut
    if (!isValidShortcut(shortcut)) {
      return () => {}
    }

    const registration = HotkeyManager.getInstance().register(
      shortcut as HotkeyChord,
      () => {
        void sendMessage("toggleSidePanel", undefined)
      },
      {
        ignoreInputs: true,
        preventDefault: true,
        stopPropagation: true,
      },
    )

    return () => {
      registration.unregister()
    }
  } catch {
    return () => {}
  }
}
