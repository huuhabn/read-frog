import { useAtom, useAtomValue } from "jotai"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { Switch } from "@/components/ui/base-ui/switch"
import { isLLMProviderConfig } from "@/types/config/provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"

const ATTEMPT_OPTIONS = [1, 2, 3] as const

export function AutomaticRoutingConfig() {
  const [gateway, setGateway] = useAtom(configFieldsAtomMap.aiGateway)
  const providers = useAtomValue(configFieldsAtomMap.providersConfig).filter(
    (provider) => provider.enabled && isLLMProviderConfig(provider),
  )
  const excluded = new Set(gateway.excludedProviderIds)

  return (
    <ConfigSection
      id="automatic-ai-routing"
      title={i18n.t("options.apiProviders.automaticRouting.title")}
    >
      <ConfigItem
        title={i18n.t("options.apiProviders.automaticRouting.enabled")}
        description={i18n.t("options.apiProviders.automaticRouting.enabledDescription")}
      >
        <Switch
          checked={gateway.enabled}
          onCheckedChange={(enabled) => void setGateway({ enabled })}
        />
      </ConfigItem>

      <ConfigItem
        title={i18n.t("options.apiProviders.automaticRouting.maxAttempts")}
        description={i18n.t("options.apiProviders.automaticRouting.maxAttemptsDescription")}
      >
        <Select
          value={gateway.maxAttempts}
          disabled={!gateway.enabled}
          onValueChange={(value) => {
            if (value !== null) void setGateway({ maxAttempts: value })
          }}
        >
          <SelectTrigger aria-label={i18n.t("options.apiProviders.automaticRouting.maxAttempts")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ATTEMPT_OPTIONS.map((attempts) => (
              <SelectItem key={attempts} value={attempts}>
                {attempts}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ConfigItem>

      {providers.length > 1 && (
        <ConfigItem
          title={i18n.t("options.apiProviders.automaticRouting.fallbackProviders")}
          description={i18n.t("options.apiProviders.automaticRouting.fallbackProvidersDescription")}
          orientation="vertical"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {providers.map((provider) => {
              const allowed = !excluded.has(provider.id)
              return (
                <label
                  key={provider.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2"
                >
                  <span className="min-w-0 truncate text-sm">{provider.name}</span>
                  <Switch
                    aria-label={i18n.t("options.apiProviders.automaticRouting.allowProvider", [
                      provider.name,
                    ])}
                    checked={allowed}
                    disabled={!gateway.enabled}
                    onCheckedChange={(checked) => {
                      const next = new Set(gateway.excludedProviderIds)
                      if (checked) next.delete(provider.id)
                      else next.add(provider.id)
                      void setGateway({ excludedProviderIds: [...next] })
                    }}
                  />
                </label>
              )
            })}
          </div>
        </ConfigItem>
      )}
    </ConfigSection>
  )
}
