# Extension Architecture & Performance Rules

This project is a high-performance Browser Extension built with **WXT (Web Extension Tools)**, **Vite**, **React 19**, and **TypeScript** (Manifest V3). All AI coding agents modifying extension components must adhere strictly to these architecture rules.

---

## 1. Entrypoints & Contexts

The extension code is strictly segmented into discrete MV3 execution environments:
- **`src/entrypoints/background/`**: Background service worker. Runs headless, manages extension lifecycle, native alarms, context menus, and global coordination. No DOM access.
- **`src/entrypoints/sidepanel/`**: Multi-tab sidepanel UI (`Chat`, `WebChat`, `Read`, `Write`, `Translate`). Must launch instantaneously (<100ms).
- **`src/entrypoints/options/`**: Full-page settings & provider management (`/providers`, side sheet config).
- **`src/entrypoints/popup/`**: Toolbar action popup.
- **`src/entrypoints/*.content/` & `content-runtime`**: Content scripts injected into host web pages. Uses `@webext-core/isolated-element` (Shadow DOM) to isolate extension CSS/DOM from host sites.
- **`src/entrypoints/offscreen/`**: Offscreen document for DOM/audio operations disallowed in service workers.

---

## 2. Critical Bundle & Performance Rules

### Rule 1: Zero Heavy AI SDKs in Initial Bundle
- **NEVER** statically import heavy SDKs (`@ai-sdk/*`, large translation engines, CodeMirror) in `sidepanel`, `popup`, or `content` entrypoints.
- Always use dynamic imports (`await import(...)`) at the exact execution boundary (e.g., when a user clicks translate or submits an AI prompt).
- Static imports pull megabytes of AI SDKs into critical script paths, degrading sidepanel opening speed and inflating memory footprint.

### Rule 2: Code-Split Views & Lazy Rehydration
- Sidepanel tab views (`ChatView`, `WebChatView`, `ReadView`, `WriteView`, `TranslateView`) must remain lazy-loaded (`lazy(() => import(...))`) wrapped in `Suspense` with lightweight skeleton loaders.
- Storage rehydration must be non-blocking: mount the UI immediately with default state from stores, then rehydrate asynchronously in the background.
- Defer non-critical DOM scraping and external calls (such as reading active tab content) until after initial mount or user interaction.

### Rule 3: Isolated Content Scripts
- Injected UI widgets (such as Web Chat auto-reply bars, subtitle overlays, selection toolbars) must render inside isolated shadow roots via `@webext-core/isolated-element`.
- Never inject un-scoped global CSS that could break host page styles.

---

## 3. Communication & State Management

- **Messaging**: Use `@webext-core/messaging` with type-safe schemas (`defineExtensionMessaging`). Never use raw `chrome.runtime.sendMessage` with unvalidated payloads.
- **Storage**: Use WXT's typed storage API or Jotai/TanStack stores. Keep persistent keys minimal, structured, and synchronized across tabs when needed.
- **Event Subscriptions**: Always clean up event listeners, message ports, and MutationObservers in React `useEffect` cleanup returns or extension unmount hooks.
