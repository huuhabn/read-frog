import type { ProviderConfig } from "@/types/config/provider"
import type { Theme } from "@/types/config/theme"
import type { HostedAiUpgradePlan } from "@/utils/hosted-ai/types"
import { PROVIDER_ITEMS } from "@/utils/constants/providers"

export interface SystemProviderSelectorItem {
  kind: "system"
  id: string
  logo: (theme: Theme) => string
  name: string
  disabled?: boolean
  /**
   * The cheapest plan this account would need to run the option, shown as a
   * badge. Absent when it can run it already, or a plan would not help.
   */
  upgradeTo?: HostedAiUpgradePlan
}

export type ProviderSelectorOption = ProviderConfig | SystemProviderSelectorItem

export function isSystemProviderSelectorItem(
  provider: ProviderSelectorOption | null | undefined,
): provider is SystemProviderSelectorItem {
  return Boolean(
    provider && typeof provider === "object" && "kind" in provider && provider.kind === "system",
  )
}

export function getProviderLogo(
  provider: ProviderSelectorOption | null | undefined,
  theme: Theme,
): string {
  if (!provider) return ""
  return isSystemProviderSelectorItem(provider)
    ? provider.logo(theme)
    : (PROVIDER_ITEMS[provider.provider]?.logo(theme) ?? "")
}

export function getProviderName(provider: ProviderSelectorOption | null | undefined): string {
  return provider?.name ?? ""
}

export function isProviderSelectorOptionDisabled(
  provider: ProviderSelectorOption | null | undefined,
): boolean {
  return isSystemProviderSelectorItem(provider) && provider.disabled === true
}
