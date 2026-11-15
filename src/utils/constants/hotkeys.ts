export const HOTKEYS = ["control", "alt", "shift", "backtick", "clickAndHold", "custom"] as const
export type NodeHotkey = (typeof HOTKEYS)[number]

// The single-key hotkeys, by the `KeyboardEvent.key` each one listens for
export const HOTKEY_EVENT_KEYS = {
  control: "Control",
  alt: "Alt",
  shift: "Shift",
  backtick: "`",
} as const satisfies Partial<Record<NodeHotkey, string>>

export type SingleKeyHotkey = keyof typeof HOTKEY_EVENT_KEYS

export const HOTKEY_ICONS: Record<SingleKeyHotkey, string> = {
  control: "⌃",
  alt: "⌥",
  shift: "⇧",
  backtick: "`",
}

export function isSingleKeyHotkey(hotkey: NodeHotkey): hotkey is SingleKeyHotkey {
  return Object.hasOwn(HOTKEY_EVENT_KEYS, hotkey)
}

export const DEFAULT_NODE_TRANSLATION_SHORTCUT_KEY = "Alt+Q"
