# Styling, Theme & Layout Rules

This guide defines styling conventions for Workmate AI UI components using **Tailwind CSS v4** and CSS custom properties scoped with the `--rf-*` prefix.

---

## 1. Token Isolation & Host Protection

- **CSS Prefix**: All design tokens use the `--rf-*` prefix (`--rf-background`, `--rf-foreground`, `--rf-primary`, `--rf-card`, `--rf-border`, etc.) mapped via `@theme inline` in `src/assets/styles/theme.css`.
- **Why**: Content scripts render inside host pages. Scoped tokens prevent host websites from overriding extension styles or vice-versa.
- **Dark Mode**: Configured via `@custom-variant dark (&:is(.dark *));`. Toggled by adding/removing the `.dark` class on the container or root element.

---

## 2. Mandatory Rules for AI Agents

### Rule 1: Always Use Semantic Design Tokens
- Default to Tailwind semantic classes rather than fixed hex codes:
  - **Surfaces**: `bg-background`, `bg-card`, `bg-popover`, `bg-muted`
  - **Text**: `text-foreground`, `text-card-foreground`, `text-muted-foreground`
  - **Borders & Dividers**: `border-border`, `divide-border`
  - **Accents**: `bg-primary text-primary-foreground`, `bg-secondary text-secondary-foreground`
  - **Focus Rings**: `ring-ring`
- **NEVER** write hardcoded colors like `bg-[#22c55e]` or raw `bg-white` without ensuring dark mode compatibility (`dark:bg-*`).

### Rule 2: Guarantee Dual-Mode (Light & Dark) Compatibility
- Every component must look polished and legible in both Light and Dark modes.
- Test contrast on text, icon fills (`fill="currentColor"`), badges, and borders.
- Modals, dropdowns, and sidepanel sheets must have dark mode borders and surfaces.

### Rule 3: Maintain LTR Flow & Logical Properties
- The extension UI uses an LTR (Left-To-Right) baseline.
- Prefer Tailwind logical properties to maintain layout flexibility:
  - Margins: `ms-*` / `me-*` (margin-inline-start / end)
  - Padding: `ps-*` / `pe-*` (padding-inline-start / end)
  - Text alignment: `text-start` / `text-end`
- When rendering user-generated or translated content with mixed scripts (e.g. Arabic or Hebrew within English), wrap in `<bdi>` (Bi-Directional Isolation).

### Rule 4: Border Radius & Micro-Interactions
- Follow standard rounded scale:
  - Cards, panels, dialogs: `rounded-xl` or `rounded-2xl`
  - Inputs, select pickers, action buttons: `rounded-lg` or `rounded-md`
  - Badges, pills, tags: `rounded-full`
- Keep transitions snappy (150ms-250ms ease-out) to maintain a responsive native feel.
