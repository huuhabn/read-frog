import { useAtom } from "jotai"
import ProviderSelector from "@/components/llm-providers/provider-selector"
import { SetApiKeyWarning } from "@/components/llm-providers/set-api-key-warning"
import { useFeatureProvider } from "@/components/llm-providers/use-feature-providers"
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
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { UPWORK_TRANSLATE_LANGUAGES } from "@/utils/sidepanel/upwork"
import { ConfigItem } from "../../components/config-item"
import { ConfigSection } from "../../components/config-section"
import { PageLayout } from "../../components/page-layout"
import { SELECT_CONTENT_PROPS } from "../../components/select-content-props"

export function WebChatSettingsPage() {
  const [webChat, setWebChat] = useAtom(configFieldsAtomMap.webChat)
  const { providers, providerId, providerConfig, setProviderId } = useFeatureProvider("webChat")

  const handleUpdate = (patch: Partial<typeof webChat>) => {
    void setWebChat({
      ...webChat,
      ...patch,
    })
  }

  const translateLangs = UPWORK_TRANSLATE_LANGUAGES.filter((l) => l.code !== "original")

  return (
    <PageLayout
      title={i18n.t("options.webChat.title")}
      description={i18n.t("options.webChat.pageDescription")}
      innerClassName="flex flex-col gap-8"
    >
      <ConfigItem
        id="webchat-enable"
        title={i18n.t("options.webChat.enable.title")}
        description={i18n.t("options.webChat.enable.description")}
      >
        <Switch
          checked={webChat.enabled}
          onCheckedChange={(checked) => handleUpdate({ enabled: checked })}
        />
      </ConfigItem>

      <ConfigSection title={i18n.t("options.webChat.sections.provider")}>
        <ConfigItem
          id="webchat-provider"
          title={
            <span className="flex flex-wrap items-center gap-2">
              {i18n.t("options.webChat.provider.title")}
              <SetApiKeyWarning providerConfig={providerConfig} />
            </span>
          }
          description={i18n.t("options.webChat.provider.description")}
        >
          <ProviderSelector
            providers={providers}
            value={providerId}
            onChange={setProviderId}
            triggerSize="sm"
            placeholder={i18n.t("options.webChat.provider.placeholder")}
            selectContentProps={SELECT_CONTENT_PROPS}
          />
        </ConfigItem>
      </ConfigSection>

      <ConfigSection title={i18n.t("options.webChat.sections.realtimeTranslate")}>
        <ConfigItem
          id="webchat-translate-enable"
          title={i18n.t("options.webChat.translate.inboundEnableTitle")}
          description={i18n.t("options.webChat.translate.inboundEnableDesc")}
        >
          <Switch
            checked={webChat.translateEnabled}
            onCheckedChange={(checked) => handleUpdate({ translateEnabled: checked })}
          />
        </ConfigItem>

        <ConfigItem
          id="webchat-inbound-lang"
          title={i18n.t("options.webChat.translate.inboundLangTitle")}
          description={i18n.t("options.webChat.translate.inboundLangDesc")}
        >
          <Select
            value={webChat.inboundTargetLang}
            onValueChange={(val) => handleUpdate({ inboundTargetLang: val ?? "vi" })}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent {...SELECT_CONTENT_PROPS}>
              <SelectGroup>
                {translateLangs.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {i18n.t(lang.labelKey)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </ConfigItem>

        <ConfigItem
          id="webchat-outbound-lang"
          title={i18n.t("options.webChat.translate.outboundLangTitle")}
          description={i18n.t("options.webChat.translate.outboundLangDesc")}
        >
          <Select
            value={webChat.outboundTargetLang}
            onValueChange={(val) => handleUpdate({ outboundTargetLang: val ?? "en" })}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent {...SELECT_CONTENT_PROPS}>
              <SelectGroup>
                {translateLangs.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {i18n.t(lang.labelKey)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </ConfigItem>

        <ConfigItem
          id="webchat-context-count"
          title={i18n.t("options.webChat.translate.contextCountTitle")}
          description={i18n.t("options.webChat.translate.contextCountDesc")}
        >
          <Input
            type="number"
            min={1}
            max={20}
            className="w-24 text-center"
            value={webChat.contextMessageCount}
            onChange={(e) =>
              handleUpdate({
                contextMessageCount: Math.max(1, Math.min(20, Number(e.target.value) || 5)),
              })
            }
          />
        </ConfigItem>
      </ConfigSection>

      <ConfigSection title={i18n.t("options.webChat.sections.slashCommands")}>
        <ConfigItem
          id="webchat-slash-enable"
          title={i18n.t("options.webChat.slash.enableTitle")}
          description={i18n.t("options.webChat.slash.enableDesc")}
        >
          <Switch
            checked={webChat.slashCommandsEnabled}
            onCheckedChange={(checked) => handleUpdate({ slashCommandsEnabled: checked })}
          />
        </ConfigItem>
      </ConfigSection>

      <ConfigSection title={i18n.t("options.webChat.sections.platforms")}>
        <ConfigItem
          id="webchat-platform-zalo"
          title={i18n.t("options.webChat.platforms.zaloTitle")}
          description={i18n.t("options.webChat.platforms.zaloDesc")}
        >
          <Switch
            checked={webChat.enableZalo}
            onCheckedChange={(checked) => handleUpdate({ enableZalo: checked })}
          />
        </ConfigItem>

        <ConfigItem
          id="webchat-platform-telegram"
          title={i18n.t("options.webChat.platforms.telegramTitle")}
          description={i18n.t("options.webChat.platforms.telegramDesc")}
        >
          <Switch
            checked={webChat.enableTelegram}
            onCheckedChange={(checked) => handleUpdate({ enableTelegram: checked })}
          />
        </ConfigItem>

        <ConfigItem
          id="webchat-platform-slack"
          title={i18n.t("options.webChat.platforms.slackTitle")}
          description={i18n.t("options.webChat.platforms.slackDesc")}
        >
          <Switch
            checked={webChat.enableSlack}
            onCheckedChange={(checked) => handleUpdate({ enableSlack: checked })}
          />
        </ConfigItem>

        <ConfigItem
          id="webchat-platform-generic"
          title={i18n.t("options.webChat.platforms.genericTitle")}
          description={i18n.t("options.webChat.platforms.genericDesc")}
        >
          <Switch
            checked={webChat.enableGeneric}
            onCheckedChange={(checked) => handleUpdate({ enableGeneric: checked })}
          />
        </ConfigItem>

        <ConfigItem
          id="webchat-remote-config"
          title={i18n.t("options.webChat.platforms.remoteConfigTitle")}
          description={i18n.t("options.webChat.platforms.remoteConfigDesc")}
        >
          <Input
            className="max-w-md font-mono text-xs"
            value={webChat.remoteConfigUrl}
            onChange={(e) => handleUpdate({ remoteConfigUrl: e.target.value })}
          />
        </ConfigItem>
      </ConfigSection>

      <ConfigSection title={i18n.t("options.webChat.sections.privacy")}>
        <ConfigItem
          id="webchat-pii-enable"
          title={i18n.t("options.webChat.privacy.piiEnableTitle")}
          description={i18n.t("options.webChat.privacy.piiEnableDesc")}
        >
          <Switch
            checked={webChat.piiMaskingEnabled}
            onCheckedChange={(checked) => handleUpdate({ piiMaskingEnabled: checked })}
          />
        </ConfigItem>

        <ConfigItem
          id="webchat-pii-phone"
          title={i18n.t("options.webChat.privacy.maskPhoneTitle")}
          description={i18n.t("options.webChat.privacy.maskPhoneDesc")}
        >
          <Switch
            checked={webChat.maskPhone}
            disabled={!webChat.piiMaskingEnabled}
            onCheckedChange={(checked) => handleUpdate({ maskPhone: checked })}
          />
        </ConfigItem>

        <ConfigItem
          id="webchat-pii-stk"
          title={i18n.t("options.webChat.privacy.maskStkTitle")}
          description={i18n.t("options.webChat.privacy.maskStkDesc")}
        >
          <Switch
            checked={webChat.maskBankStk}
            disabled={!webChat.piiMaskingEnabled}
            onCheckedChange={(checked) => handleUpdate({ maskBankStk: checked })}
          />
        </ConfigItem>

        <ConfigItem
          id="webchat-pii-cccd"
          title={i18n.t("options.webChat.privacy.maskCccdTitle")}
          description={i18n.t("options.webChat.privacy.maskCccdDesc")}
        >
          <Switch
            checked={webChat.maskCccd}
            disabled={!webChat.piiMaskingEnabled}
            onCheckedChange={(checked) => handleUpdate({ maskCccd: checked })}
          />
        </ConfigItem>

        <ConfigItem
          id="webchat-pii-email"
          title={i18n.t("options.webChat.privacy.maskEmailTitle")}
          description={i18n.t("options.webChat.privacy.maskEmailDesc")}
        >
          <Switch
            checked={webChat.maskEmail}
            disabled={!webChat.piiMaskingEnabled}
            onCheckedChange={(checked) => handleUpdate({ maskEmail: checked })}
          />
        </ConfigItem>
      </ConfigSection>
    </PageLayout>
  )
}
