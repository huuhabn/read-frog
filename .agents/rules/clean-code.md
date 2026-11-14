## Small, Focused Functions

- One function = one job at one level of abstraction. If its name needs "and" (or vague words like `handle`, `process`, `manage`), split it.
- Layer the work instead of putting it in one method:
  1. parse/validate input
  2. pure transformation (no I/O)
  3. side effects (storage, network, messaging, DOM)
  4. map to result/response
- Keep pure logic separate from side effects so it is testable without mocking `browser.*`.
- Handlers (message listeners, event handlers, React callbacks) only orchestrate: call named functions in order, no inline business logic.
- Use guard clauses/early returns. If you need a third nesting level, extract the inner block.
- No boolean flag parameters that switch behavior (`doX(data, true)`); write two functions.
- More than 3 parameters: use a typed options object.
- Name complex conditions (`isEligibleForMasking`) instead of inlining them.
- A comment that labels a block ("// now save the data") means that block should be a named function.
- Split by reason to change: parts that change for different reasons live in different functions/modules.

## Small Files

- One file = one responsibility. Move to separate files: types shared by 2+ files, constants, pure helpers, hooks, and sub-components that are more than a few lines.
- File name matches its main export (`IconTooltip.tsx` -> `IconTooltip`, `use-pii-mask.ts` -> `usePiiMask`).
- Colocate by feature (components, hooks, types, constants together). Promote to shared (`@/components`, `@/utils`) only when a second feature needs it.
- No barrel files (`index.ts`) in hot paths (content scripts, background); import from the specific file.

## Reuse

- Rule of three: extract a component/hook/helper on the third occurrence. Two similar copies may stay if they are likely to diverge.
- Extract only the repeated part, with a minimal typed `XxxProps`. No props for hypothetical future cases.
- Prefer composition (`children`, `render`) over many boolean/variant props.
- Reusable UI goes in `@/components/ui/*`; feature-specific UI stays in its feature folder.
- React: when a component mixes data fetching, state, and markup, extract a `useXxx` hook and/or child components.

## Review Signals (refactor if any is true)

- You must scroll to read a function or component.
- Sections separated by blank lines/comments like "step 1, step 2".
- A test needs many mocks to cover one function.
- A file exports several unrelated things.