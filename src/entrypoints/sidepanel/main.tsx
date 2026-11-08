import "@/utils/zod-config"
import type { Config } from "@/types/config/config"
import type { ThemeMode } from "@/types/config/theme"
import { Provider as JotaiProvider, useAtomValue } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { configAtom } from "@/utils/atoms/config"
import { sidepanelNavTabAtom } from "@/utils/atoms/sidepanel"
import { baseThemeModeAtom } from "@/utils/atoms/theme"
import { APP_NAME } from "@/utils/constants/app"
import { getLocalConfig } from "@/utils/config/storage"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { initI18n } from "@/utils/i18n"
import { setupExtensionPageLogging } from "@/utils/logging/setup"
import { renderPersistentReactRoot } from "@/utils/react-root"
import { getLocalThemeMode } from "@/utils/theme"
import { ChatView } from "./components/chat/chat-view"
import { ReadView } from "./components/read/read-view"
import { SidePanelNavBar } from "./components/sidepanel-nav-bar"
import { TranslateView } from "./components/translate/translate-view"
import { WriteView } from "./components/write/write-view"
import "@fontsource-variable/inter/index.css"
import "@/assets/styles/text-small.css"
import "@/assets/styles/theme.css"

setupExtensionPageLogging("sidepanel")

function HydrateAtoms({
  initialValues,
  children,
}: {
  initialValues: [
    [typeof configAtom, Config],
    [typeof baseThemeModeAtom, ThemeMode],
  ]
  children: React.ReactNode
}) {
  useHydrateAtoms(initialValues)
  return children
}

function SidePanelShell() {
  const activeTab = useAtomValue(sidepanelNavTabAtom)

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground antialiased">
      <main className="flex-1 h-full overflow-hidden">
        {activeTab === "chat" && <ChatView />}
        {activeTab === "read" && <ReadView />}
        {activeTab === "write" && <WriteView />}
        {activeTab === "translate" && <TranslateView />}
        {activeTab === "history" && <ChatView />}
      </main>
      <SidePanelNavBar />
    </div>
  )
}

async function initApp() {
  const root = document.getElementById("root")!
  root.className = "h-screen w-screen overflow-hidden bg-background text-base antialiased"

  let config = DEFAULT_CONFIG
  let themeMode: ThemeMode = "system"

  try {
    const [configValue, localThemeMode] = await Promise.all([
      getLocalConfig(),
      getLocalThemeMode(),
    ])
    if (configValue) config = configValue
    if (localThemeMode) themeMode = localThemeMode
  } catch (error) {
    console.warn("[SidePanel] Failed to load config or theme from storage, using defaults:", error)
  }

  try {
    await initI18n(config.uiLanguage)
  } catch (error) {
    console.warn("[SidePanel] Failed to initialize i18n:", error)
  }

  renderPersistentReactRoot(
    root,
    <JotaiProvider>
      <HydrateAtoms
        initialValues={[
          [configAtom, config],
          [baseThemeModeAtom, themeMode],
        ]}
      >
        <ThemeProvider>
          <SidePanelShell />
        </ThemeProvider>
      </HydrateAtoms>
    </JotaiProvider>,
  )
}

void initApp()
