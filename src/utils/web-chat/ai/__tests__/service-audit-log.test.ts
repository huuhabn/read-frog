import { beforeEach, describe, expect, it, vi } from "vitest"
import { recordAuditLog } from "@/utils/audit-log/audit-log-service"
import {
  callWebChatLLM,
  generateSmartReply,
  summarizeChatRoom,
  translateChatText,
} from "../service"

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: vi.fn<() => Promise<any>>().mockResolvedValue({
    providersConfig: [
      {
        id: "provider-gemini",
        provider: "google",
        name: "Google Gemini",
        enabled: true,
        model: "gemini-2.5-flash",
      },
    ],
    webChat: {
      enabled: true,
      providerId: "provider-gemini",
    },
  }),
}))

vi.mock("@/utils/providers/model", () => ({
  getModelById: vi.fn<() => Promise<any>>().mockResolvedValue({}),
}))

vi.mock("@/utils/audit-log/audit-log-service", () => ({
  recordAuditLog: vi.fn<() => Promise<string | null>>().mockResolvedValue("log-123"),
}))

vi.mock("ai", () => ({
  generateText: vi
    .fn<(options?: any) => Promise<any>>()
    .mockImplementation(async (options: any) => {
      if (options.prompt?.includes("FAIL_NOW")) {
        throw new Error("Simulated LLM network failure")
      }

      if (options.system?.includes("raw JSON")) {
        return {
          text: JSON.stringify({
            replyText: "Dạ được ạ, để em báo gia đình.",
            viGloss: "Ý nghĩa phản hồi",
          }),
          usage: {
            promptTokens: 42,
            completionTokens: 18,
            totalTokens: 60,
          },
        }
      }

      if (options.system?.includes("conversation summarizer")) {
        return {
          text: JSON.stringify({
            summary: "Cuộc trao đổi về việc đón bố xuất viện.",
            actionItems: ["Thuê xe taxi về"],
            extractedEntities: {
              phones: ["0912345678"],
              bankAccounts: [],
              links: [],
              dates: ["Hôm nay"],
            },
          }),
          usage: {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
          },
        }
      }

      return {
        text: "Đã dịch: Xin chào bạn",
        usage: {
          promptTokens: 20,
          completionTokens: 10,
          totalTokens: 30,
        },
      }
    }),
}))

describe("Web Chat AI Service - Audit Log Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("records audit log when callWebChatLLM succeeds", async () => {
    const output = await callWebChatLLM({
      systemPrompt: "You are a helpful assistant.",
      userPrompt: "Xin chào",
      sourceFeature: "Web Chat (Custom)",
      url: "https://chat.zalo.me/",
    })

    expect(output).toBe("Đã dịch: Xin chào bạn")
    expect(recordAuditLog).toHaveBeenCalledTimes(1)
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceFeature: "Web Chat (Custom)",
        providerId: "provider-gemini",
        providerType: "llm",
        status: "success",
        url: "https://chat.zalo.me/",
        tokenUsage: {
          promptTokens: 20,
          completionTokens: 10,
          totalTokens: 30,
        },
      }),
    )
  })

  it("records audit log with status 'error' when LLM fails", async () => {
    await expect(
      callWebChatLLM({
        systemPrompt: "System",
        userPrompt: "FAIL_NOW",
        sourceFeature: "Web Chat (Error Test)",
      }),
    ).rejects.toThrow("Simulated LLM network failure")

    expect(recordAuditLog).toHaveBeenCalledTimes(1)
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceFeature: "Web Chat (Error Test)",
        status: "error",
        errorMessage: "Simulated LLM network failure",
      }),
    )
  })

  it("records audit log during smart reply generation with specific sourceFeature", async () => {
    const result = await generateSmartReply({
      contextMessages: [
        { id: "1", author: "Mẹ", content: "Chiều bố về", timestamp: 1, isOwn: false },
      ],
      targetLang: "vi",
      sourceFeature: "Web Chat (Smart Reply)",
      url: "https://chat.zalo.me/",
    })

    expect(result.replyText).toContain("Dạ được ạ")
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceFeature: "Web Chat (Smart Reply)",
        status: "success",
        tokenUsage: {
          promptTokens: 42,
          completionTokens: 18,
          totalTokens: 60,
        },
      }),
    )
  })

  it("records audit log during chat translation", async () => {
    const translated = await translateChatText({
      text: "Hello friend",
      targetLang: "vi",
      sourceFeature: "Web Chat (Translate)",
      url: "https://web.telegram.org/",
    })

    expect(translated).toBe("Đã dịch: Xin chào bạn")
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceFeature: "Web Chat (Translate)",
        status: "success",
        url: "https://web.telegram.org/",
      }),
    )
  })

  it("records audit log during room summary", async () => {
    const summary = await summarizeChatRoom(
      [{ id: "1", author: "A", content: "Test", timestamp: 1, isOwn: false }],
      "Phòng họp",
      {
        sourceFeature: "Web Chat (Summary)",
        url: "https://chat.zalo.me/",
      },
    )

    expect(summary.actionItems).toContain("Thuê xe taxi về")
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceFeature: "Web Chat (Summary)",
        status: "success",
        tokenUsage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      }),
    )
  })

  it("injects rules and tone into smart reply prompt", async () => {
    const { generateText } = await import("ai")
    await generateSmartReply({
      contextMessages: [{ id: "1", author: "A", content: "Hi", timestamp: 1, isOwn: false }],
      targetLang: "vi",
      tone: "casual",
      rules: "Always say hello first and be polite.",
    })

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringMatching(/Strict Rules you MUST follow:[\s\S]*Always say hello first/),
      }),
    )
  })
})
