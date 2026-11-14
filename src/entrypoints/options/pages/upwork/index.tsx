import { useAtom, useAtomValue } from "jotai"
import { useMemo } from "react"
import { Input } from "@/components/ui/base-ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { Switch } from "@/components/ui/base-ui/switch"
import { Textarea } from "@/components/ui/base-ui/textarea"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { getSelectableProvidersForCapability } from "@/utils/providers/provider-registry"
import { UPWORK_TRANSLATE_LANGUAGES } from "@/utils/sidepanel/upwork"
import { ConfigItem } from "../../components/config-item"
import { ConfigSection } from "../../components/config-section"
import { PageLayout } from "../../components/page-layout"
import { SELECT_CONTENT_PROPS } from "../../components/select-content-props"

export function UpworkSettingsPage() {
  const [upwork, setUpwork] = useAtom(configFieldsAtomMap.upwork)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

  const translationProviders = useMemo(
    () => getSelectableProvidersForCapability("pageTranslation", providersConfig),
    [providersConfig],
  )

  const handleUpdate = (patch: Partial<typeof upwork>) => {
    void setUpwork({
      ...upwork,
      ...patch,
    })
  }

  const toneOptions = [
    { value: "professional", label: i18n.t("options.upwork.parametersSection.tones.professional") },
    { value: "concise", label: i18n.t("options.upwork.parametersSection.tones.concise") },
    { value: "friendly", label: i18n.t("options.upwork.parametersSection.tones.friendly") },
    { value: "enthusiastic", label: i18n.t("options.upwork.parametersSection.tones.enthusiastic") },
  ]

  return (
    <PageLayout
      title={i18n.t("options.upwork.title")}
      description={i18n.t("options.upwork.pageDescription")}
      innerClassName="flex flex-col gap-8"
    >
      <ConfigItem
        id="upwork-enable"
        title={i18n.t("options.upwork.enable.title")}
        description={i18n.t("options.upwork.enable.description")}
      >
        <Switch
          checked={upwork.enabled}
          onCheckedChange={(checked) => handleUpdate({ enabled: checked })}
        />
      </ConfigItem>

      <ConfigSection
        id="upwork-profile-section"
        title={i18n.t("options.upwork.profileSection.title")}
      >
        <ConfigItem
          id="upwork-profile"
          title={i18n.t("options.upwork.profileSection.titleField")}
          description={i18n.t("options.upwork.profileSection.descriptionField")}
          orientation="vertical"
        >
          <Textarea
            value={upwork.profile}
            onChange={(e) => handleUpdate({ profile: e.target.value })}
            placeholder={i18n.t("options.upwork.profileSection.placeholder")}
            rows={7}
            className="w-full font-mono text-xs"
          />
        </ConfigItem>
      </ConfigSection>

      <ConfigSection
        id="upwork-parameters-section"
        title={i18n.t("options.upwork.parametersSection.title")}
      >
        <ConfigItem
          id="upwork-word-count"
          title={i18n.t("options.upwork.parametersSection.wordCountTitle")}
          description={i18n.t("options.upwork.parametersSection.wordCountDesc")}
        >
          <Input
            type="number"
            min={50}
            max={1000}
            step={25}
            value={upwork.wordCount}
            onChange={(e) => {
              const val = Number.parseInt(e.target.value, 10)
              if (!Number.isNaN(val) && val >= 30) {
                handleUpdate({ wordCount: val })
              }
            }}
            className="w-28 text-right font-mono text-xs"
          />
        </ConfigItem>

        <ConfigItem
          id="upwork-tone"
          title={i18n.t("options.upwork.parametersSection.toneTitle")}
          description={i18n.t("options.upwork.parametersSection.toneDesc")}
        >
          <Select
            value={upwork.tone}
            onValueChange={(val) => {
              if (val) handleUpdate({ tone: val })
            }}
          >
            <SelectTrigger size="sm" className="w-56 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent {...SELECT_CONTENT_PROPS}>
              <SelectGroup>
                {toneOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </ConfigItem>

        <ConfigItem
          id="upwork-rules"
          title={i18n.t("options.upwork.parametersSection.rulesTitle")}
          description={i18n.t("options.upwork.parametersSection.rulesDesc")}
          orientation="vertical"
        >
          <Textarea
            value={upwork.rules}
            onChange={(e) => handleUpdate({ rules: e.target.value })}
            placeholder={i18n.t("options.upwork.parametersSection.rulesPlaceholder")}
            rows={5}
            className="w-full font-mono text-xs"
          />
        </ConfigItem>

        <ConfigItem
          id="upwork-examples"
          title={i18n.t("options.upwork.parametersSection.examplesTitle")}
          description={i18n.t("options.upwork.parametersSection.examplesDesc")}
          orientation="vertical"
        >
          <Textarea
            value={upwork.examples}
            onChange={(e) => handleUpdate({ examples: e.target.value })}
            placeholder={i18n.t("options.upwork.parametersSection.examplesPlaceholder")}
            rows={5}
            className="w-full font-mono text-xs"
          />
        </ConfigItem>
      </ConfigSection>

      <ConfigSection
        id="upwork-translation-section"
        title={i18n.t("options.upwork.parametersSection.translateLangTitle")}
      >
        <ConfigItem
          id="upwork-translate-lang"
          title={i18n.t("options.upwork.parametersSection.translateLangTitle")}
          description={i18n.t("options.upwork.parametersSection.translateLangDesc")}
        >
          <Select
            value={upwork.translateLang || "en"}
            onValueChange={(val) => {
              if (val) handleUpdate({ translateLang: val })
            }}
          >
            <SelectTrigger size="sm" className="w-56 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent {...SELECT_CONTENT_PROPS}>
              <SelectGroup>
                {UPWORK_TRANSLATE_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {i18n.t(lang.labelKey)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </ConfigItem>

        <ConfigItem
          id="upwork-translate-provider"
          title={i18n.t("options.upwork.parametersSection.translateProviderTitle")}
          description={i18n.t("options.upwork.parametersSection.translateProviderDesc")}
        >
          <Select
            value={upwork.translateProviderId || "auto"}
            onValueChange={(val) => {
              handleUpdate({ translateProviderId: val === "auto" || !val ? "" : val })
            }}
          >
            <SelectTrigger size="sm" className="w-56 text-xs">
              <SelectValue
                placeholder={i18n.t("options.upwork.parametersSection.translateProviderAuto")}
              />
            </SelectTrigger>
            <SelectContent {...SELECT_CONTENT_PROPS}>
              <SelectGroup>
                <SelectItem value="auto">
                  {i18n.t("options.upwork.parametersSection.translateProviderAuto")}
                </SelectItem>
                {translationProviders.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name || p.id}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </ConfigItem>
      </ConfigSection>

      <ConfigSection
        id="upwork-selectors-section"
        title={i18n.t("options.upwork.selectorsSection.title")}
      >
        <ConfigItem
          id="upwork-job-details-selector"
          title={i18n.t("options.upwork.selectorsSection.jobDetailsSelectorTitle")}
          description={i18n.t("options.upwork.selectorsSection.jobDetailsSelectorDesc")}
          orientation="vertical"
        >
          <Input
            value={upwork.jobDetailsSelector}
            onChange={(e) => handleUpdate({ jobDetailsSelector: e.target.value })}
            className="w-full font-mono text-xs"
            placeholder='[data-test="Description"] .air3-truncation, .job-description'
          />
        </ConfigItem>

        <ConfigItem
          id="upwork-screening-selector"
          title={i18n.t("options.upwork.selectorsSection.screeningQuestionsSelectorTitle")}
          description={i18n.t("options.upwork.selectorsSection.screeningQuestionsSelectorDesc")}
          orientation="vertical"
        >
          <Input
            value={upwork.screeningQuestionsSelector}
            onChange={(e) => handleUpdate({ screeningQuestionsSelector: e.target.value })}
            className="w-full font-mono text-xs"
            placeholder='[data-test="qa-group"] .question-text, .screening-questions'
          />
        </ConfigItem>

        <ConfigItem
          id="upwork-cover-letter-selector"
          title={i18n.t("options.upwork.selectorsSection.coverLetterInputSelectorTitle")}
          description={i18n.t("options.upwork.selectorsSection.coverLetterInputSelectorDesc")}
          orientation="vertical"
        >
          <Input
            value={upwork.coverLetterInputSelector}
            onChange={(e) => handleUpdate({ coverLetterInputSelector: e.target.value })}
            className="w-full font-mono text-xs"
            placeholder='textarea[data-test="cover-letter-text"]'
          />
        </ConfigItem>
      </ConfigSection>
    </PageLayout>
  )
}
