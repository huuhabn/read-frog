import { useAtom } from "jotai"
import { Textarea } from "@/components/ui/base-ui/textarea"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { DEFAULT_TRANSLATE_SYSTEM_PROMPT } from "@/utils/constants/prompt"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"

export function SystemPromptSection() {
  const [inputTranslation, setInputTranslation] = useAtom(configFieldsAtomMap.inputTranslation)
  const isDefault = inputTranslation.systemPrompt === DEFAULT_TRANSLATE_SYSTEM_PROMPT

  return (
    <ConfigSection
      id="input-translation-system-prompt"
      title={i18n.t("options.inputTranslation.systemPrompt.title")}
    >
      <ConfigItem
        orientation="vertical"
        title={i18n.t("options.inputTranslation.systemPrompt.prompt.title")}
        description={i18n.t("options.inputTranslation.systemPrompt.prompt.description")}
      >
        <div className="flex w-full flex-col gap-2">
          <Textarea
            value={inputTranslation.systemPrompt}
            onChange={(e) => {
              void setInputTranslation({ ...inputTranslation, systemPrompt: e.target.value })
            }}
            rows={8}
            className="w-full font-mono text-xs"
          />
          {!isDefault && (
            <button
              type="button"
              className="self-end text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                void setInputTranslation({
                  ...inputTranslation,
                  systemPrompt: DEFAULT_TRANSLATE_SYSTEM_PROMPT,
                })
              }}
            >
              {i18n.t("options.inputTranslation.systemPrompt.resetToDefault")}
            </button>
          )}
        </div>
      </ConfigItem>
    </ConfigSection>
  )
}
