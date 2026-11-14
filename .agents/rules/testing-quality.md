# Testing, Code Quality & Release Rules

All AI coding agents working on Workmate AI must adhere to the package management, linting, testing, and Git workflow standards outlined below.

---

## 1. Package Management & Tooling

- **Package Manager**: **`pnpm`** exclusively. Never run `npm`, `yarn`, or `bun`.
- **Linter & Formatter**:
  - `pnpm lint` (`oxlint --type-aware --type-check`)
  - `pnpm fmt:check` / `pnpm fmt` (`oxfmt`)
- **Test Runner**:
  - `pnpm test --run` (`vitest run`)

---

## 2. Testing Constraints

### Rule 1: Local Testing with `SKIP_FREE_API=true`
- `src/utils/host/translate/api/__tests__/free-api.test.ts` connects to live external translation services that rate-limit or fail without network credentials.
- When executing tests locally, **ALWAYS set `SKIP_FREE_API=true`**:
  ```bash
  SKIP_FREE_API=true pnpm test --run
  ```
- Treat `free-api.test.ts` as intentionally skipped when `SKIP_FREE_API=true` is present.

### Rule 2: Test Integrity
- New utility functions, stores, parsers, and transformers must include unit tests located in sibling `__tests__/` directories (`*.test.ts` or `*.test.tsx`).
- Never disable or remove existing unit tests to make a build pass without explicit justification.

---

## 3. Site Rules Publishing & Versioning

- `src/utils/site-rules/built-in/rules.json` is published automatically to installed extensions on every merge to `main` (`.github/workflows/publish-site-rules.yml`).
- If a site rule depends on new extension code in the same PR:
  - Set `"minExtensionVersion"` to the version that code will ship in (current `package.json` version with patch bumped). Older versions will keep their existing rules.
- Rule CSS restrictions:
  - Do not use external asset loading (`url(`, `image-set(`, `image(`, `src(`, `@import`).
  - No CSS string may end with a hex escape like `\75`.

---

## 4. Git Commits & Changesets

- **Commit Format**: Conventional commit syntax is strictly required:
  - `feat(web-chat): add auto-reply toggle to sidepanel toolbar`
  - `fix(telegram): fix auto send selector in telegram web k`
  - `perf(sidepanel): lazy-load AI SDKs to accelerate startup`
  - `docs(readme): update features and architecture guide`
  - `chore(deps): update dependencies`
  - Do NOT include custom prefixes like `[codex]`.
- **Changesets**:
  - Every user-facing feature or bug fix must include a `.changeset/*.md` file (`pnpm changeset` or manual markdown in `.changeset/`) with a conventional commit summary.
