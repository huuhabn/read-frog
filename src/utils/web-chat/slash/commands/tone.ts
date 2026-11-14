import type { SlashCommandDefinition, SlashCommandResult } from "../types"
import { i18n } from "@/utils/i18n"
import { rewriteChatText, type RewriteTone } from "../../ai/service"

export const toneCommand: SlashCommandDefinition = {
  name: "tone",
  aliases: ["giong"],
  get description() {
    return i18n.t("options.webChat.slashCommands.toneDesc")
  },
  usage: "/tone professional|friendly|brief [văn bản]",
  async execute(context): Promise<SlashCommandResult> {
    const { args } = context
    const parts = args.trim().split(/\s+/)
    const firstWord = parts[0]?.toLowerCase()

    let tone: RewriteTone = "professional"
    let contentToRewrite = args

    if (firstWord === "friendly" || firstWord === "thanmat") {
      tone = "friendly"
      contentToRewrite = parts.slice(1).join(" ")
    } else if (firstWord === "brief" || firstWord === "ngan" || firstWord === "ngangon") {
      tone = "brief"
      contentToRewrite = parts.slice(1).join(" ")
    } else if (firstWord === "professional" || firstWord === "lichsu" || firstWord === "congviec") {
      tone = "professional"
      contentToRewrite = parts.slice(1).join(" ")
    }

    if (!contentToRewrite) {
      // Fallback: look at recent context
      const last = context.adapter.getRecentMessages(1)[0]
      contentToRewrite = last?.content || ""
    }

    if (!contentToRewrite) {
      return {
        success: false,
        error: "Vui lòng nhập văn bản cần đổi giọng điệu sau lệnh /tone.",
      }
    }

    try {
      const rewritten = await rewriteChatText(contentToRewrite, tone, {
        sourceFeature: `Web Chat (/tone ${tone})`,
      })
      return {
        success: true,
        insertText: rewritten,
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Lỗi khi đổi giọng điệu.",
      }
    }
  },
}
