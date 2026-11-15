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
    <ConfigSection id="automatic-ai-routing" title="Automatic AI routing">
      <ConfigItem
        title="Use fallback providers"
        description="When the selected provider is temporarily unavailable, Workmate may send the same request to another enabled provider. This can change data residency and provider charges."
      >
        <Switch
          checked={gateway.enabled}
          onCheckedChange={(enabled) => void setGateway({ enabled })}
        />
      </ConfigItem>

      <ConfigItem
        title="Maximum attempts"
        description="Includes the selected provider. Streaming requests never switch after visible output starts."
      >
        <Select
          value={gateway.maxAttempts}
          disabled={!gateway.enabled}
          onValueChange={(value) => {
            if (value !== null) void setGateway({ maxAttempts: value })
          }}
        >
          <SelectTrigger aria-label="Maximum AI routing attempts">
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
          title="Fallback providers"
          description="The provider selected for a feature is always tried first. Turn off providers that automatic routing must never use as fallbacks."
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
                    aria-label={`Allow ${provider.name} as an automatic fallback`}
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
