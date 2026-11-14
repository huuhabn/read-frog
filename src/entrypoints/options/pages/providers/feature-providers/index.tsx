import type { ReactNode } from "react"
import type { ProviderConfig } from "@/types/config/provider"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import type { FeatureKey } from "@/utils/constants/feature-providers"
import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import { useAtomValue, useSetAtom } from "jotai"
import { useMemo } from "react"
import ProviderSelector from "@/components/llm-providers/provider-selector"
import { SetApiKeyWarning } from "@/components/llm-providers/set-api-key-warning"
import {
  useCustomActionProviders,
  useFeatureProvider,
} from "@/components/llm-providers/use-feature-providers"
import { useHostedAiProviderOptions } from "@/components/llm-providers/use-hosted-ai-provider-options"
import { configAtom, configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import {
  buildFeatureProviderPatch,
  FEATURE_KEYS,
  FEATURE_PROVIDER_DEFS,
  getFeatureDescriptionI18nKey,
  getFeatureLabelI18nKey,
} from "@/utils/constants/feature-providers"
import { getSelectionToolbarActions, patchSelectionToolbarAction } from "@/utils/custom-actions"
import { i18n } from "@/utils/i18n"
import {
  doesProviderSupportsCapability,
  getSelectableProvidersForCapability,
} from "@/utils/providers/provider-registry"
import { providerSupportsTranslationOnlyMode } from "@/utils/providers/translation-only-gate"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"
import { SELECT_CONTENT_PROPS } from "../../../components/select-content-props"

/** How much of a custom action's system prompt stands in for a description before it is cut. */
const SYSTEM_PROMPT_PREVIEW_WORDS = 8
/** Backstop for text the segmenter finds no word breaks in, and the budget when it is missing. */
const SYSTEM_PROMPT_PREVIEW_CHARS = 160
/** Separators left at the cut would sit awkwardly in front of the ellipsis. */
const TRAILING_SEPARATORS_RE = /[\s\p{P}]+$/u

/**
 * How far into `text` the preview may run, capped in words rather than characters: 80 characters
 * of Chinese carries several times the content of 80 characters of English, so a character budget
 * leaves previews wildly uneven between languages. The prompt's own language is unknown, so the
 * segmenter runs on the default locale — CJK is segmented from a dictionary either way.
 */
function findPreviewEnd(text: string): number {
  const capped = Math.min(text.length, SYSTEM_PROMPT_PREVIEW_CHARS)
  // Firefox only grew Intl.Segmenter in 125, well past the 112 this extension still supports.
  if (typeof Intl.Segmenter !== "function") return capped

  const segmenter = new Intl.Segmenter(undefined, { granularity: "word" })
  let words = 0
  for (const { index, isWordLike } of segmenter.segment(text)) {
    if (!isWordLike) continue
    words += 1
    if (words > SYSTEM_PROMPT_PREVIEW_WORDS) return Math.min(index, capped)
  }
  return capped
}

/**
 * Custom actions carry no description of their own, so the head of their system prompt stands
 * in for one. Newlines and markdown headings are collapsed to keep it to a single line.
 */
export function toSystemPromptPreview(action: SelectionToolbarCustomAction): string {
  const singleLine = (action.systemPrompt.trim() || action.prompt).replace(/\s+/g, " ").trim()
  const end = findPreviewEnd(singleLine)
  if (end >= singleLine.length) {
    return singleLine
  }
  return `${singleLine.slice(0, end).replace(TRAILING_SEPARATORS_RE, "")}…`
}

function FeatureProviderTitle({
  children,
  providerConfig,
}: {
  children: ReactNode
  providerConfig: ProviderConfig | null
}) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      {children}
      <SetApiKeyWarning providerConfig={providerConfig} />
    </span>
  )
}

function FeatureProviderItem({ featureKey }: { featureKey: FeatureKey }) {
  const { providers, providerId, providerConfig, setProviderId } = useFeatureProvider(featureKey)

  return (
    <ConfigItem
      orientation="horizontal"
      className="flex-nowrap items-center justify-between gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 [&>div:first-child]:min-w-0 [&>div:first-child]:flex-1 [&>div:last-child]:w-[180px] [&>div:last-child]:min-w-[160px] [&>div:last-child]:shrink-0 sm:[&>div:last-child]:w-[200px]"
      title={
        <FeatureProviderTitle providerConfig={providerConfig}>
          {i18n.t(getFeatureLabelI18nKey(featureKey))}
        </FeatureProviderTitle>
      }
      description={i18n.t(getFeatureDescriptionI18nKey(featureKey))}
    >
      <div className="w-full">
        <ProviderSelector
          providers={providers}
          value={providerId}
          onChange={setProviderId}
          triggerSize="sm"
          className="w-full"
          placeholder={i18n.t("options.apiProviders.featureProviders.chooseProvider")}
          selectContentProps={SELECT_CONTENT_PROPS}
        />
      </div>
    </ConfigItem>
  )
}

function CustomActionProviderItems() {
  const { actions, providers, getProviderConfig, setActionProviderId } = useCustomActionProviders()

  return actions.map((action) => (
    <ConfigItem
      key={action.id}
      orientation="horizontal"
      className="flex-nowrap items-center justify-between gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 [&>div:first-child]:min-w-0 [&>div:first-child]:flex-1 [&>div:last-child]:w-[180px] [&>div:last-child]:min-w-[160px] [&>div:last-child]:shrink-0 sm:[&>div:last-child]:w-[200px]"
      title={
        <FeatureProviderTitle providerConfig={getProviderConfig(action)}>
          {action.name}
        </FeatureProviderTitle>
      }
      description={toSystemPromptPreview(action)}
    >
      <div className="w-full">
        <ProviderSelector
          providers={providers}
          value={action.providerId}
          onChange={(id) => setActionProviderId(action.id, id)}
          triggerSize="sm"
          className="w-full"
          selectContentProps={SELECT_CONTENT_PROPS}
          placeholder={i18n.t("options.selectionToolbar.customActions.form.selectProvider")}
        />
      </div>
    </ConfigItem>
  ))
}

function AllFeatureProvidersSelector() {
  const config = useAtomValue(configAtom)
  const setConfig = useSetAtom(writeConfigAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

  const baseProviders = useMemo(() => {
    const translateProviders = getSelectableProvidersForCapability(
      "pageTranslation",
      providersConfig,
    )
    const llmProviders = getSelectableProvidersForCapability("customAction", providersConfig)
    const map = new Map<string, ProviderSelectorOption>()
    for (const p of [...translateProviders, ...llmProviders]) {
      map.set(p.id, p)
    }
    return Array.from(map.values())
  }, [providersConfig])

  const providers = useHostedAiProviderOptions("customAction", baseProviders)

  const featureIds = FEATURE_KEYS.map((k) => FEATURE_PROVIDER_DEFS[k].getProviderId(config))
  const activeCustomActions = useMemo(
    () =>
      getSelectionToolbarActions(config.selectionToolbar).filter(
        (action) => action.enabled !== false,
      ),
    [config.selectionToolbar],
  )
  const customActionIds = activeCustomActions.map((a) => a.providerId)
  const allIds = [...featureIds, ...customActionIds]
  const allSame = allIds.length > 0 && allIds.every((id) => id === allIds[0])
  const currentValue = allSame ? (allIds[0] ?? "") : ""

  const handleApplyToAll = (newProviderId: string) => {
    const patchAssignments: Partial<Record<FeatureKey, string>> = {}
    for (const key of FEATURE_KEYS) {
      if (key === "pageTranslation" && config.pageTranslation.mode === "translationOnly") {
        const localConfig = providersConfig.find((p) => p.id === newProviderId)
        if (localConfig && !providerSupportsTranslationOnlyMode(localConfig.provider)) {
          continue
        }
      }
      if (
        doesProviderSupportsCapability(key, providersConfig, newProviderId, { requireEnable: true })
      ) {
        patchAssignments[key] = newProviderId
      }
    }
    let patch = buildFeatureProviderPatch(patchAssignments)

    if (
      doesProviderSupportsCapability("customAction", providersConfig, newProviderId, {
        requireEnable: true,
      })
    ) {
      let currentToolbar = config.selectionToolbar
      for (const action of activeCustomActions) {
        currentToolbar = patchSelectionToolbarAction(currentToolbar, action.id, {
          providerId: newProviderId,
        })
      }
      patch = {
        ...patch,
        selectionToolbar: currentToolbar,
      }
    }

    void setConfig(patch)
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-normal whitespace-nowrap text-muted-foreground">
        {i18n.t("options.apiProviders.featureProviders.applyToAll")}:
      </span>
      <div className="w-[180px] sm:w-[200px]">
        <ProviderSelector
          providers={providers}
          value={currentValue}
          onChange={handleApplyToAll}
          triggerSize="sm"
          className="w-full"
          placeholder={i18n.t("options.apiProviders.featureProviders.chooseProvider")}
          selectContentProps={SELECT_CONTENT_PROPS}
        />
      </div>
    </div>
  )
}

export function FeatureProvidersConfig() {
  return (
    <ConfigSection
      id="feature-providers"
      title={i18n.t("options.apiProviders.featureProviders.title")}
      action={<AllFeatureProvidersSelector />}
      contentClassName="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch"
    >
      {FEATURE_KEYS.map((featureKey) => (
        <FeatureProviderItem key={featureKey} featureKey={featureKey} />
      ))}
      <CustomActionProviderItems />
    </ConfigSection>
  )
}
