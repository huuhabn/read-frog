// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { Provider, createStore } from "jotai"
import { describe, expect, it, vi } from "vitest"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { AutomaticRoutingConfig } from ".."

vi.mock("@/utils/atoms/config", async () => {
  const { atom } = await vi.importActual<typeof import("jotai")>("jotai")
  return {
    configFieldsAtomMap: {
      aiGateway: atom({ enabled: true, maxAttempts: 3, excludedProviderIds: [] as string[] }),
      providersConfig: atom([
        {
          id: "primary",
          name: "Primary",
          enabled: true,
          provider: "openai",
          model: { model: "model-a", isCustomModel: false, customModel: null },
        },
        {
          id: "fallback",
          name: "Fallback",
          enabled: true,
          provider: "openai",
          model: { model: "model-b", isCustomModel: false, customModel: null },
        },
      ]),
    },
  }
})

describe("AutomaticRoutingConfig", () => {
  it("discloses cross-provider routing and persists provider exclusions", () => {
    const store = createStore()
    render(
      <Provider store={store}>
        <AutomaticRoutingConfig />
      </Provider>,
    )

    expect(
      screen.getByText("options.apiProviders.automaticRouting.enabledDescription"),
    ).toBeVisible()
    const fallback = screen.getAllByRole("switch", {
      name: "options.apiProviders.automaticRouting.allowProvider",
    })[1]
    expect(fallback).toBeDefined()
    expect(fallback).toBeChecked()
    fireEvent.click(fallback as HTMLElement)
    expect(store.get(configFieldsAtomMap.aiGateway).excludedProviderIds).toEqual(["fallback"])
  })
})
