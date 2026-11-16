import { describe, it, expect } from "vitest"
import {
  FORMATS,
  type ClaudeRequest,
  type OpenAIChatRequest,
  type GeminiRequest,
} from "../formats/types.js"
import { translatorRegistry } from "./registry.js"

describe("Translator Engine", () => {
  it("should translate Claude request to OpenAI request", () => {
    const claudeReq: ClaudeRequest = {
      model: "claude-3-5-sonnet-20241022",
      system: "You are a helpful coding assistant.",
      max_tokens: 1000,
      messages: [{ role: "user", content: "Write a hello world function." }],
      tools: [
        {
          name: "execute_cmd",
          description: "Run command",
          input_schema: { type: "object", properties: { cmd: { type: "string" } } },
        },
      ],
    }

    const openai = translatorRegistry.translateRequest(
      FORMATS.CLAUDE,
      FORMATS.OPENAI,
      claudeReq,
    ) as unknown as OpenAIChatRequest

    expect(openai.model).toBe("claude-3-5-sonnet-20241022")
    expect(openai.messages).toHaveLength(2)
    expect(openai.messages[0]?.role).toBe("system")
    expect(openai.messages[0]?.content).toBe("You are a helpful coding assistant.")
    expect(openai.messages[1]?.role).toBe("user")
    expect(openai.messages[1]?.content).toBe("Write a hello world function.")
    expect(openai.tools).toHaveLength(1)
    expect(openai.tools?.[0]?.function.name).toBe("execute_cmd")
  })

  it("should translate OpenAI request to Gemini request", () => {
    const openaiReq: OpenAIChatRequest = {
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Instruction test" },
        { role: "user", content: "Hello Gemini" },
      ],
      temperature: 0.7,
      max_tokens: 200,
    }

    const gemini = translatorRegistry.translateRequest(
      FORMATS.OPENAI,
      FORMATS.GEMINI,
      openaiReq,
    ) as unknown as GeminiRequest

    expect(gemini.systemInstruction?.parts[0]?.text).toBe("Instruction test")
    expect(gemini.contents).toHaveLength(1)
    expect(gemini.contents[0]?.role).toBe("user")
    expect(gemini.contents[0]?.parts[0]?.text).toBe("Hello Gemini")
    expect(gemini.generationConfig?.temperature).toBe(0.7)
    expect(gemini.generationConfig?.maxOutputTokens).toBe(200)
  })

  it("should translate Claude response chunks to OpenAI response chunks", () => {
    const state = {}

    // 1. message_start
    const chunk1 = translatorRegistry.translateResponse(
      FORMATS.OPENAI,
      FORMATS.CLAUDE,
      {
        type: "message_start",
        message: { id: "msg_123", model: "claude-3-5-sonnet", usage: { input_tokens: 10 } },
      },
      state,
    )
    expect(chunk1).not.toBeNull()
    expect(chunk1.choices[0].delta.role).toBe("assistant")

    // 2. content_block_delta text
    const chunk2 = translatorRegistry.translateResponse(
      FORMATS.OPENAI,
      FORMATS.CLAUDE,
      {
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: "Hello" },
      },
      state,
    )
    expect(chunk2.choices[0].delta.content).toBe("Hello")

    // 3. message_delta
    const chunk3 = translatorRegistry.translateResponse(
      FORMATS.OPENAI,
      FORMATS.CLAUDE,
      {
        type: "message_delta",
        delta: { stop_reason: "end_turn" },
        usage: { output_tokens: 5 },
      },
      state,
    )
    expect(chunk3.choices[0].finish_reason).toBe("stop")
    expect(chunk3.usage?.completion_tokens).toBe(5)
  })
})
