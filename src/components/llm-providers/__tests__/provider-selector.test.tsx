// @vitest-environment jsdom
import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import ProviderSelector from "../provider-selector"

vi.mock("@/components/providers/theme-provider", () => ({
  useTheme: () => ({ theme: "light" as const, setTheme: vi.fn<() => void>() }),
}))

describe("ProviderSelector null-safety", () => {
  it("renders placeholder without crashing when value is empty or not found", () => {
    render(
      <ProviderSelector
        providers={[]}
        value=""
        onChange={vi.fn<(id: string) => void>()}
        placeholder="Select a provider"
      />,
    )

    expect(screen.getByText("Select a provider")).toBeInTheDocument()
  })

  it("renders placeholder when value does not match any provider in list", () => {
    const mockProviders: ProviderSelectorOption[] = [
      {
        id: "p1",
        name: "Test Provider",
        provider: "google",
        enabled: true,
      } as unknown as ProviderSelectorOption,
    ]

    render(
      <ProviderSelector
        providers={mockProviders}
        value="unknown-provider-id"
        onChange={vi.fn<(id: string) => void>()}
        placeholder="Choose provider"
      />,
    )

    expect(screen.getByText("Choose provider")).toBeInTheDocument()
  })
})
