// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { Provider as JotaiProvider } from "jotai"
import { describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { WebAssistantSettingsPage } from "../index"

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string) => key,
  },
  getUiLocale: () => "en",
}))

vi.mock("@/components/providers/theme-provider", () => ({
  useTheme: () => ({ theme: "light" as const, setTheme: vi.fn<() => void>() }),
}))

describe("WebAssistantSettingsPage", () => {
  it("renders all sections and default config options using i18n", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <JotaiProvider>
          <WebAssistantSettingsPage />
        </JotaiProvider>
      </QueryClientProvider>,
    )

    expect(screen.getByText("options.webChat.title")).toBeDefined()
    expect(screen.getByText("options.webChat.enable.title")).toBeDefined()
    expect(screen.getByText("options.webChat.sections.provider")).toBeDefined()
    expect(screen.getByText("options.webChat.sections.behavior")).toBeDefined()
    expect(screen.getByText("options.webChat.sections.realtimeTranslate")).toBeDefined()
    expect(screen.getByText("options.webChat.sections.slashCommands")).toBeDefined()
    expect(screen.getByText("options.webChat.sections.platforms")).toBeDefined()
    expect(screen.getByText("options.webChat.sections.privacy")).toBeDefined()

    expect(screen.getByDisplayValue(DEFAULT_CONFIG.webChat.remoteConfigUrl)).toBeDefined()
  })
})
