import type { APIProviderTypes } from "@/types/config/provider"
import { Icon } from "@iconify/react"
import { buttonVariants } from "@/components/ui/base-ui/button"
import { PROVIDER_ITEMS } from "@/utils/constants/providers"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"

/** Renders nothing for providers without an `apiKeyUrl`, which is how the button stays opt-in. */
export function GetAPIKeyButton({ providerType }: { providerType: APIProviderTypes }) {
  const apiKeyUrl = PROVIDER_ITEMS[providerType]?.apiKeyUrl
  if (!apiKeyUrl) {
    return null
  }

  return (
    <a
      href={apiKeyUrl}
      target="_blank"
      rel="noreferrer"
      className={cn(
        buttonVariants({ variant: "outline-accent", size: "xs" }),
        "inline-flex items-center gap-1",
      )}
    >
      <span>{i18n.t("options.apiProviders.apiKey.getAPIKey")}</span>
      <Icon icon="tabler:external-link" className="size-3" />
    </a>
  )
}
