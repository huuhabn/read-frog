import type { BackgroundGenerateTextPayload } from "@/types/background-generate-text"
import type { GatewayRouteCandidate } from "@/utils/ai-gateway"
import type { PromptableProviderRef } from "@/utils/providers/provider-ref"

function providerId(ref: PromptableProviderRef): string {
  return ref.kind === "system" ? ref.providerId : ref.config.id
}

export interface BackgroundGenerateTextCandidate {
  candidate: GatewayRouteCandidate
  providerRef: PromptableProviderRef
}

/**
 * Converts secret-bearing provider snapshots into safe route metadata while
 * retaining the snapshots only in background-owned execution closures.
 */
export function buildBackgroundGenerateTextCandidates(
  payload: BackgroundGenerateTextPayload,
): BackgroundGenerateTextCandidate[] {
  const refs = [payload.providerRef, ...(payload.fallbackProviderRefs ?? [])]
  const seen = new Set<string>()

  return refs.flatMap((providerRef, configurationOrder) => {
    const id = providerId(providerRef)
    const routeId = `${providerRef.kind}:${id}`
    if (seen.has(routeId)) return []
    seen.add(routeId)
    return [
      {
        providerRef,
        candidate: {
          routeId,
          providerId: id,
          operations: ["text.generate"],
          enabled: true,
          configurationOrder,
        },
      },
    ]
  })
}
