---
"workmate-ai": patch
---

feat(web-chat): scope Auto Reply per room and add sub-line language auto-detect

- Add 2-layer language auto-detection for inbound translation sub-lines: pre-detection via offline language heuristics (`isLikelyVietnamese` / `franc` / `@read-frog/definitions`) to skip API calls when message is already in target language, and post-check to suppress sub-line injection if translated text is identical to original text
- Fix sub-line Shadow DOM CSS layout to strictly float and align left (`clear: both`, `float: left`, `text-align: left`, `align-self: flex-start`, `width: 100%`), preventing misalignments caused by parent chat message styling or flexbox container properties
- Scope Auto Reply mode (`none` | `draft` | `send`) and session overrides (Model, Language, Tone) per chat room (`roomId`), persisting room configurations in WXT local storage (`webchat_room_settings`)
- Ensure periodic Auto Reply only evaluates and triggers for the actively opened room according to that room's individual settings, preventing accidental cross-room replies when switching conversations
- Add room-level settings reset button on Sidepanel header to restore individual chat rooms to global defaults
- Add explicit per-room Sub-line toggle option in Sidepanel header and room settings, preventing automatic sub-line injection unless explicitly activated for that room
- Add `genericMatchUrls` configuration with `PatternsTable` in Web Chat settings: GenericChatAdapter only matches URLs defined in `genericMatchUrls` (empty by default), and delay remote config fetch to only trigger when an active chat adapter is matched, preventing extraneous API calls on general web browsing
