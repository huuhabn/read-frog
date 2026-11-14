import type { IChatAdapter } from "../../adapter/types"
import { describe, expect, it } from "vitest"
import { tplCommand } from "../commands/tpl"
import { parseSlashCommandInput } from "../registry"

describe("Slash Command Parsing & Registry", () => {
  it("should parse standard /reply command", () => {
    const parsed = parseSlashCommandInput("/reply hãy trả lời đồng ý")
    expect(parsed.isValidTrigger).toBe(true)
    expect(parsed.commandName).toBe("reply")
    expect(parsed.langModifier).toBeUndefined()
    expect(parsed.args).toBe("hãy trả lời đồng ý")
    expect(parsed.command).toBeDefined()
  })

  it("should parse language modifier like /reply:zh", () => {
    const parsed = parseSlashCommandInput("/reply:zh tôi sẽ đến vào ngày mai")
    expect(parsed.isValidTrigger).toBe(true)
    expect(parsed.commandName).toBe("reply")
    expect(parsed.langModifier).toBe("zh")
    expect(parsed.args).toBe("tôi sẽ đến vào ngày mai")
  })

  it("should ignore text not starting with /", () => {
    const parsed = parseSlashCommandInput("xin chào bạn /reply")
    expect(parsed.isValidTrigger).toBe(false)
    expect(parsed.command).toBeNull()
  })

  it("should execute /tpl and replace {{ten_nguoi_nhan}}", async () => {
    const mockAdapter: IChatAdapter = {
      platform: "zalo",
      matches: () => true,
      getMessages: () => [],
      getCurrentRoom: () => ({ id: "1", name: "Anh Nam", platform: "zalo" }),
      getInputElement: () => null,
      insertText: () => true,
      getRecentMessages: () => [
        {
          id: "m1",
          author: "Anh Nam",
          content: "Bạn gửi tài liệu qua nhé",
          timestamp: Date.now(),
          isOwn: false,
        },
      ],
    }

    const result = await tplCommand.execute({
      adapter: mockAdapter,
      inputElement: {} as HTMLElement,
      rawInput: "/tpl chao",
      commandName: "tpl",
      args: "chao",
    })

    expect(result.success).toBe(true)
    expect(result.insertText).toContain("Anh Nam")
  })
})
