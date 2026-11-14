// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { TelegramChatAdapter } from "../telegram"

describe("TelegramChatAdapter", () => {
  let adapter: TelegramChatAdapter

  beforeEach(() => {
    adapter = new TelegramChatAdapter()
    document.body.innerHTML = `
      <div class="bubbles scrolled-down has-groups">
        <div class="scrollable scrollable-y bubbles-scrollable" role="region" aria-label="Message history">
          <div class="bubbles-inner has-rights is-chat">
            <section class="bubbles-date-group">
              <div class="bubble service is-date">
                <div class="bubble-content"><div class="service-msg"><span class="i18n">October 19</span></div></div>
              </div>
              <div class="bubbles-group">
                <div role="article" data-mid="165028" data-peer-id="-5037379410" data-timestamp="1792400206" class="bubble hide-name is-out can-have-tail is-read">
                  <div class="bubble-content-wrapper">
                    <div class="bubble-content">
                      <div class="message spoilers-container">
                        <div class="_Host_16fpe_1" data-message-text-source="">
                          <span><span class="_Root_hx6ml_1"><span class="_Content_hx6ml_5">Kill tiến trình lsphp để làm mới OPcache trong RAM của LiteSpeed</span></span></span>
                        </div>
                        <span class="time"><span class="i18n">15:56</span></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="bubbles-group">
                <div role="article" data-mid="165030" data-peer-id="-5037379410" data-timestamp="1792562217" class="bubble hide-name is-group-first">
                  <div class="bubble-content-wrapper">
                    <div class="bubble-content">
                      <div class="message spoilers-container">
                        <div class="_Host_16fpe_1" data-message-text-source="">
                          <span><span class="_Root_hx6ml_1"><span class="_Content_hx6ml_5">Hello from teammate</span></span></span>
                        </div>
                        <span class="time"><span class="i18n">12:56</span></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    `
  })

  it("extracts messages cleanly ignoring date service bubbles", () => {
    const messages = adapter.getMessages()
    expect(messages.length).toBe(2)

    const [first, second] = messages
    expect(first).toBeDefined()
    expect(second).toBeDefined()

    // Outgoing message
    expect(first?.id).toBe("165028")
    expect(first?.content).toContain("Kill tiến trình lsphp")
    expect(first?.content).not.toContain("15:56") // Time should not bleed into content
    expect(first?.isOwn).toBe(true)
    expect(first?.author).toBe("Tôi")

    // Incoming message
    expect(second?.id).toBe("165030")
    expect(second?.content).toBe("Hello from teammate")
    expect(second?.isOwn).toBe(false)
    expect(second?.author).toBe("Đối phương")
  })
})
