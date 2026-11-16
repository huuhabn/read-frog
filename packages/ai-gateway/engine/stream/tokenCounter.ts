import type { TokenUsage } from "../../domain/entities/usage.js"

export class TokenCounter {
  private promptTokens = 0
  private completionTokens = 0
  private totalChars = 0

  constructor(initialPromptTokens = 0) {
    this.promptTokens = initialPromptTokens
  }

  public recordDelta(text: string): void {
    if (!text) return
    this.totalChars += text.length
    // Fast estimation: roughly 4 characters per token
    this.completionTokens = Math.max(1, Math.ceil(this.totalChars / 4))
  }

  public setExactUsage(usage: Partial<TokenUsage>): void {
    if (usage.promptTokens !== undefined) this.promptTokens = usage.promptTokens
    if (usage.completionTokens !== undefined) this.completionTokens = usage.completionTokens
  }

  public getUsage(): TokenUsage {
    return {
      promptTokens: this.promptTokens,
      completionTokens: this.completionTokens,
      totalTokens: this.promptTokens + this.completionTokens,
    }
  }
}
