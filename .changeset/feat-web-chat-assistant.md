---
"workmate-ai": minor
---

feat(web-chat): add AI Web Chat assistant for Zalo, Telegram, Slack, and universal chat

- Implement `IChatAdapter` architecture with specialized adapters for Zalo Web (`chat.zalo.me`), Telegram Web (`web.telegram.org`), Slack Web (`app.slack.com`), and generic chat fallback
- Add DOM text insertion utilities with `insertText`, `ClipboardEvent` paste fallback, and contenteditable support
- Implement PII Masking with Vietnamese phone numbers, bank accounts (STK), CCCD/CMND, and email masking before LLM transmission and automatic unmasking on return
- Add real-time inbound translation via Shadow DOM sub-lines and viewport batching (`IntersectionObserver`)
- Add real-time outbound translation preview (`Ctrl+Shift+E` and debounce trigger)
- Add Shadow DOM Floating Menu with 4 quick actions: Dịch (Translate), Viết lại (Rewrite with 3 tones), Trả lời (Smart reply), and Hỏi AI (Contextual ask)
- Add Slash Command Palette (`/reply`, `/tone`, `/dich`, `/tpl` with `{{ten_nguoi_nhan}}` variable substitution) with keyboard capture handling
- Add dedicated Web Assistant tab in Side Panel with room context header, quick action chips, and per-room result caching
- Add full Web Chat settings page in Options with configuration for translation, slash commands, supported platforms, and PII privacy toggles
- Support Upwork and Web Chat in Feature Providers configuration (`options.apiProviders.featureProviders`), enabling dedicated LLM provider routing per feature with graceful fallback
- Add full i18n localization support across Options, Sidepanel, Floating Menu, and Slash Commands in both English and Vietnamese
- Standardize diagnostic logging with `createLogger` in place of raw console calls
- Add dedicated `translateChatText` LLM service, disable inbound auto-translate by default (`translateEnabled: false`), and add language/quota safeguards to prevent API rate limit (429) errors
- Fix "Cannot use 'in' operator to search for 'kind' in null" error in options page when rendering unselected provider options, add null-safety guards in provider-display and provider-selector, and localize language dropdowns in Web Chat and Upwork settings
- Add Chat Tone and Rules settings in Web Chat options, integrate `LanguageCombobox` for incoming, outgoing, and Upwork content language, and introduce compact session override controls (Model, Language, Tone) on the Sidepanel header with full Vietnamese and English multilingual support
- Add complete unit test coverage for adapters, PII masking, slash commands, DOM utilities, and settings
