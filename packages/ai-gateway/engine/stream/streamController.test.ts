import { describe, it, expect } from "vitest"
import { FORMATS } from "../formats/types.js"
import { createSSEParserStream } from "./sseParser.js"
import { createGatewaySSEStream } from "./streamController.js"
import { TokenCounter } from "./tokenCounter.js"

describe("Stream Controller & SSE Engine", () => {
  it("should parse SSE bytes into structured events", async () => {
    const parser = createSSEParserStream()
    const encoder = new TextEncoder()
    const inputBytes = encoder.encode(
      'event: message_start\ndata: {"type":"message_start"}\n\nevent: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n\n',
    )

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(inputBytes)
        controller.close()
      },
    }).pipeThrough(parser)

    const reader = stream.getReader()
    const event1 = await reader.read()
    expect(event1.done).toBe(false)
    expect(event1.value?.event).toBe("message_start")
    expect(JSON.parse(event1.value?.data || "{}").type).toBe("message_start")

    const event2 = await reader.read()
    expect(event2.done).toBe(false)
    expect(event2.value?.event).toBe("content_block_delta")

    const event3 = await reader.read()
    expect(event3.done).toBe(true)
  })

  it("should track token usage via TokenCounter", () => {
    const counter = new TokenCounter(15)
    counter.recordDelta("Hello world! This is a test message.")
    const usage = counter.getUsage()

    expect(usage.promptTokens).toBe(15)
    expect(usage.completionTokens).toBeGreaterThan(0)
    expect(usage.totalTokens).toBe(15 + usage.completionTokens)

    // Exact override
    counter.setExactUsage({ promptTokens: 20, completionTokens: 10 })
    const exact = counter.getUsage()
    expect(exact.promptTokens).toBe(20)
    expect(exact.completionTokens).toBe(10)
    expect(exact.totalTokens).toBe(30)
  })

  it("should pipe upstream SSE and translate chunks on the fly", async () => {
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    const abortController = new AbortController()

    const upstreamStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":123,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
          ),
        )
        controller.enqueue(
          encoder.encode(
            'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":123,"model":"gpt-4o","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
          ),
        )
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
      },
    })

    let completedUsage: any = null
    const gatewayStream = createGatewaySSEStream({
      upstreamStream,
      upstreamAbortController: abortController,
      sourceFormat: FORMATS.OPENAI,
      targetFormat: FORMATS.OPENAI,
      onComplete: (usage) => {
        completedUsage = usage
      },
    })

    const reader = gatewayStream.getReader()
    let output = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      output += decoder.decode(value)
    }

    expect(output).toContain('"content":"Hello"')
    expect(output).toContain("data: [DONE]")
    expect(completedUsage).not.toBeNull()
  })
})
