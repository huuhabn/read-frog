// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { ZaloChatAdapter } from "../zalo"

describe("ZaloChatAdapter", () => {
  let adapter: ZaloChatAdapter

  beforeEach(() => {
    adapter = new ZaloChatAdapter()
    document.body.innerHTML = `
      <div id="messageView" class="message-view">
        <div id="messageViewContainer" class="message-view__scroll">
          <div id="messageViewScroll" class="message-view__scroll__inner">
            <div class="chat-item flx chat-item-spacing --s1">
              <div class="chat-content">
                <div class="title card-sender-name">Đối phương</div>
              </div>
              <div id="bb_msg_id_1794029901787" class="chat-message" data-component="bubble-message">
                <div class="card shadow-bubble message-frame" data-qid="8461768161417@1794029901787">
                  <div class="text-message__container" data-id="div_ReceivedMsg_Text">
                    <div data-component="message-text-content">
                      <span class="text">Bảo hiểm đó trước đây em vẫn đóng.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="chat-item flx chat-item-spacing --s2 me">
              <div id="bb_msg_id_1794031325656" class="chat-message me" data-component="bubble-message">
                <div class="message-wrapper message-wrapper--me">
                  <div class="text-message__container" data-id="div_SentMsg_Text">
                    <div data-component="message-text-content">
                      <span class="text">Không ai tính vậy đâu đến hiện tại là chung hết.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div id="chat-input-container-id" class="chat-input-container">
        <div class="chat-input-container__left-layout">
          <div id="chat-input-scroller-id" class="chat-input-scrollable">
            <div class="chat-input-wrapper">
              <div id="chat-input-content-id" class="chat-input-content">
                <div contenteditable="false" id="richInput" class="rich-input empty" spellcheck="false" tabindex="1" suggestion="@ - gợi ý" data-keybinding-context="mainChatInputFocus#1" data-translate-placeholder="STR_MESSAGE_TO" placeholder="Nhập @, tin nhắn tới Gia đình" data-trailer="Gia đình">
                  <div id="input_line_0"><br></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  })

  it("extracts messages cleanly with stable IDs and correct isOwn flags", () => {
    const messages = adapter.getMessages()
    expect(messages.length).toBe(2)
    const [first, second] = messages
    expect(first).toBeDefined()
    expect(second).toBeDefined()

    // First message (Received)
    expect(first?.content).toBe("Bảo hiểm đó trước đây em vẫn đóng.")
    expect(first?.isOwn).toBe(false)
    expect(first?.author).toBe("Đối phương")
    expect(first?.id).toContain("1794029901787")

    // Second message (Sent by me)
    expect(second?.content).toBe("Không ai tính vậy đâu đến hiện tại là chung hết.")
    expect(second?.isOwn).toBe(true)
    expect(second?.author).toBe("Tôi")
    expect(second?.id).toContain("1794031325656")
  })

  it("locates Zalo chat input element from container structure and inserts text", () => {
    const input = adapter.getInputElement()
    expect(input).not.toBeNull()
    expect(input?.id).toBe("richInput")
    expect(input?.classList.contains("rich-input")).toBe(true)

    const insertSuccess = adapter.insertText("Chào gia đình!")
    expect(insertSuccess).toBe(true)
    expect(input?.textContent).toContain("Chào gia đình!")
  })

  it("strictly scopes messages to messageViewContainer and ignores sidebar items", () => {
    // Add a sidebar conversation item outside messageViewContainer
    const sidebar = document.createElement("div")
    sidebar.id = "conversationListSidebar"
    sidebar.innerHTML = `
      <div class="chat-item sidebar-conversation" data-id="conv-group-sidebar">
        <div class="text-message__container">
          <span class="text">Tin nhắn của nhóm chat khác trong sidebar</span>
        </div>
      </div>
    `
    document.body.prepend(sidebar)

    const messages = adapter.getMessages()
    expect(messages.length).toBe(2)
    const contents = messages.map((m) => m.content)
    expect(contents).not.toContain("Tin nhắn của nhóm chat khác trong sidebar")
  })

  it("extracts current room name from data-trailer attribute", () => {
    const room = adapter.getCurrentRoom()
    expect(room?.name).toBe("Gia đình")
  })

  it("accurately parses group chat messages with sender names, consecutive grouping, photos, and quotes", () => {
    document.body.innerHTML = `
      <div id="messageViewContainer" class="message-view__scroll">
        <div id="messageViewScroll">
          <!-- 1. Text message from Mother -->
          <div class="chat-item flx chat-item-audit">
            <div class="chat-content">
              <div id="bb_msg_id_1" class="chat-message" data-component="bubble-message">
                <div class="message-frame" data-qid="8474856920008@1794357950155_8557367185611140458_g497664394118624323">
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

          <!-- 2. Text message from Nguyễn Hữu Thanh -->
          <div class="chat-item flx chat-item-audit">
            <div class="chat-content">
              <div id="bb_msg_id_2" class="chat-message" data-component="bubble-message">
                <div class="message-frame" data-qid="8474875747189@1794358416718_1782745274499251990_g497664394118624323">
                  <div class="message-sender-name-content">
                    <div class="truncate">Nguyễn Hữu Thanh</div>
                  </div>
                  <div class="text-message__container" data-id="div_ReceivedMsg_Text">
                    <div data-component="message-text-content">
                      <span class="text">Thuê taxi chạy về cho đỡ lạnh mẹ ạ</span>
                    </div>
                  </div>
                  <div class="card-send-time"><span class="card-send-time__sendTime">07:53</span></div>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. Consecutive message from Mother (no sender element, mapped via UID) -->
          <div class="chat-item flx chat-item-audit">
            <div class="chat-content">
              <div id="bb_msg_id_3" class="chat-message" data-component="bubble-message">
                <div class="message-frame" data-qid="8474933788829@1794359576312_8557367185611140458_g497664394118624323">
                  <div class="text-message__container" data-id="div_ReceivedMsg_Text">
                    <div data-component="message-text-content">
                      <span class="text">Hay hai chị em đi hai xe lên song để lại 1 xe</span>
                    </div>
                  </div>
                  <div class="card-send-time"><span class="card-send-time__sendTime">08:00</span></div>
                </div>
              </div>
            </div>
          </div>

          <!-- 4. Photo message from Thanh -->
          <div class="chat-item flx chat-item-audit">
            <div class="chat-content">
              <div id="bb_msg_id_4" class="chat-message" data-component="bubble-message">
                <div class="message-frame" data-qid="8484142827830@1794555736228_1782745274499251990_g497664394118624323">
                  <div class="chatImageMessage--audit img-msg-v2 photo-message-v2" data-id="div_ReceivedMsg_Photo">
                    <img class="zimg-el" src="blob:test" />
                  </div>
                  <div class="card-send-time"><span class="card-send-time__sendTime">14:42</span></div>
                </div>
              </div>
            </div>
          </div>

          <!-- 5. Message from Me (SentMsg) -->
          <div class="chat-item flx chat-item-audit me">
            <div class="chat-content">
              <div id="bb_msg_id_5" class="chat-message me" data-component="bubble-message">
                <div class="message-frame me" data-qid="8484515773097@1794560730566_0_g497664394118624323">
                  <div class="text-message__container" data-id="div_SentMsg_Text">
                    <div data-component="message-text-content">
                      <span class="text">chia tài sản sao không họp hành gì vậy</span>
                    </div>
                  </div>
                  <div class="card-send-time"><span class="card-send-time__sendTime">16:05</span></div>
                </div>
              </div>
            </div>
          </div>

          <!-- 6. Message with a quote fragment from Thanh -->
          <div class="chat-item flx chat-item-audit">
            <div class="chat-content">
              <div id="bb_msg_id_6" class="chat-message" data-component="bubble-message">
                <div class="message-frame" data-qid="8484522730699@1794560824156_1782745274499251990_g497664394118624323">
                  <div class="text-message__container" data-id="div_ReceivedMsg_Text">
                    <div class="message-quote-fragment__container">
                      <div class="message-quote-fragment__description">Quoted old message</div>
                    </div>
                    <div data-component="message-text-content">
                      <span class="text">lâu lâu mang ra tiệm họ giặt dc mà</span>
                    </div>
                  </div>
                  <div class="card-send-time"><span class="card-send-time__sendTime">16:07</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `

    const parsed = adapter.getMessages()
    expect(parsed.length).toBe(6)

    // Msg 1
    expect(parsed[0]?.author).toBe("Mother")
    expect(parsed[0]?.content).toBe("Chiều bố ra viện")
    expect(parsed[0]?.timeText).toBe("07:45")
    expect(parsed[0]?.isOwn).toBe(false)

    // Msg 2
    expect(parsed[1]?.author).toBe("Nguyễn Hữu Thanh")
    expect(parsed[1]?.content).toBe("Thuê taxi chạy về cho đỡ lạnh mẹ ạ")
    expect(parsed[1]?.timeText).toBe("07:53")
    expect(parsed[1]?.isOwn).toBe(false)

    // Msg 3 (Mapped via UID from Mother)
    expect(parsed[2]?.author).toBe("Mother")
    expect(parsed[2]?.content).toBe("Hay hai chị em đi hai xe lên song để lại 1 xe")
    expect(parsed[2]?.isOwn).toBe(false)

    // Msg 4 (Photo)
    expect(parsed[3]?.author).toBe("Nguyễn Hữu Thanh")
    expect(parsed[3]?.content).toBe("[Hình ảnh]")
    expect(parsed[3]?.timeText).toBe("14:42")
    expect(parsed[3]?.isOwn).toBe(false)

    // Msg 5 (Me)
    expect(parsed[4]?.author).toBe("Tôi")
    expect(parsed[4]?.content).toBe("chia tài sản sao không họp hành gì vậy")
    expect(parsed[4]?.isOwn).toBe(true)

    // Msg 6 (Quote stripped)
    expect(parsed[5]?.author).toBe("Nguyễn Hữu Thanh")
    expect(parsed[5]?.content).toBe("lâu lâu mang ra tiệm họ giặt dc mà")
    expect(parsed[5]?.isOwn).toBe(false)
  })
})
