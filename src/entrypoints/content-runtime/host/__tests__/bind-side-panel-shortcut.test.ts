import { beforeEach, describe, expect, it, vi } from "vitest"
import { bindSidePanelShortcutKey } from "../bind-side-panel-shortcut"

const { mockGetLocalConfig, mockRegister, mockUnregister, mockSendMessage } = vi.hoisted(() => ({
  mockGetLocalConfig: vi.fn<(...args: any[]) => any>(),
  mockRegister: vi.fn<(...args: any[]) => any>(),
  mockUnregister: vi.fn<(...args: any[]) => any>(),
  mockSendMessage: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@tanstack/hotkeys", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/hotkeys")>()
  return {
    ...actual,
    HotkeyManager: {
      getInstance: () => ({
        register: mockRegister,
      }),
    },
  }
})

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: mockGetLocalConfig,
}))

vi.mock("@/utils/message", () => ({
  sendMessage: mockSendMessage,
}))

describe("bindSidePanelShortcutKey", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRegister.mockReturnValue({
      unregister: mockUnregister,
    })
  })

  it("registers the side panel shortcut with TanStack hotkeys", async () => {
    mockGetLocalConfig.mockResolvedValue({
      sidePanel: {
        shortcut: "Alt+Shift+S",
      },
    })

    const cleanup = await bindSidePanelShortcutKey()

    expect(mockRegister).toHaveBeenCalledWith(
      "Alt+Shift+S",
      expect.any(Function),
      {
        ignoreInputs: true,
        preventDefault: true,
        stopPropagation: true,
      },
    )

    // Trigger registered callback
    const registeredCallback = mockRegister.mock.calls[0]?.[1]
    expect(registeredCallback).toBeDefined()
    registeredCallback!()
    expect(mockSendMessage).toHaveBeenCalledWith("toggleSidePanel", undefined)

    // Call cleanup
    cleanup()
    expect(mockUnregister).toHaveBeenCalled()
  })

  it("does not register when shortcut is empty or config is missing", async () => {
    mockGetLocalConfig.mockResolvedValue({
      sidePanel: {
        shortcut: "",
      },
    })

    const cleanup = await bindSidePanelShortcutKey()
    expect(mockRegister).not.toHaveBeenCalled()
    expect(cleanup).toBeInstanceOf(Function)
  })
})
