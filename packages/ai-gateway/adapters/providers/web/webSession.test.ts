import type { ProviderExecutionOptions } from "../../../domain/ports/providerAdapter.js"
import { describe, it, expect } from "vitest"
import { ProviderRegistry } from "../registry.js"
import { ChatGptWebAdapter } from "./chatgptWeb.js"
import { DeepSeekWebAdapter } from "./deepseekWeb.js"
import { GeminiWebAdapter } from "./geminiWeb.js"
import { MuseWebAdapter } from "./museWeb.js"
import { PerplexityWebAdapter } from "./perplexityWeb.js"

describe("Web Session Providers", () => {
  it("should be registered in ProviderRegistry", () => {
    const providerRegistry = new ProviderRegistry()
    expect(providerRegistry.getAdapter("chatgpt-web")).toBeInstanceOf(ChatGptWebAdapter)
    expect(providerRegistry.getAdapter("deepseek-web")).toBeInstanceOf(DeepSeekWebAdapter)
    expect(providerRegistry.getAdapter("perplexity-web")).toBeInstanceOf(PerplexityWebAdapter)
    expect(providerRegistry.getAdapter("gemini-web")).toBeInstanceOf(GeminiWebAdapter)
    expect(providerRegistry.getAdapter("muse-web")).toBeInstanceOf(MuseWebAdapter)
  })

  describe("ChatGptWebAdapter", () => {
    const adapter = new ChatGptWebAdapter()
    const options: ProviderExecutionOptions = {
      model: "gpt-4o",
      body: {
        messages: [{ role: "user", content: "Hello from ChatGPT Web!" }],
      },
      credential: {
        provider: "chatgpt-web",
        apiKey: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.dummy_access_token",
        scope: "tenant",
        credentialId: "cred_web_1",
      },
      stream: true,
    }

    it("should build correct URL and headers with Bearer token", () => {
      const url = adapter.buildUrl(options)
      expect(url).toBe("https://chatgpt.com/backend-api/conversation")

      const headers = adapter.buildHeaders(options)
      expect(headers.Authorization).toBe(
        "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.dummy_access_token",
      )
      expect(headers.Origin).toBe("https://chatgpt.com")
    })

    it("should format request body into ChatGPT conversation shape", () => {
      const body = adapter.formatRequestBody(options) as any
      expect(body.action).toBe("next")
      expect(body.model).toBe("gpt-4o")
      expect(body.messages[0].content.parts[0]).toBe("Hello from ChatGPT Web!")
      expect(body.messages[0].author.role).toBe("user")
    })
  })

  describe("DeepSeekWebAdapter", () => {
    const adapter = new DeepSeekWebAdapter()
    const options: ProviderExecutionOptions = {
      model: "deepseek-chat",
      body: {
        messages: [
          { role: "system", content: "You are helpful." },
          { role: "user", content: "Explain quantum computing." },
        ],
      },
      credential: {
        provider: "deepseek-web",
        apiKey: "user_token_abcdef123456",
        scope: "tenant",
        credentialId: "cred_ds_web",
      },
      stream: true,
    }

    it("should build correct URL and headers", () => {
      const url = adapter.buildUrl(options)
      expect(url).toBe("https://chat.deepseek.com/api/v0/chat/completion")

      const headers = adapter.buildHeaders(options)
      expect(headers.Authorization).toBe("Bearer user_token_abcdef123456")
      expect(headers["X-Client-Platform"]).toBe("web")
    })

    it("should format prompt properly", () => {
      const body = adapter.formatRequestBody(options) as any
      expect(body.prompt).toContain("System: You are helpful.")
      expect(body.prompt).toContain("Human: Explain quantum computing.")
      expect(body.thinking_enabled).toBe(false)
    })
  })

  describe("PerplexityWebAdapter", () => {
    const adapter = new PerplexityWebAdapter()
    const options: ProviderExecutionOptions = {
      model: "pplx-sonar",
      body: {
        messages: [{ role: "user", content: "Latest tech news" }],
      },
      credential: {
        provider: "perplexity-web",
        apiKey: "__Secure-next-auth.session-token=sess_token_xyz; cf_clearance=cf_123",
        scope: "tenant",
        credentialId: "cred_pplx_web",
      },
      stream: true,
    }

    it("should build correct URL and headers with Cookie", () => {
      const url = adapter.buildUrl(options)
      expect(url).toBe("https://www.perplexity.ai/rest/sse/prompt_completion")

      const headers = adapter.buildHeaders(options)
      expect(headers.Cookie).toContain("__Secure-next-auth.session-token=sess_token_xyz")
      expect(headers.Origin).toBe("https://www.perplexity.ai")
    })

    it("should format request body to Perplexity API shape", () => {
      const body = adapter.formatRequestBody(options) as any
      expect(body.version).toBe("2.18")
      expect(body.query_str).toBe("Latest tech news")
      expect(body.source).toBe("default")
    })
  })

  describe("GeminiWebAdapter", () => {
    const adapter = new GeminiWebAdapter()
    const options: ProviderExecutionOptions = {
      model: "gemini-2.5-pro",
      body: {
        messages: [
          { role: "system", content: "You are an intelligent AI." },
          { role: "user", content: "What is Google Gemini?" },
        ],
      },
      credential: {
        provider: "gemini-web",
        apiKey: JSON.stringify({
          "__Secure-1PSID": "psid_mock_value_123456",
          "__Secure-1PSIDTS": "psidts_mock_value_789",
        }),
        scope: "tenant",
        credentialId: "cred_gemini_web",
      },
      stream: true,
    }

    it("should build correct URL and normalize JSON cookie object to Cookie header", () => {
      const url = adapter.buildUrl(options)
      expect(url).toContain("StreamGenerate")

      const headers = adapter.buildHeaders(options)
      expect(headers.Cookie).toContain("__Secure-1PSID=psid_mock_value_123456")
      expect(headers.Cookie).toContain("__Secure-1PSIDTS=psidts_mock_value_789")
      expect(headers.Origin).toBe("https://gemini.google.com")
      expect(headers["X-Same-Domain"]).toBe("1")
    })

    it("should format multi-turn messages into structured prompt blocks", () => {
      const body = adapter.formatRequestBody(options) as any
      expect(body.prompt).toContain("Instructions:\nYou are an intelligent AI.")
      expect(body.prompt).toContain("User Request:\nWhat is Google Gemini?")
      expect(body.model).toBe("gemini-2.5-pro")
    })
  })

  describe("MuseWebAdapter", () => {
    const adapter = new MuseWebAdapter()
    const options: ProviderExecutionOptions = {
      model: "muse-chat",
      body: {
        messages: [{ role: "user", content: "Create an image of sunset over mountains" }],
      },
      credential: {
        provider: "muse-web",
        apiKey: "hatch_sess=sess_12345; hatch_gw=gw_67890; hatch_vml=vml_abc",
        scope: "tenant",
        credentialId: "cred_muse_web",
      },
      stream: false,
    }

    it("should build correct URL and headers with Cookie", () => {
      const url = adapter.buildUrl(options)
      expect(url).toBe("https://muse.ai/api/session")

      const headers = adapter.buildHeaders(options)
      expect(headers.Cookie).toContain("hatch_sess=sess_12345")
      expect(headers.Cookie).toContain("hatch_gw=gw_67890")
      expect(headers.Origin).toBe("https://muse.ai")
    })

    it("should format prompt and request body properly", () => {
      const body = adapter.formatRequestBody(options) as any
      expect(body.prompt).toContain("User: Create an image of sunset over mountains")
      expect(body.model).toBe("muse-chat")
      expect(body.kind).toBe("chat")
    })
  })
})
