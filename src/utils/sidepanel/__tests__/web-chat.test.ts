// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { browser } from "#imports"
import { getActiveChatMessagesFromTab, insertTextToActiveChatTab } from "../web-chat"

describe("Sidepanel Web Chat Bridge", () => {
  const originalLocation = window.location

  beforeEach(() => {
    browser.tabs.sendMessage = vi.fn<() => Promise<any>>() as any
    if (!browser.scripting) {
      browser.scripting = {} as any
    }
    browser.scripting.executeScript = vi.fn<() => Promise<any>>() as any
  })

  it("retrieves chat data via tabs.sendMessage when content script responds", async () => {
    const mockRoom = { id: "zalo-g123", name: "Gia đình", platform: "zalo" as const }
    const mockMessages = [
      {
        id: "msg-1",
        author: "Mother",
        content: "Chiều bố ra viện",
        timestamp: 123456,
        isOwn: false,
      },
    ]

    vi.mocked(browser.tabs.sendMessage).mockResolvedValueOnce({
      room: mockRoom,
      messages: mockMessages,
    } as any)

    const result = await getActiveChatMessagesFromTab(101)
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(101, {
      type: "WEB_CHAT_GET_ACTIVE_DATA",
    })
    expect(result.room?.name).toBe("Gia đình")
    expect(result.messages.length).toBe(1)
    expect(result.messages[0]?.content).toBe("Chiều bố ra viện")
  })

  it("sanitizes room name if content script returned undefined as a string", async () => {
    vi.mocked(browser.tabs.sendMessage).mockResolvedValueOnce({
      room: { id: "zalo-1", name: "undefined", platform: "zalo" as const },
      messages: [],
    } as any)

    const result = await getActiveChatMessagesFromTab(102)
    expect(result.room?.name).toBe("Cuộc trò chuyện Zalo")
  })

  it("falls back to executeScript when tabs.sendMessage throws an error", async () => {
    vi.mocked(browser.tabs.sendMessage).mockRejectedValueOnce(
      new Error("Could not establish connection"),
    )

    const mockExecuteScriptResult = {
      room: { id: "zalo-g456", name: "Bạn bè", platform: "zalo" as const },
      messages: [{ id: "m1", author: "Bạn", content: "Alo", timestamp: 123, isOwn: false }],
    }

    vi.mocked(browser.scripting.executeScript).mockResolvedValueOnce([
      { result: mockExecuteScriptResult } as any,
    ] as any)

    const result = await getActiveChatMessagesFromTab(103)
    expect(browser.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { tabId: 103 },
      }),
    )
    expect(result.room?.name).toBe("Bạn bè")
    expect(result.messages.length).toBe(1)
  })

  it("successfully inserts text via tabs.sendMessage when available", async () => {
    vi.mocked(browser.tabs.sendMessage).mockResolvedValueOnce({ success: true } as any)

    const success = await insertTextToActiveChatTab(104, "Xin chào!")
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(104, {
      type: "WEB_CHAT_INSERT_TEXT",
      text: "Xin chào!",
      autoSend: false,
    })
    expect(success).toBe(true)
  })

  it("falls back to executeScript for insertText when tabs.sendMessage fails", async () => {
    vi.mocked(browser.tabs.sendMessage).mockRejectedValueOnce(new Error("No response"))
    vi.mocked(browser.scripting.executeScript).mockResolvedValueOnce([
      { result: true } as any,
    ] as any)

    const success = await insertTextToActiveChatTab(105, "Nội dung fallback")
    expect(browser.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { tabId: 105 },
        args: ["Nội dung fallback", false],
      }),
    )
    expect(success).toBe(true)
  })

  describe("executeScript Zalo DOM Extraction Logic", () => {
    beforeEach(() => {
      delete (window as any).location
      window.location = new URL("https://chat.zalo.me/") as any
    })

    afterEach(() => {
      window.location = originalLocation as any
    })

    it("extracts from messageViewContainer, ignores sidebar items, and uses data-trailer", async () => {
      vi.mocked(browser.tabs.sendMessage).mockRejectedValueOnce(new Error("offline"))

      // Setup DOM with Zalo structure
      document.body.innerHTML = `
        <!-- Left Sidebar with 10 conversation groups -->
        <div id="conversationList" class="conv-list">
          <div class="conv-item" data-msgid="side-1">
            <span class="truncate">undefined</span>
            <div class="conv-message">Tin nhắn nhóm A ngoài sidebar</div>
          </div>
          <div class="conv-item" data-msgid="side-2">
            <span class="truncate">Nhóm Công Việc</span>
            <div class="conv-message">Tin nhắn nhóm B ngoài sidebar</div>
          </div>
        </div>

        <!-- Active Chat Message View Container -->
        <div id="messageViewContainer" class="message-view__scroll">
          <div id="messageViewScroll">
            <div class="chat-item flx chat-item-audit">
              <div class="chat-content">
                <div id="bb_msg_id_101" class="chat-message" data-component="bubble-message">
                  <div id="message-frame_101" class="message-frame" data-qid="8474856920008@1794357950155_8557367185611140458_g497664394118624323">
                    <div class="message-sender-name-content">
                      <div class="truncate">Mother</div>
                    </div>
                    <div class="text-message__container" data-id="div_ReceivedMsg_Text">
                      <div data-component="message-text-content">
                        <span class="text">Chiều bố ra viện</span>
                      </div>
                    </div>
                    <div class="card-send-time"><span class="card-send-time__sendTime">07:45</span></div>
                  </div>
                </div>
              </div>
            </div>
            <div class="chat-item flx chat-item-audit me">
              <div class="chat-content">
                <div id="bb_msg_id_102" class="chat-message me" data-component="bubble-message">
                  <div class="message-wrapper message-wrapper--me">
                    <div class="text-message__container" data-id="div_SentMsg_Text">
                      <div data-component="message-text-content">
                        <span class="text">Con sẽ qua đón bố</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Chat Input -->
        <div id="chat-input-container-id">
          <div contenteditable="false" id="richInput" class="rich-input empty" data-trailer="Gia đình" placeholder="Nhập @, tin nhắn tới Gia đình">
            <div id="input_line_0"><br></div>
          </div>
        </div>
      `

      let capturedFunc: any = null
      let capturedArgs: any = null
      vi.mocked(browser.scripting.executeScript).mockImplementationOnce(async (options: any) => {
        capturedFunc = options.func
        capturedArgs = options.args
        const result = capturedFunc(...capturedArgs)
        return [{ result }] as any
      })

      const res = await getActiveChatMessagesFromTab(200)

      expect(res.room?.platform).toBe("zalo")
      expect(res.room?.name).toBe("Gia đình")
      expect(res.room?.id).toBe("zalo-g497664394118624323")
      // MUST NOT contain sidebar messages!
      expect(res.messages.length).toBe(2)
      expect(res.messages[0]?.author).toBe("Mother")
      expect(res.messages[0]?.content).toBe("Chiều bố ra viện")
      expect(res.messages[0]?.isOwn).toBe(false)
      expect(res.messages[1]?.author).toBe("Tôi")
      expect(res.messages[1]?.content).toBe("Con sẽ qua đón bố")
      expect(res.messages[1]?.isOwn).toBe(true)
    })

    it("returns empty messages array without error when messageViewContainer is not present", async () => {
      vi.mocked(browser.tabs.sendMessage).mockRejectedValueOnce(new Error("offline"))

      document.body.innerHTML = `
        <div id="conversationList">
          <div class="conv-item" data-msgid="side-1">Tin sidebar</div>
        </div>
      `

      vi.mocked(browser.scripting.executeScript).mockImplementationOnce(async (options: any) => {
        const result = options.func(...options.args)
        return [{ result }] as any
      })

      const res = await getActiveChatMessagesFromTab(201)
      expect(res.room?.platform).toBe("zalo")
      expect(res.messages).toEqual([])
    })
  })
})
