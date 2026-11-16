import type { ProviderAdapter } from "../../domain/ports/providerAdapter.js"
import { AnthropicAdapter } from "./anthropic.js"
import { GeminiAdapter } from "./gemini.js"
import { OpenAICompatibleAdapter } from "./openaiCompatible.js"
import { ChatGptWebAdapter } from "./web/chatgptWeb.js"
import { DeepSeekWebAdapter } from "./web/deepseekWeb.js"
import { GeminiWebAdapter } from "./web/geminiWeb.js"
import { MuseWebAdapter } from "./web/museWeb.js"
import { PerplexityWebAdapter } from "./web/perplexityWeb.js"

export class ProviderRegistry {
  private adapters = new Map<string, ProviderAdapter>()

  constructor() {
    this.registerDefaults()
  }

  private registerDefaults(): void {
    this.register(new AnthropicAdapter())
    this.register(new GeminiAdapter())
    this.register(new OpenAICompatibleAdapter("openai", "https://api.openai.com/v1"))
    this.register(new OpenAICompatibleAdapter("deepseek", "https://api.deepseek.com/v1"))
    this.register(new OpenAICompatibleAdapter("groq", "https://api.groq.com/openai/v1"))
    this.register(new OpenAICompatibleAdapter("mistral", "https://api.mistral.ai/v1"))
    this.register(new OpenAICompatibleAdapter("openrouter", "https://openrouter.ai/api/v1"))
    this.register(new OpenAICompatibleAdapter("together", "https://api.together.xyz/v1"))
    this.register(new OpenAICompatibleAdapter("ollama", "http://localhost:11434/v1"))

    // Web Session Providers
    this.register(new ChatGptWebAdapter())
    this.register(new DeepSeekWebAdapter())
    this.register(new PerplexityWebAdapter())
    this.register(new GeminiWebAdapter())
    this.register(new MuseWebAdapter())
  }

  public register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.providerId.toLowerCase(), adapter)
  }

  /**
   * Get an adapter for a provider.
   * If not explicitly registered, returns a Generic OpenAICompatibleAdapter configured for this provider.
   */
  public getAdapter(providerId: string): ProviderAdapter {
    const key = providerId.toLowerCase()
    const existing = this.adapters.get(key)
    if (existing) {
      return existing
    }
    // Fall back to OpenAI-compatible adapter
    const generic = new OpenAICompatibleAdapter(key)
    this.register(generic)
    return generic
  }
}
