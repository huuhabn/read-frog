// @vitest-environment jsdom

import type { Config } from "@/types/config/config"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { DEFAULT_TRANSLATE_SYSTEM_PROMPT } from "@/utils/constants/prompt"
import { SystemPromptSection } from "../system-prompt"

const { inputTranslationAtom, setInputTranslationMock, testState } = vi.hoisted(() => ({
  inputTranslationAtom: {},
  setInputTranslationMock: vi.fn<(value: Config["inputTranslation"]) => Promise<void>>(),
  testState: {
    inputTranslation: null as Config["inputTranslation"] | null,
  },
}))

vi.mock("jotai", () => ({
  useAtom: (atom: object) => {
    if (atom !== inputTranslationAtom || !testState.inputTranslation) {
      throw new Error("Unexpected atom")
    }
    return [testState.inputTranslation, setInputTranslationMock]
  },
}))

vi.mock("@/utils/atoms/config", () => ({
  configFieldsAtomMap: {
    inputTranslation: inputTranslationAtom,
  },
}))

describe("SystemPromptSection", () => {
  beforeEach(() => {
    testState.inputTranslation = structuredClone(DEFAULT_CONFIG.inputTranslation)
    setInputTranslationMock.mockReset()
    setInputTranslationMock.mockResolvedValue()
  })

  it("renders default system prompt without reset button when prompt matches default", () => {
    render(<SystemPromptSection />)
    const textarea = screen.getByRole("textbox")
    expect(textarea).toHaveValue(DEFAULT_TRANSLATE_SYSTEM_PROMPT)
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("updates system prompt when user types", () => {
    const inputTranslation = testState.inputTranslation!
    render(<SystemPromptSection />)
    const textarea = screen.getByRole("textbox")

    fireEvent.change(textarea, { target: { value: "Custom system prompt" } })

    expect(setInputTranslationMock).toHaveBeenCalledWith({
      ...inputTranslation,
      systemPrompt: "Custom system prompt",
    })
  })

  it("shows reset button when prompt differs from default and resets on click", () => {
    const inputTranslation = testState.inputTranslation!
    inputTranslation.systemPrompt = "Custom system prompt"

    render(<SystemPromptSection />)
    const button = screen.getByRole("button")
    expect(button).toBeDefined()

    fireEvent.click(button)

    expect(setInputTranslationMock).toHaveBeenCalledWith({
      ...inputTranslation,
      systemPrompt: DEFAULT_TRANSLATE_SYSTEM_PROMPT,
    })
  })
})
