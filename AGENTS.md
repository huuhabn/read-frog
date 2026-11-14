# AGENTS.md

Operational and development guide for AI agents working in the **Workmate AI** codebase.

---

## 1. Project Overview & Tech Stack

Workmate AI is a high-performance Browser Extension (Manifest V3) built with:

- **Framework**: [WXT](https://wxt.dev/) with Vite
- **UI & Components**: React 19, Tailwind CSS v4, `@base-ui/react`, Radix UI slots, Lucide / Tabler / Remixicon
- **State & Storage**: Jotai, TanStack React Store, WXT Storage
- **Linter & Formatter**: Oxlint (`oxlint`), Oxfmt (`oxfmt`)
- **Testing**: Vitest (`vitest`)
- **Package Manager**: `pnpm` exclusively

---

## 2. Architecture & Entrypoint Separation

Extension code is partitioned into distinct Manifest V3 execution environments:

- **`src/entrypoints/background/`**: Background service worker (headless coordination, alarms, lifecycle).
- **`src/entrypoints/sidepanel/`**: Multi-tab sidepanel UI (`ChatView`, `WebChatView`, `ReadView`, `WriteView`, `TranslateView`).
- **`src/entrypoints/options/`**: Full settings page (`/providers`, side sheet configuration).
- **`src/entrypoints/popup/`**: Action toolbar popup.
- **`src/entrypoints/*.content/` & `content-runtime`**: Injected scripts running inside host pages. Injected UI must use `@webext-core/isolated-element` (Shadow DOM).
- **`src/entrypoints/offscreen/`**: Offscreen document for audio synthesis and DOM operations unavailable in the service worker.

---

## 3. Sidepanel Performance & Bundle Budget

### Critical Bundle Constraint

- **NEVER** import large libraries (`@ai-sdk/*`, heavy translation engines, CodeMirror) statically into `sidepanel`, `popup`, or `content` entrypoints.
- **Always** use dynamic imports (`await import(...)`) at the point of action (e.g. `executeTranslate` or LLM streaming).
- Sidepanel tab views must be code-split with `lazy(() => import(...))` and rendered inside `Suspense` with `SidePanelSkeleton`.
- Initial mount must never be blocked by synchronous storage fetching or external scraping; render immediately with store defaults, then rehydrate asynchronously.

---

## 4. Key Feature Architectures

### AI Web Chat Assistant (`src/features/web-chat/` & `src/entrypoints/sidepanel/views/web-chat-view.tsx`)

- Supports multiple web chat platforms: Telegram Web (A and K versions), Zalo Web, Slack, and Generic Web Chats.
- Capabilities: PII redaction, tone adjustment, smart multi-reply suggestions, Auto Draft mode, and Auto Send mode.
- Injected DOM interactions must be resilient to SPA framework updates and class name mutations.

### Upwork Assistant (`src/utils/sidepanel/upwork.ts`)

- Features: Job post extraction, screening question answer generation, customized cover letter drafting, and token usage logging.
- Heavy translation and AI dependencies are dynamically imported to avoid bloating the sidepanel bundle.

### Provider System (`src/entrypoints/options/pages/providers/`)

- Unified interface for 20+ AI providers (OpenAI, Anthropic, Gemini, Groq, DeepSeek, Ollama, OpenRouter, etc.).
- Provider configurations are edited in a responsive side sheet.

---

## 5. Testing Notes

- `src/utils/host/translate/api/__tests__/free-api.test.ts` depends on live external translation services.
- When running tests locally as an AI agent, set `SKIP_FREE_API=true`:
  ```bash
  SKIP_FREE_API=true pnpm test --run
  ```
- If `SKIP_FREE_API=true` is set, treat `free-api.test.ts` as intentionally skipped during local validation.
- Run linter before finalizing changes:
  ```bash
  pnpm lint
  ```

---

## 6. Site Rules Notes

- `src/utils/site-rules/built-in/rules.json` is also published to installed extensions on every merge to `main` that changes it (`.github/workflows/publish-site-rules.yml`), and they pick it up within about six hours. Code still only ships with a release.
- If a rule depends on code in the same PR, set `"minExtensionVersion"` on it to the version that code will ship in: the current `package.json` version with the patch number bumped. Older versions keep their bundled copy of the rule, or skip a new one. A rule using a field that older versions don't know is skipped by them automatically.
- Deleting a rule removes it from every installed version within about six hours. If new code makes a rule unnecessary, keep the rule until that code is released and delete it in a follow-up PR.
- Rule CSS can't load anything (`url(`, `image-set(`, `image(`, `src(`, `@import`), and no CSS string may end in a hex escape such as `\75`, with or without a carriage return after it, or installed extensions refuse the rule.

---

## 7. PR Notes

- PR titles must use conventional commit format, such as `fix(subtitles): ...`; avoid extra prefixes like `[codex]`.
- User-facing fixes and features should include a `.changeset/*.md` file for `workmate-ai` unless the change intentionally does not need a release. Use conventional commit format for the changeset content.
