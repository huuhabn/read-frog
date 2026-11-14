import type { SlashCommandDefinition, SlashCommandResult } from "../types"
import { i18n } from "@/utils/i18n"

export interface MessageTemplate {
  key: string
  name: string
  template: string
}

export const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    key: "chao",
    name: "Chào hỏi lịch sự",
    template: "Chào {{ten_nguoi_nhan}}, mình đã nhận được thông tin và sẽ phản hồi sớm nhé!",
  },
  {
    key: "xacnhan",
    name: "Xác nhận nhận việc / đơn",
    template: "Dạ em chào {{ten_nguoi_nhan}}, em đã xác nhận thông tin và đang xử lý ngay đây ạ.",
  },
  {
    key: "stk",
    name: "Gửi thông tin tài khoản",
    template:
      "Gửi {{ten_nguoi_nhan}} thông tin chuyển khoản: Ngân hàng MBBank, STK: 123456789, Chủ TK: NGUYEN VAN A.",
  },
]

export const tplCommand: SlashCommandDefinition = {
  name: "tpl",
  aliases: ["mau", "template"],
  get description() {
    return i18n.t("options.webChat.slashCommands.tplDesc")
  },
  usage: "/tpl [chao|xacnhan|stk]",
  async execute(context): Promise<SlashCommandResult> {
    const { adapter, args } = context
    const key = args.trim().toLowerCase()

    const room = adapter.getCurrentRoom()
    const lastMsg = adapter.getRecentMessages(1)[0]
    const recipientName = (lastMsg && !lastMsg.isOwn ? lastMsg.author : room?.name) || "bạn"

    const selectedTpl = DEFAULT_TEMPLATES.find((t) => t.key === key) ?? DEFAULT_TEMPLATES[0]!

    let processed = selectedTpl.template
    processed = processed.replace(/\{\{ten_nguoi_nhan\}\}/gi, recipientName)
    processed = processed.replace(
      /\{\{thoi_gian\}\}/gi,
      new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    )

    return {
      success: true,
      insertText: processed,
      previewText: `Mẫu [${selectedTpl.name}] cho ${recipientName}`,
    }
  },
}
