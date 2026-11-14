import type { LanguageTag } from "@read-frog/definitions"
import { useAtom } from "jotai"
import { LanguageCombobox } from "@/components/language-combobox"
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
import { Textarea } from "@/components/ui/base-ui/textarea"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../components/config-item"
import { ConfigSection } from "../../components/config-section"
import { PageLayout } from "../../components/page-layout"
import { SELECT_CONTENT_PROPS } from "../../components/select-content-props"

export function WebAssistantSettingsPage() {
  const [webChat, setWebChat] = useAtom(configFieldsAtomMap.webChat)
  const { providers, providerId, providerConfig, setProviderId } = useFeatureProvider("webChat")

  const handleUpdate = (patch: Partial<typeof webChat>) => {
    void setWebChat({
      ...webChat,
      ...patch,
    })
  }

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

      <ConfigSection title={i18n.t("options.webChat.sections.behavior")}>
        <ConfigItem
          id="webchat-tone"
          title={i18n.t("options.webChat.tone.title")}
          description={i18n.t("options.webChat.tone.description")}
        >
          <Select
            value={webChat.tone}
            onValueChange={(val) => {
              if (val) handleUpdate({ tone: val })
            }}
          >
            <SelectTrigger size="sm" className="w-56 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent {...SELECT_CONTENT_PROPS}>
              <SelectGroup>
                <SelectItem value="friendly">{i18n.t("options.webChat.tone.friendly")}</SelectItem>
                <SelectItem value="professional">
                  {i18n.t("options.webChat.tone.professional")}
                </SelectItem>
                <SelectItem value="brief">{i18n.t("options.webChat.tone.brief")}</SelectItem>
                <SelectItem value="casual">{i18n.t("options.webChat.tone.casual")}</SelectItem>
                <SelectItem value="humorous">{i18n.t("options.webChat.tone.humorous")}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </ConfigItem>

        <ConfigItem
          id="webchat-rules"
          title={i18n.t("options.webChat.rules.title")}
          description={i18n.t("options.webChat.rules.description")}
          orientation="vertical"
        >
          <Textarea
            value={webChat.rules}
            onChange={(e) => handleUpdate({ rules: e.target.value })}
            placeholder={i18n.t("options.webChat.rules.placeholder")}
            rows={4}
            className="w-full font-mono text-xs"
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
          <LanguageCombobox
            triggerSize="sm"
            className="text-xs"
            value={webChat.inboundTargetLang as LanguageTag}
            onValueChange={(val) => {
              if (val === "auto") return
              handleUpdate({ inboundTargetLang: val })
            }}
          />
        </ConfigItem>

        <ConfigItem
          id="webchat-outbound-lang"
          title={i18n.t("options.webChat.translate.outboundLangTitle")}
          description={i18n.t("options.webChat.translate.outboundLangDesc")}
        >
          <LanguageCombobox
            triggerSize="sm"
            className="text-xs"
            value={webChat.outboundTargetLang as LanguageTag}
            onValueChange={(val) => {
              if (val === "auto") return
              handleUpdate({ outboundTargetLang: val })
            }}
          />
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
