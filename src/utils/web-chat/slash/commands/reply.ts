import type { SlashCommandDefinition, SlashCommandResult } from "../types"
import { i18n } from "@/utils/i18n"
import { generateSmartReply } from "../../ai/service"

export const replyCommand: SlashCommandDefinition = {
  name: "reply",
  aliases: ["tl", "traloi"],
  get description() {
    return i18n.t("options.webChat.slashCommands.replyDesc")
  },
  usage: "/reply hoặc /reply:zh [yêu cầu]",
  async execute(context): Promise<SlashCommandResult> {
    const { adapter, args, langModifier } = context

    const recentMessages = adapter.getRecentMessages(5)
    const targetLang = langModifier || "vi"

    try {
      const result = await generateSmartReply({
        contextMessages: recentMessages,
        customInstruction: args,
        targetLang,
        sourceFeature: "Web Chat (/reply)",
      })

      return {
        success: true,
        insertText: result.replyText,
        secondaryText: result.viGloss ? `Dịch nghĩa: ${result.viGloss}` : undefined,
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Không thể tạo gợi ý trả lời.",
      }
    }
  },
}
