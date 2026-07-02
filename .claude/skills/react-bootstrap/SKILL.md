---
name: react-bootstrap
description: Project scaffolding for the first 5 minutes of a React interview build — Vite + React + TypeScript + Tailwind as the primary scaffold, Next.js App Router as alternate, "they gave me a starter repo" path (most likely Netlify scenario), file structure recommendations, useful dependencies (clsx + tailwind-merge + zod), App.tsx skeleton with brief-restate header, README starter, Tailwind config, what NOT to set up. Use at the start of any interview build to skip 5–10 minutes of setup decisions. Triggers on "scaffold", "bootstrap", "project setup", "first 5 minutes", "vite", "create vite", "package.json", "tailwind config", "App.tsx", "start a project", "new project", "set up", "initial setup", "starter repo".
---

# react-bootstrap

The first 5 minutes of an interview build are usually setup. Done badly, they consume 10–15 minutes and break flow. Done well, they take 3 minutes and you're typing JSX with everything wired.

Three setup paths in order of likelihood for a Netlify-style technical project:

1. **Path 0**: "They gave me a starter repo" (most likely — drop in and adapt)
2. **Path 1**: Vite + React + TypeScript + Tailwind (most likely default if you pick the stack)
3. **Path 2**: Next.js App Router (alternate if Next is required)

---

## Path 0: GitHub-based exercise repo (the Netlify format)

The Netlify Senior UX Engineer technical stage uses this path. You're invited to a private GitHub repo, clone it in advance, the exercise is pushed 5–10 min before the 1:00 PM PST start, you pull, work locally, and push to submit.

### Pre-flight (do the night before / morning of)

```bash
# Verify Node v22+ (Sam confirmed this requirement)
node --version

# If not v22+:
# nvm install 22 && nvm use 22
# brew install node@22                (macOS)

# Verify Node actually runs
echo 'console.log("ok")' > /tmp/test.js && node /tmp/test.js

# Verify git + GitHub auth
git config --global user.name
git config --global user.email
ssh -T git@github.com    # or `gh auth status`

# Verify Claude Code session works
```

### When the invite arrives

```bash
# Clone the (initially empty) repo
git clone git@github.com:[org]/[repo].git
cd [repo]

# Confirm clone worked
ls -la
git log --oneline    # likely empty / "initial commit"
```

### When the exercise is pushed (~12:50 PM PST)

```bash
git pull
ls -la                    # see what was added
cat README.md             # read the prompts
```

The repo likely contains:
- A `README.md` with one or multiple exercise prompts
- Possibly a starter codebase (with `package.json`, source files)
- Possibly multiple folders for multiple exercises

### Multi-exercise format

Sam's message confirmed: **"a few programming, collaboration, and UX design exercises"**. The repo will likely contain multiple exercises across categories. Treat each as its own scoped task:

1. **Read every prompt first.** Understand the full set before starting any one.
2. **Budget time across exercises.** 2 hours total. For 3 exercises, plan ~30–40 min each with buffer.
3. **Don't over-invest in one.** The recruiter explicitly said: not testing completeness or cleverness. A solid pass at all of them beats one polished + others empty.
4. **Use git as you go.** Commit per exercise (or logical step) with clear messages — the commit history is part of what they see.

### Setup commands

```bash
# Install deps if a package.json is provided
npm install
# (or: pnpm install / yarn — match what the README says)

# Start the dev environment (if any)
npm run dev    # or whatever's in the README's scripts
```

### Recon in the first 5 minutes

1. **Read every prompt** in the README before coding anything
2. **Check `package.json`** — what's the stack? What's pre-installed?
3. **Check the file structure** — where does new code go?
4. **Test Node + the dev script** — confirm the environment works
5. **Add a brief-restate comment** at the top of your first edit, if appropriate (see `react-docs-writing`)

### Branching strategy

**Default: work on `main`**, push commits as you go.

```bash
git add .
git commit -m "Exercise 1: implement billing toggle"
git push
```

Unless the README specifies a branch or PR workflow, pushing to `main` is simplest. **Don't open PRs unless asked** — the README is the source of truth for submission protocol.

### Commit messages — make `git log --oneline` tell a story

Use Conventional Commits or just clear prose. Examples:

Good:
```
feat: add Pricing component with 3 tiers and billing toggle
feat: add aria-live region for screen reader price updates
refactor: extract PricingTier to its own file
docs: add README with decisions and tradeoffs
fix: keyboard focus order in mobile menu
```

Bad:
```
wip
fix bug
more changes
final
```

A reviewer reading `git log --oneline` should understand the build's progression — Sam and Nathan will look at this.

### Submission

```bash
git add .
git commit -m "Final: README polished, all exercises submitted"
git push
```

Then a quick Slack message confirming submission (see `react-interview-async-slack` Template 5).

### AI tools

Sam explicitly allowed: *"any resources you'd like… Google, AI agents, etc."* Use Claude Code openly. Be ready to talk about how you used it in the Wednesday review — that's a signal, not a stigma.

---

---

## Path 1: Vite + React + TypeScript + Tailwind (you pick the stack)

The fastest "real" React setup.

### Create the project

```bash
npm create vite@latest my-project -- --template react-ts
cd my-project
npm install
```

### Add Tailwind v4 (current)

```bash
npm install tailwindcss @tailwindcss/vite
```

Update `vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

Replace `src/index.css`:
```css
@import "tailwindcss";

/* Design tokens */
@theme {
  --color-brand: hsl(173 80% 40%);
  --color-brand-hover: hsl(173 80% 35%);
  --color-fg: hsl(0 0% 10%);
  --color-fg-muted: hsl(0 0% 40%);
  --color-bg: hsl(0 0% 100%);
  --color-border: hsl(0 0% 90%);
  --color-danger: hsl(0 70% 50%);
  --color-success: hsl(140 70% 40%);

  --ease: cubic-bezier(0.4, 0, 0.2, 1);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

For Tailwind v3 (older starter): `npx tailwindcss init -p`, put `@tailwind base; @tailwind components; @tailwind utilities;` in `index.css`, and configure `content` glob in `tailwind.config.js`.

### Useful deps — install as needed

```bash
# Class composition — almost always
npm install clsx tailwind-merge

# Form validation — if forms are in the brief
npm install zod

# Form library — only if a complex multi-field form
npm install react-hook-form @hookform/resolvers

# Icons
npm install lucide-react

# Headless primitives — only for complex composite widgets (overkill for most 2hr builds)
npm install @radix-ui/react-dialog @radix-ui/react-tabs
```

**Don't install** what you won't use. An empty `package.json` is fine; a bloated one signals poor judgment.

### `src/lib/cn.ts`

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

(See `react-utility-snippets` skill for more paste-ready hooks.)

### `src/App.tsx` skeleton

```tsx
/**
 * [Project name]
 *
 * Brief: [paste / paraphrase the assignment here]
 *
 * Interpretation: [one-sentence reading of the brief]
 *
 * Out of scope (see README):
 * - [thing 1]
 * - [thing 2]
 * - [thing 3]
 */

import { ComponentName } from './components/ComponentName';

export default function App() {
  return (
    <main className="min-h-screen">
      <ComponentName />
    </main>
  );
}
```

### Recommended file structure (small project)

```
src/
  components/
    ComponentName.tsx           // main component
    [SubComponent.tsx]          // only if needed
  lib/
    cn.ts
    [hooks.ts]                  // useMediaQuery etc. if used
  App.tsx
  main.tsx
  index.css
```

Don't over-structure. Flat `components/` is fine under ~10 components.

### Start the dev server

```bash
npm run dev
```

Opens at http://localhost:5173. The "Tailwind reset wiped the default Vite splash" moment is your smoke test that setup worked.

---

## Path 2: Next.js App Router (alternate)

Only use if Next is specified or you have a strong reason. Next is overkill for a 2-hour single-component build.

```bash
npx create-next-app@latest my-project --typescript --tailwind --app --eslint
cd my-project
npm run dev
```

App Router structure:

```
app/
  layout.tsx                 // <html>, fonts, providers
  page.tsx                   // your main page
  globals.css                // Tailwind imports
  components/                // (or root-level /components — preference)
    ComponentName.tsx
  lib/
    cn.ts
```

### `app/layout.tsx`

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Project',
  description: 'Brief description for SEO + social',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

### `app/page.tsx`

```tsx
/**
 * [Project name]
 *
 * Brief: [paste / paraphrase here]
 * Interpretation: [one-sentence reading]
 * Out of scope: [things you're not building]
 */

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Your component */}
    </main>
  );
}
```

### `'use client'` placement rules

- **Default to Server Component.** Don't add `'use client'` until you have a reason.
- Add it at the **leaf** that needs interactivity, not the root.
- A page can be a Server Component that imports Client Components.

```tsx
// app/page.tsx — Server Component (no 'use client')
import { Hero } from './components/Hero';
import { NewsletterForm } from './components/NewsletterForm';   // Client

export default function Page() {
  return (
    <main>
      <Hero />
      <NewsletterForm />
    </main>
  );
}

// app/components/NewsletterForm.tsx
'use client';
import { useState } from 'react';
// ...
```

See `react-modern-react` skill for full RSC patterns.

---

## Recommended deps quick reference

| Dependency | When to add |
|---|---|
| `clsx` + `tailwind-merge` | Almost always (for `cn`) |
| `zod` | If validation is needed |
| `react-hook-form` + `@hookform/resolvers` | Complex form (6+ fields, cross-field rules) |
| `lucide-react` or `@heroicons/react` | Icons |
| `@radix-ui/*` | Production-grade headless components (often overkill for 2hr builds) |
| `framer-motion` | Only if exit animations or gestures |
| `date-fns` or `Intl` | Date formatting — prefer `Intl.DateTimeFormat` if simple |

**Don't install**:
- Routing library (use the framework's routing or none)
- State management (Redux/Zustand/Jotai) — over-engineering for a 2-hour build
- UI kit (MUI, Chakra, Mantine) — you're evaluated on UX engineering; show your work
- CSS-in-JS library (styled-components, emotion) — Tailwind/CSS Modules are fine

---

## README starter (paired with `react-docs-writing` skill)

Drop this in `README.md` at the start of the build:

```markdown
# [Project name]

[One sentence describing what you built, matching the brief.]

## How to run

\`\`\`bash
npm install
npm run dev
\`\`\`

Opens at http://localhost:5173.

## Architecture

[Fill in after you build — see `react-docs-writing`.]

## Key decisions

[Fill in as you build, not at the end.]

## What's next

[Fill in last — what's out of scope for the time-boxed version.]
```

You'll fill in details from `react-docs-writing` as you build. **Don't leave the README for the last 5 minutes.**

---

## What NOT to set up

Skip these unless the brief explicitly asks:

| Skip | Reason |
|---|---|
| Test framework (Vitest, Playwright) | Time sink for a 2-hour build; note in README "would add Playwright next" |
| Storybook | Massive setup overhead |
| ESLint custom config | Default from `create-vite` is fine |
| Prettier config | Default is fine |
| CI/CD | Not running it |
| Husky / lint-staged | Not relevant |
| `.env` files | Unless the brief uses API keys |
| Authentication | Mock it; never build real auth in 2 hours |
| Database | Mock data in a `.ts` file |
| Monorepo / workspaces | Total overkill |
| Custom build pipeline | Vite/Next defaults work fine |
| Path aliases for 3 files | Use relative imports; add aliases when they hurt |
| Custom `tsconfig.json` | Defaults are fine |

---

## Common bootstrap pitfalls

| Pitfall | Fix |
|---|---|
| Spending 20 min on Tailwind config | Use `@theme` (v4) or defaults (v3) and move on |
| Installing 12 deps before writing JSX | Install as you need them |
| Creating folders for one file each | Flat structure first; nest when there's a reason |
| Setting up testing before building | Add tests last (or note in README) |
| Configuring path aliases for 3 files | Relative imports until they hurt |
| Spending time on a custom theme system | Tokens via CSS custom properties; don't over-engineer |
| Adding a router for a single page | Skip routing entirely |
| `TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled` | See gotcha below |

## Gotcha: `erasableSyntaxOnly` in the current Vite template

`create-vite@9+` ships `tsconfig.app.json` with `"erasableSyntaxOnly": true`. That flag forbids any TypeScript syntax that would produce different runtime JS — most notably **constructor parameter properties** and `enum`. Code that compiled cleanly under older templates now fails the production build.

Symptom (from a real build):

```
src/api/client.ts(15,5): error TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.
```

The offending pattern — `readonly` shorthand on constructor parameters:

```ts
// Fails under erasableSyntaxOnly
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
  }
}
```

Fix — declare fields explicitly and assign in the body:

```ts
// Works
export class ApiError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(message: string, status: number, url: string) {
    super(message);
    this.status = status;
    this.url = url;
  }
}
```

Same goes for `enum` (use `as const` object literals or string-union types) and namespaces. `dev` mode lets these slide via esbuild; only `tsc -b && vite build` catches them — so always run a production build before declaring setup done.

---

## The "is setup done?" smoke test

You're done with setup when:

- [ ] `npm run dev` shows your page (even if blank)
- [ ] You can edit `App.tsx` and see hot-reload
- [ ] Tailwind classes apply (test with `className="bg-red-500"` on `<main>`)
- [ ] `cn.ts` is in `src/lib/`
- [ ] Brief-restate comment is at the top of the entry file
- [ ] `README.md` has the skeleton

Total time: 3–5 minutes. Move to building.

---

## Narration phrases

- "I scaffolded with Vite + Tailwind v4 — fast HMR, no Next overhead since this is a single component."
- "I deliberately kept dependencies minimal — `clsx` and `tailwind-merge` for class composition, that's it. Each dep is a decision to defend."
- "I didn't set up tests for the time-boxed version. With more time I'd add Playwright for the keyboard flow and Vitest for the price calculation."
- "Brief-restate comment at the top of `App.tsx` so the reviewer sees my reading first."

## Authoritative references

- Vite docs: https://vite.dev/guide/
- Tailwind v4: https://tailwindcss.com/docs/installation
- Next.js App Router: https://nextjs.org/docs/app
- `create-next-app` reference: https://nextjs.org/docs/app/api-reference/cli/create-next-app
- TypeScript + React: https://react.dev/learn/typescript
- shadcn/ui (component API reference, not for building, for studying): https://ui.shadcn.com/
