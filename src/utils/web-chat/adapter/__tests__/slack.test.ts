// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { SlackChatAdapter } from "../slack"

describe("SlackChatAdapter", () => {
  let adapter: SlackChatAdapter

  beforeEach(() => {
    adapter = new SlackChatAdapter()
    document.body.innerHTML = `
      <div class="p-client_workspace__layout">
        <!-- Primary Channel Pane -->
        <div class="p-view_contents p-view_contents--primary">
          <div class="p-view_header">
            <div class="p-view_header__title" data-qa="channel_name">
              <span class="p-view_header__member_name">Nguyen Ha</span>
            </div>
          </div>
          <div class="p-workspace__primary_view_body">
            <div class="p-message_pane" id="message-list">
              <div class="c-virtual_list__scroll_container" data-qa="slack_kit_list">
                <div class="c-virtual_list__item" id="msg-item-1">
                  <div class="c-message_kit__message" data-qa="message_container" data-msg-ts="1794393144.173529" data-msg-channel-id="D0A7XP6J00J">
                    <button data-qa="message_sender_name" class="c-message__sender_button">Ha Huu</button>
                    <a class="c-timestamp" data-ts="1794393144.173529"><span class="c-timestamp__label" data-qa="timestamp_label">5:32 PM</span></a>
                    <div data-qa="message-text" class="p-rich_text_section">Channel message 1</div>
                  </div>
                </div>
                <div class="c-virtual_list__item" id="msg-item-2">
                  <div class="c-message_kit__message" data-qa="message_container" data-msg-ts="1794393189.161949" data-msg-channel-id="D0A7XP6J00J">
                    <!-- Compact layout: no sender button, inherits Ha Huu -->
                    <a class="c-timestamp" data-ts="1794393189.161949"><span class="c-timestamp__label" data-qa="timestamp_label">5:33 PM</span></a>
                    <div data-qa="message-text" class="p-rich_text_section">Channel message 2 adjacent</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="p-message_pane_input">
            <div data-qa="message_input" data-channel-id="D0A7XP6J00J">
              <div role="textbox" contenteditable="true" class="ql-editor" data-qa="texty_input"></div>
            </div>
            <button data-qa="texty_send_button">Send</button>
          </div>
        </div>

        <!-- Secondary Thread Pane -->
        <div class="p-view_contents p-view_contents--secondary" aria-label="Thread in conversation with @Nguyen Ha" role="dialog">
          <div data-qa="threads_flexpane" class="p-flexpane">
            <div class="p-flexpane__title_container" data-qa="flexpane-title-container">Thread</div>
            <div class="p-threads_flexpane">
              <div class="c-virtual_list__scroll_container" data-qa="slack_kit_list">
                <div class="c-virtual_list__item" id="thread-item-1">
                  <div class="c-message_kit__thread_message" data-qa="message_container" data-msg-ts="1794384937.794189">
                    <button data-qa="message_sender_name" class="c-message__sender_button">Nguyen Ha</button>
                    <div data-qa="message-text" class="p-rich_text_section">Thread root reply</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="p-threads_footer__input_container" data-qa="reply_container">
              <div data-qa="message_input" data-channel-id="D0A7XP6J00J" data-thread-ts="1794381630.343829" data-thread-key="D0A7XP6J00J-1794381630.343829" data-view-context="Thread">
                <div role="textbox" contenteditable="true" class="ql-editor thread-input" data-qa="texty_input"></div>
              </div>
              <button data-qa="texty_send_button" class="thread-send-btn">Send Thread</button>
            </div>
          </div>
        </div>
      </div>
    `
  })

  afterEach(() => {
    adapter.destroy()
  })

  it("matches Slack URLs", () => {
    expect(adapter.matches("https://app.slack.com/client/T049L644JS1/D0A7XP6J00J")).toBe(true)
    expect(adapter.matches("https://slack.com")).toBe(true)
    expect(adapter.matches("https://chat.zalo.me")).toBe(false)
  })

  it("extracts channel room and messages by default", () => {
    const room = adapter.getCurrentRoom()
    expect(room?.name).toBe("Nguyen Ha")
    expect(room?.platform).toBe("slack")

    const messages = adapter.getMessages()
    expect(messages.length).toBe(2)
    expect(messages[0]?.content).toBe("Channel message 1")
    expect(messages[0]?.author).toBe("Ha Huu")
    expect(messages[0]?.id).toBe("1794393144.173529")

    // Compact message inherits lastAuthor
    expect(messages[1]?.content).toBe("Channel message 2 adjacent")
    expect(messages[1]?.author).toBe("Ha Huu")
    expect(messages[1]?.id).toBe("1794393189.161949")
  })

  it("switches to thread context when user interacts with or focuses the thread pane", () => {
    const threadInput = document.querySelector<HTMLElement>(".thread-input")
    expect(threadInput).toBeDefined()

    // Trigger focus on thread input
    threadInput?.dispatchEvent(new Event("focusin", { bubbles: true }))

    expect(adapter.getActivePane()).toBe("thread")

    const room = adapter.getCurrentRoom()
    expect(room?.id).toBe("slack-thread-D0A7XP6J00J-1794381630.343829")
    expect(room?.name).toContain("Thread with Nguyen Ha")

    const messages = adapter.getMessages()
    expect(messages.length).toBe(1)
    expect(messages[0]?.content).toBe("Thread root reply")
    expect(messages[0]?.author).toBe("Nguyen Ha")
    expect(messages[0]?.id).toBe("1794384937.794189")

    const input = adapter.getInputElement()
    expect(input?.classList.contains("thread-input")).toBe(true)
  })

  it("switches back to channel when user focuses back on the primary channel", () => {
    const threadInput = document.querySelector<HTMLElement>(".thread-input")
    threadInput?.dispatchEvent(new Event("focusin", { bubbles: true }))
    expect(adapter.getActivePane()).toBe("thread")

    const channelInput = document.querySelector<HTMLElement>(".p-message_pane_input .ql-editor")
    channelInput?.dispatchEvent(new Event("focusin", { bubbles: true }))
    expect(adapter.getActivePane()).toBe("channel")

    const room = adapter.getCurrentRoom()
    expect(room?.name).toBe("Nguyen Ha")
  })

  it("falls back to channel if thread pane is closed in DOM", () => {
    const threadInput = document.querySelector<HTMLElement>(".thread-input")
    threadInput?.dispatchEvent(new Event("focusin", { bubbles: true }))
    expect(adapter.getActivePane()).toBe("thread")

    // Remove thread pane from DOM
    document.querySelector(".p-view_contents--secondary")?.remove()

    expect(adapter.getActivePane()).toBe("channel")
    expect(adapter.getCurrentRoom()?.name).toBe("Nguyen Ha")
  })
})
