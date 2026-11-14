import type { SlashCommandDefinition, SlashCommandResult } from "../types"
import { i18n } from "@/utils/i18n"
import { translateChatText } from "../../ai/service"

export const dichCommand: SlashCommandDefinition = {
  name: "dich",
  aliases: ["tran", "translate"],
  get description() {
    return i18n.t("options.webChat.slashCommands.dichDesc")
  },
  usage: "/dich [văn bản] hoặc /dich:en [văn bản]",
  async execute(context): Promise<SlashCommandResult> {
    const { args, langModifier } = context
    const targetLang = langModifier || "vi"

    let contentToTranslate = args.trim()
    if (!contentToTranslate) {
      const last = context.adapter.getRecentMessages(1)[0]
      contentToTranslate = last?.content || ""
    }

    if (!contentToTranslate) {
      return {
        success: false,
        error: "Vui lòng nhập văn bản cần dịch sau lệnh /dich.",
      }
    }

    try {
      const translated = await translateChatText({
        text: contentToTranslate,
        targetLang,
        sourceFeature: "Web Chat (/dich)",
      })

      return {
        success: true,
        insertText: translated,
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Lỗi khi dịch văn bản.",
      }
    }
  },
}
