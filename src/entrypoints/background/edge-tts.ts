import { createLogger } from "@/utils/logging/logger"
import { onMessage } from "@/utils/message"
import {
  getEdgeTTSHealthStatus,
  listEdgeTTSVoices,
  synthesizeEdgeTTS,
} from "@/utils/server/edge-tts"

const log = createLogger("background/edge-tts")
const activeSynthesisControllers = new Map<string, Set<AbortController>>()

function addController(requestId: string | undefined, controller: AbortController) {
  if (!requestId) return
  const controllers = activeSynthesisControllers.get(requestId) ?? new Set<AbortController>()
  controllers.add(controller)
  activeSynthesisControllers.set(requestId, controllers)
}

function removeController(requestId: string | undefined, controller: AbortController) {
  if (!requestId) return
  const controllers = activeSynthesisControllers.get(requestId)
  controllers?.delete(controller)
  if (controllers?.size === 0) activeSynthesisControllers.delete(requestId)
}

function gatewayErrorForFailure(failure: EdgeTTSSynthesizeFailure): GatewayError {
  const { error } = failure
  const code =
    error.code === "SYNTH_RATE_LIMITED"
      ? "rate_limit"
      : error.code === "NETWORK_ERROR" || error.code === "TOKEN_FETCH_FAILED"
        ? "network"
        : error.retryable
          ? "provider"
          : "invalid_request"
  return new GatewayError(code, error.message, { cause: failure, status: error.status })
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let index = 0; index < bytes.length; index++) {
    binary += String.fromCharCode(bytes[index]!)
  }
  return btoa(binary)
}

export function setupEdgeTTSMessageHandlers() {
  onMessage("edgeTtsSynthesize", async (message) => {
    const controller = new AbortController()
    addController(message.data.requestId, controller)
    try {
      const response = await executeGatewayAttempts(
        [
          {
            candidate: {
              routeId: "edge-tts",
              providerId: "edge-tts",
              operations: ["speech.synthesize"],
              enabled: true,
              configurationOrder: 0,
            },
            execute: async (signal) => {
              const result = await synthesizeEdgeTTS(message.data, signal)
              if (signal.aborted) {
                throw new GatewayError("aborted", "Edge TTS synthesis was aborted", {
                  cause: signal.reason,
                })
              }
              if (!result.ok) throw gatewayErrorForFailure(result)
              return result
            },
          },
        ],
        controller.signal,
      )
      return {
        ok: true as const,
        audioBase64: arrayBufferToBase64(response.audio),
        contentType: response.contentType,
      }
    } catch (error) {
      const failure = error instanceof GatewayError ? error.cause : undefined
      if (failure && typeof failure === "object" && "ok" in failure) {
        log.warn("[EdgeTTS] synthesize failed", {
          error: (failure as EdgeTTSSynthesizeFailure).error,
        })
        return failure as EdgeTTSSynthesizeFailure
      }
      return {
        ok: false as const,
        error: {
          code: "UNKNOWN_ERROR" as const,
          message: error instanceof Error ? error.message : "Edge TTS synthesis failed",
        },
      }
    } finally {
      removeController(message.data.requestId, controller)
    }
  })

  onMessage("edgeTtsCancel", async (message) => {
    for (const controller of activeSynthesisControllers.get(message.data.requestId) ?? []) {
      controller.abort(new DOMException("Edge TTS synthesis cancelled", "AbortError"))
    }
    activeSynthesisControllers.delete(message.data.requestId)
    return { ok: true as const }
  })

  onMessage("edgeTtsListVoices", async () => {
    return listEdgeTTSVoices()
  })

  onMessage("edgeTtsHealthCheck", async () => {
    return getEdgeTTSHealthStatus()
  })
}
import type { EdgeTTSSynthesizeFailure } from "@/types/edge-tts"
import { executeGatewayAttempts, GatewayError } from "@/utils/ai-gateway"
