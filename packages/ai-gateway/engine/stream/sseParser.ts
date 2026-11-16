export interface ParsedSSEEvent {
  event?: string
  data: string
  id?: string
}

/**
 * A TransformStream that converts an incoming Uint8Array byte stream
 * into parsed SSE events { event, data, id }.
 */
export function createSSEParserStream(): TransformStream<Uint8Array, ParsedSSEEvent> {
  let buffer = ""
  let currentEvent: string | undefined
  let currentId: string | undefined
  let currentData: string[] = []
  const decoder = new TextDecoder()

  return new TransformStream<Uint8Array, ParsedSSEEvent>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() || "" // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) {
          // Empty line indicates event dispatch
          if (currentData.length > 0) {
            const dataStr = currentData.join("\n")
            controller.enqueue({
              event: currentEvent,
              data: dataStr,
              id: currentId,
            })
            currentEvent = undefined
            currentId = undefined
            currentData = []
          }
          continue
        }

        if (line.startsWith(":")) {
          // SSE comment, ignore
          continue
        }

        const colonIdx = line.indexOf(":")
        if (colonIdx === -1) {
          // Field name only
          continue
        }

        const field = line.slice(0, colonIdx).trim()
        const value = line.slice(colonIdx + 1).replace(/^\s/, "") // Strip single leading space

        if (field === "event") {
          currentEvent = value
        } else if (field === "data") {
          currentData.push(value)
        } else if (field === "id") {
          currentId = value
        }
      }
    },
    flush(controller) {
      if (currentData.length > 0) {
        controller.enqueue({
          event: currentEvent,
          data: currentData.join("\n"),
          id: currentId,
        })
      }
    },
  })
}
