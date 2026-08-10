# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Frontend of the iReports monorepo. See the [root CLAUDE.md](../CLAUDE.md) for the overall
product/architecture picture. This file covers frontend-specific commands and conventions.

## Commands

Run from `frontend/`.

All tooling config files (`tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`,
`eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `components.json`, `vite.config.ts`) live
under `src/config/`, not at the `frontend/` root — the npm scripts below already point at them via
`--config`/`-b`/`--ignore-path`. Pass the same flag if you invoke `vite`/`tsc`/`eslint`/`prettier`
directly instead of through `npm run`. `npx shadcn add ...` doesn't take a `--config` flag — pass
`--cwd src/config` instead (shadcn CLI resolves `components.json` from `cwd`, and `components.json`'s
own paths were adjusted for that: `"css": "../index.css"` etc.).

```bash
npm run start           # vite --config src/config/vite.config.ts
npm run build            # tsc -b src/config/tsconfig.json && vite build --config src/config/vite.config.ts
npm run lint              # eslint --config src/config/eslint.config.js . (includes FSD boundary rules, see below)
npm run format             # prettier --config src/config/.prettierrc.json --ignore-path src/config/.prettierignore --write .
npm run format:check
npm run preview
```

There is no test runner configured in `package.json` — don't assume `npm test` works.

## Architecture: Feature-Sliced Design

The app follows **Feature-Sliced Design** with import direction enforced at lint-time by
`eslint-plugin-boundaries` (see `eslint.config.js`, rule `boundaries/dependencies`). Layers, from
top (composition root) to bottom (pure infrastructure):

- **`app`** — application bootstrap and wiring (`main.tsx`, `router.tsx`, `Layout.tsx`, `Header.tsx`).
  Can import from any layer. No other layer may import from `app`.
- **`pages`** — one folder per route/screen (`pages/FunnelReport`, `pages/SalaryReport`,
  `pages/ServicesReport`). A page may import `features`, `kernel`, `shared`, and its own submodules,
  but **not** another page — cross-page imports are lint errors.
- **`features`** — business-logic-bearing, reusable units (chart widgets, tables) such as
  `features/DealsFunnelChart`, `features/ServicesTable`. May import `kernel`/`shared` and its own
  submodules, but **not** another feature — cross-feature imports are lint errors.
- **`kernel`** — global interfaces, types, and constants shared across the app (`kernel/types.ts`,
  `kernel/chartColors.ts`). No incoming imports from outside kernel; kernel itself may only import
  kernel.
  - "kernel ничего не принимает извне, кросс-импорт внутри слоя разрешён"
- **`shared`** — pure infrastructure (API client, generic UI primitives, hooks, utils). **No business
  logic is allowed here.** Must not import anything from other layers — it's the leaf dependency
  everything else builds on.
  - "ТУТ ЗАПРЕЩЕНО НАХОДИТЬСЯ ЛЮБОЙ БИЗНЕС ЛОГИКЕ"

`features/<X>` and `pages/<X>` typically split internally into `model/` (hooks, data-fetching, state)
and `ui/` (components) — see e.g. `features/DealsTable/{model,ui}` or
`pages/ServicesReport/{mediator,model,ui}`. `pages/ServicesReport` additionally has a `mediator/`
folder coordinating multiple features/model hooks for that page — follow that split for pages
composing several stateful widgets rather than putting everything in one component.

When adding a new module, decide its layer first: page-specific UI/state → `pages/<Page>`; a
reusable, business-aware widget → new `features/<Feature>`; a cross-cutting type/constant → `kernel`;
generic, business-agnostic infra → `shared`. Violating the boundaries rule fails lint, not just
review.

### Data fetching

- **TanStack Query** for server state; the query client is configured in `shared/api/query-client.ts`,
  the axios instance (base URL, interceptors) in `shared/api/axios.instance.ts`.
- Request/response types come from the `ireports-contracts` workspace package, shared with the
  backend (same Zod schemas) — don't hand-roll duplicate types for API payloads that already have a
  contract.
- API errors are normalized via `shared/errors/apiError.ts`.

### UI

- **Tailwind CSS v4** + **shadcn/radix-ui** primitives live in `shared/ui/` (`button.tsx`, `select.tsx`,
  `table.tsx`, `calendar.tsx`, etc.) — reuse these rather than hand-rolling new primitives.
  `components.json` configures the shadcn CLI.
- Chart-specific layout wrappers (`ChartLayout`, `ChartHeader`, `KpiCard`) are also in `shared/ui/`
  and used across the analytics `features/*Chart*` modules; **Recharts** is the underlying charting
  library.
- Path aliases and TS project references are split across `tsconfig.app.json` (app code) and
  `tsconfig.node.json` (Vite config) — see `tsconfig.json` for the references list.