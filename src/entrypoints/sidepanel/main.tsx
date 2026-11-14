performance.mark("sidepanel:script-start")

import "@/utils/zod-config"
import { createStore, Provider as JotaiProvider, useAtomValue } from "jotai"
import { lazy, Suspense, useLayoutEffect } from "react"
import { browser } from "#imports"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { configAtom } from "@/utils/atoms/config"
import { selectedChatModelAtom, sidepanelNavTabAtom } from "@/utils/atoms/sidepanel"
import { baseThemeModeAtom } from "@/utils/atoms/theme"
import { getLocalConfig } from "@/utils/config/storage"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { initI18n } from "@/utils/i18n"
import { createLogger } from "@/utils/logging/logger"
import { setupExtensionPageLogging } from "@/utils/logging/setup"
import { renderPersistentReactRoot } from "@/utils/react-root"
import {
  DEFAULT_SELECTED_CHAT_MODEL,
  getLocalSelectedChatModel,
} from "@/utils/sidepanel/chat-model-storage"
import { getLocalThemeMode, initDocumentTheme } from "@/utils/theme"
import { SidePanelNavBar } from "./components/sidepanel-nav-bar"
import "@fontsource-variable/inter/index.css"
import "@/assets/styles/text-small.css"
import "@/assets/styles/theme.css"

initDocumentTheme()
setupExtensionPageLogging("sidepanel")
const log = createLogger("sidepanel")

// Lazy-loaded Views to minimize critical bundle size
const ChatView = lazy(() =>
  import("./components/chat/chat-view").then((m) => ({ default: m.ChatView })),
)
const WebChatView = lazy(() =>
  import("./components/web-chat/WebChatView").then((m) => ({ default: m.WebChatView })),
)
const ReadView = lazy(() =>
  import("./components/read/read-view").then((m) => ({ default: m.ReadView })),
)
const WriteView = lazy(() =>
  import("./components/write/write-view").then((m) => ({ default: m.WriteView })),
)
const TranslateView = lazy(() =>
  import("./components/translate/translate-view").then((m) => ({ default: m.TranslateView })),
)

/**
 * Structural skeleton displayed while tab views load asynchronously.
 * Mimics ChatView dimensions to eliminate Cumulative Layout Shift (CLS).
 */
function SidePanelSkeleton() {
  return (
    <div className="flex h-full w-full flex-col justify-between overflow-hidden bg-background p-3 select-none">
      {/* Top Header Placeholder */}
      <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="h-6 w-24 animate-pulse rounded-md bg-muted/60" />
          <div className="h-6 w-16 animate-pulse rounded-md bg-muted/40" />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-6 animate-pulse rounded-md bg-muted/40" />
          <div className="size-6 animate-pulse rounded-md bg-muted/40" />
        </div>
      </div>

      {/* Message List Placeholder */}
      <div className="flex flex-1 flex-col gap-4 overflow-hidden py-4">
        {/* Assistant welcome message placeholder */}
        <div className="flex items-start gap-2.5">
          <div className="size-7 shrink-0 animate-pulse rounded-full bg-muted/60" />
          <div className="flex max-w-[80%] flex-col gap-2">
            <div className="h-4 w-44 animate-pulse rounded-sm bg-muted/50" />
            <div className="h-14 w-60 animate-pulse rounded-lg bg-muted/30" />
          </div>
        </div>

        {/* User prompt placeholder */}
        <div className="flex justify-end">
          <div className="h-9 w-48 animate-pulse rounded-lg bg-muted/40" />
        </div>

        {/* Assistant follow-up placeholder */}
        <div className="flex items-start gap-2.5">
          <div className="size-7 shrink-0 animate-pulse rounded-full bg-muted/60" />
          <div className="flex max-w-[80%] flex-col gap-2">
            <div className="h-4 w-32 animate-pulse rounded-sm bg-muted/50" />
            <div className="h-16 w-64 animate-pulse rounded-lg bg-muted/30" />
          </div>
        </div>
      </div>

      {/* Bottom Input Area Placeholder */}
      <div className="flex flex-col gap-2 rounded-xl border border-border/50 bg-muted/20 p-2.5">
        <div className="h-10 w-full animate-pulse rounded-md bg-muted/40" />
        <div className="flex items-center justify-between pt-1">
          <div className="flex gap-2">
            <div className="size-5 animate-pulse rounded-sm bg-muted/40" />
            <div className="size-5 animate-pulse rounded-sm bg-muted/40" />
          </div>
          <div className="h-6 w-14 animate-pulse rounded-md bg-muted/60" />
        </div>
      </div>
    </div>
  )
}

function SidePanelShell() {
  const activeTab = useAtomValue(sidepanelNavTabAtom)

  useLayoutEffect(() => {
    performance.mark("sidepanel:first-commit")
    try {
      performance.measure(
        "sidepanel:time-to-first-commit",
        "sidepanel:script-start",
        "sidepanel:first-commit",
      )
      const dataReadyMeasure = performance.getEntriesByName("sidepanel:time-to-data-ready")[0]
      const firstCommitMeasure = performance.getEntriesByName("sidepanel:time-to-first-commit")[0]
      log.info(
        `[SidePanel Perf] data-ready: ${dataReadyMeasure?.duration.toFixed(1) ?? "pending"}ms, first-commit: ${firstCommitMeasure?.duration.toFixed(1) ?? "N/A"}ms`,
      )
    } catch {}
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground antialiased">
      <main className="h-full min-w-0 flex-1 overflow-hidden">
        <Suspense fallback={<SidePanelSkeleton />}>
          {activeTab === "chat" && <ChatView />}
          {activeTab === "web-chat" && <WebChatView />}
          {activeTab === "read" && <ReadView />}
          {activeTab === "write" && <WriteView />}
          {activeTab === "translate" && <TranslateView />}
          {activeTab === "history" && <ChatView />}
        </Suspense>
      </main>
      <SidePanelNavBar />
    </div>
  )
}

function setupSidePanelConnection() {
  try {
    void browser.windows
      ?.getCurrent?.()
      .then((currentWindow) => {
        const windowId = currentWindow?.id
        const portName =
          typeof windowId === "number"
            ? `side-panel-connection:${windowId}`
            : "side-panel-connection"
        browser.runtime.connect({ name: portName })
      })
      .catch(() => {
        browser.runtime.connect({ name: "side-panel-connection" })
      })
  } catch (error) {
    log.warn("Failed to establish connection port", { error })
  }
}

// Global store initialized with defaults for instant render
const sidepanelStore = createStore()
sidepanelStore.set(configAtom, DEFAULT_CONFIG)
sidepanelStore.set(baseThemeModeAtom, "system")
sidepanelStore.set(selectedChatModelAtom, DEFAULT_SELECTED_CHAT_MODEL)

async function initApp() {
  setupSidePanelConnection()

  const root = document.getElementById("root")!
  root.className = "h-screen w-screen overflow-hidden bg-background text-base antialiased"

  // 1. Initial fast synchronous i18n
  try {
    void initI18n("auto")
  } catch {}

  // 2. Render root immediately with skeleton/defaults (Non-blocking First Paint)
  renderPersistentReactRoot(
    root,
    <JotaiProvider store={sidepanelStore}>
      <ThemeProvider>
        <SidePanelShell />
      </ThemeProvider>
    </JotaiProvider>,
  )

  // 3. Hydrate storage & locale in parallel
  try {
    const [configValue, localThemeMode, localSelectedModel] = await Promise.all([
      getLocalConfig(),
      getLocalThemeMode(),
      getLocalSelectedChatModel(),
    ])

    if (configValue) sidepanelStore.set(configAtom, configValue)
    if (localThemeMode) sidepanelStore.set(baseThemeModeAtom, localThemeMode)
    if (localSelectedModel) sidepanelStore.set(selectedChatModelAtom, localSelectedModel)

    if (configValue?.uiLanguage) {
      try {
        await initI18n(configValue.uiLanguage)
      } catch (err) {
        log.warn("Failed to update i18n language", { err })
      }
    }

    performance.mark("sidepanel:data-ready")
    try {
      performance.measure(
        "sidepanel:time-to-data-ready",
        "sidepanel:script-start",
        "sidepanel:data-ready",
      )
      const m = performance.getEntriesByName("sidepanel:time-to-data-ready")[0]
      log.info(`[SidePanel Perf] data-ready in ${m?.duration.toFixed(1)}ms`)
    } catch {}
  } catch (error) {
    log.warn("Failed to load config, theme, or selected model from storage, using defaults", {
      error,
    })
  }
}

void initApp()
