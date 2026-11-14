export interface PlatformSelectorConfig {
  messageListSelector: string
  messageItemSelector: string
  authorSelector?: string
  contentSelector?: string
  timestampSelector?: string
  inputBoxSelector: string
  sendButtonSelector?: string
  roomTitleSelector?: string
  ownMessageSelector?: string
}

export interface WebChatRemoteConfig {
  version: number
  lastUpdated?: number
  platforms: {
    zalo: PlatformSelectorConfig
    telegram: PlatformSelectorConfig
    slack: PlatformSelectorConfig
    generic: PlatformSelectorConfig
  }
}

export const DEFAULT_PLATFORM_SELECTORS: WebChatRemoteConfig = {
  version: 1,
  platforms: {
    zalo: {
      messageListSelector:
        "#messageViewContainer, #messageViewScroll, #messageView, .message-view__scroll__inner, .message-view",
      messageItemSelector: ".chat-item, .msg-item",
      authorSelector:
        ".message-sender-name-content, .message-sender-name-wrapper .truncate, .message-sender-name-wrapper, .sender-name, .chat-content .title, .card-sender-name, [data-component='card-sender-name']",
      contentSelector:
        "[data-component='message-text-content'], .text-message__container, span.text",
      timestampSelector: ".card-send-time__sendTime, .bubble-message-time, .time",
      inputBoxSelector:
        "#richInput, .rich-input, #chat-input-content-id .rich-input, #chat-input-container-id #richInput, #chat-input-container-id [contenteditable], [data-keybinding-context*='mainChatInputFocus'], #input_quill, [contenteditable='true'], div[id*='richInput']",
      sendButtonSelector:
        ".send-msg-btn, [icon='Sent-msg_24_Line'], [data-id='btn_RTF_Send'], [data-translate-title='STR_SEND']",
      roomTitleSelector:
        "#header-title, .header-title, .chat-title, #chatName, .conversation-header__title, #conversation-header .title, .chat-header .title",
      ownMessageSelector: ".me, .message-wrapper--me, [data-id*='SentMsg']",
    },
    telegram: {
      messageListSelector:
        ".bubbles-inner, .bubbles-scrollable, .bubbles, .messages-container, .bubble-group",
      messageItemSelector:
        ".bubble[data-mid], .bubble:not(.service), [role='article'][data-mid], .message-list-item",
      authorSelector: ".peer-title, .message-title",
      contentSelector: "[data-message-text-source], .message, .translatable-message, .text-content",
      timestampSelector: ".time .i18n, .time, .message-time",
      inputBoxSelector: ".input-message-input, [contenteditable='true'], #editable-message-text",
      sendButtonSelector:
        ".btn-send.send, button.btn-send.send, .btn-send-container button.send, button.send[aria-label='Send'], button[aria-label='Send'], .btn-send-icon-send, .btn-send",
      roomTitleSelector: ".chat-info .peer-title, .top .person .title, .chat-info h3",
      ownMessageSelector: ".is-out, .own, [data-is-out='true']",
    },
    slack: {
      messageListSelector: "[data-qa='virtual-list'], .c-virtual_list__scroll_container",
      messageItemSelector: "[data-qa='message_container'], .c-message_kit__message",
      authorSelector: "[data-qa='message_sender_name'], .c-message__sender_button",
      contentSelector: "[data-qa='message-text'], .p-rich_text_section",
      timestampSelector: ".c-timestamp, [data-qa='timestamp']",
      inputBoxSelector: "[data-qa='message_input'], div[role='textbox'][contenteditable='true']",
      sendButtonSelector: "[data-qa='texty_send_button']",
      roomTitleSelector: "[data-qa='channel_name'], .p-classic_nav__channel_header__title",
      ownMessageSelector: ".c-message--own",
    },
    generic: {
      messageListSelector: "[role='log'], [aria-label*='messages' i], .messages, .chat-box",
      messageItemSelector: "[role='listitem'], .message, .chat-message",
      contentSelector: ".text, .content, p",
      inputBoxSelector: "textarea, [contenteditable='true'], [role='textbox']",
      sendButtonSelector:
        "button[type='submit'], .btn-send, [data-testid='send-button'], button[aria-label*='Send' i], button[aria-label*='Gửi' i]",
    },
  },
}
