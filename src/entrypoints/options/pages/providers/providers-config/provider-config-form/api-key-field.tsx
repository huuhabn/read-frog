import type { APIProviderConfig } from "@/types/config/provider"
import { Icon } from "@iconify/react"
import { useSelector } from "@tanstack/react-store"
import { useAtom } from "jotai"
import { useEffect, useState } from "react"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"
import { highlightedProviderFieldAtom, PROVIDER_FIELD_HIGHLIGHT_DURATION_MS } from "../atoms"
import { ConnectionTestButton } from "./components/connection-button"
import { GetAPIKeyButton } from "./components/get-api-key-button"
import { withForm } from "./form"

export const APIKeyField = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    const [showAPIKey, setShowAPIKey] = useState(false)
    const providerConfig = useSelector(form.store, (state) => state.values)
    const [highlightedField, setHighlightedField] = useAtom(highlightedProviderFieldAtom)
    const isHighlighted = highlightedField === "apiKey"

    // Clears itself so switching providers afterwards does not flash their key field too.
    useEffect(() => {
      if (!isHighlighted) return undefined

      const timeout = setTimeout(
        () => setHighlightedField(null),
        PROVIDER_FIELD_HIGHLIGHT_DURATION_MS,
      )
      return () => clearTimeout(timeout)
    }, [isHighlighted, setHighlightedField])

    const providerType = providerConfig.provider
    if (providerType === "ollama") {
      return <></>
    }

    return (
      <form.AppField name="apiKey">
        {(field) => (
          <field.InputFieldAutoSave
            label="API Key"
            labelAfter={<GetAPIKeyButton providerType={providerType} />}
            labelExtra={<ConnectionTestButton providerConfig={providerConfig} />}
            type={showAPIKey ? "text" : "password"}
            className={cn(isHighlighted && "animate-ring-flash")}
            trailingAction={
              <button
                type="button"
                className="flex size-6 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground focus:outline-hidden"
                onClick={() => setShowAPIKey((prev) => !prev)}
                title={i18n.t("options.apiProviders.apiKey.showAPIKey")}
                aria-label={i18n.t("options.apiProviders.apiKey.showAPIKey")}
              >
                <Icon icon={showAPIKey ? "tabler:eye-off" : "tabler:eye"} className="size-4" />
              </button>
            }
          />
        )}
      </form.AppField>
    )
  },
})
