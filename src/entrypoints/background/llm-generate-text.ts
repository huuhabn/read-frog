import type {
  BackgroundGenerateTextPayload,
  BackgroundGenerateTextResponse,
} from "@/types/background-generate-text"
import { validateProviderHostedFeature } from "@/utils/hosted-ai/routing"
import { createLogger } from "@/utils/logging/logger"
import { onMessage } from "@/utils/message"
import { generateTextForProviderRef } from "./background-stream"

const log = createLogger("background/llm-generate-text")

export async function runGenerateTextInBackground(
  payload: BackgroundGenerateTextPayload,
): Promise<BackgroundGenerateTextResponse> {
  validateProviderHostedFeature(payload.providerRef, payload.hostedFeature)
  for (const providerRef of payload.fallbackProviderRefs ?? []) {
    validateProviderHostedFeature(providerRef, payload.hostedFeature)
  }
  let usage: BackgroundGenerateTextResponse["usage"]
  let gateway: BackgroundGenerateTextResponse["gateway"]
  const text = await generateTextForProviderRef(payload, {
    onUsage: (captured) => {
      usage = captured
    },
    onGateway: (metadata) => {
      gateway = metadata
    },
  })
  return { text, usage, gateway }
}

export function setupLLMGenerateTextMessageHandlers() {
  onMessage("backgroundGenerateText", async (message) => {
    try {
      return await runGenerateTextInBackground(message.data)
    } catch (error) {
      log.error("backgroundGenerateText failed", { error })
      throw error
    }
  })
}
