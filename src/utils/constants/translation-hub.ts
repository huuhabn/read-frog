// The Translate page lives at its own extension page. Every entry point
// (popup button, options sidebar, keyboard shortcut) opens this path.
export const TRANSLATE_PAGE_PATH = "/translate.html"
export const TRANSLATION_HUB_PAGE_PATH = TRANSLATE_PAGE_PATH

// Three keys on purpose: the translate page is opened far less often than the reading
// shortcuts, so it takes the roomier `Alt+Shift+` prefix rather than a bare
// `Alt+<letter>` that users would rather keep for something else.
export const DEFAULT_TRANSLATE_SHORTCUT_KEY = "Alt+Shift+H"
export const DEFAULT_TRANSLATION_HUB_SHORTCUT_KEY = DEFAULT_TRANSLATE_SHORTCUT_KEY
