---
name: react-docs-writing
description: Documentation patterns for React take-home projects and interview builds where documentation is an explicit deliverable — README structure (Overview / Decisions / Tradeoffs / How to Run / What's Next), in-code "why" comments (sparse, surgical), the brief-restate header at the top of the entry file, DESIGN.md / decisions log format, the "considered and rejected" template, PR description writeups, what NOT to document. Use whenever the project asks for documentation, especially for take-home interviews like the Netlify Senior UX Engineer technical project. Triggers on "README", "documentation", "design doc", "decision log", "DESIGN.md", "PR description", "code comments", "explain my code", "write docs", "take-home", "project deliverable", "Netlify project", "interview docs".
---

# react-docs-writing

Documentation patterns for take-home projects and interview builds where docs are an explicit deliverable (Netlify's Senior UX Engineer technical project is a textbook example).

**Core idea**: code shows **what** you built; docs show **why**, **what you considered**, and **what's out of scope**. Reviewers can't read your mind — write so they don't have to.

## The "first rule"

Most candidates write code and then either (a) skip docs or (b) write a README that restates what the code obviously does. Senior candidates write docs that surface the **invisible decisions**: tradeoffs they considered, scope they cut, edge cases they punted, performance choices they made.

Aim for:
- A single `README.md` a reviewer can scan in 3 minutes
- In-code "why" comments at decision points (sparse, surgical)
- Optional `DESIGN.md` if the project is bigger than ~200 lines

## README structure (use this skeleton verbatim)

```markdown
# [Project name]

[One sentence describing what was built and matching the brief.]

## Overview

2–4 sentences. What does the project do? What was the brief? Who's the
user? Don't list features — describe the experience.

## How to run

\`\`\`bash
npm install
npm run dev
\`\`\`

Opens at http://localhost:5173.

## Architecture

A short component tree and a one-line note on state ownership.

\`\`\`
<App>
  <Pricing>                // owns billing state
    <BillingToggle />      // radiogroup
    <PricingTier />        // presentational, one per tier
  </Pricing>
</App>
\`\`\`

## Key decisions

Three to five bullets, each with **what** + **why**.

- **Compound components for the toggle.** Caller controls structure;
  I own a11y wiring. A flat `<Tabs items={...}>` API would have been
  smaller but coupled to one layout.
- **Uncontrolled inputs + FormData on submit.** No per-keystroke
  re-renders. Validation runs once on submit.
- **Native `<details>` for FAQ.** Ships keyboard, focus, and screen
  reader semantics for free.

## Tradeoffs / considered and rejected

What you considered and didn't choose. 2–4 bullets.

- **Considered a state machine library (XState) for the multi-step form.**
  Rejected — the form has 3 states and a discriminated union covers it
  in 8 lines.
- **Considered animating the price change.** Skipped for time; would
  add a 200ms cross-fade gated on `prefers-reduced-motion`.

## Accessibility

What's working and what I'd want to verify.

- Keyboard-complete: Tab through CTAs, arrow keys for the radiogroup,
  Esc closes the modal.
- Focus always visible (`:focus-visible` rings).
- Errors announced via `role="alert"`; price updates in an
  `aria-live="polite"` region.
- **Not verified**: NVDA/JAWS behavior. Tested with VoiceOver only.

## What's next (out of scope)

What would be in a v2. Not an apology — a sign you saw the work.

- Real payment flow (mocked submit).
- Currency / region switcher (US-only).
- Playwright test for the keyboard flow.
- Empty state when no tiers configured.

## Tech notes

One paragraph on the stack and key dependencies.

> Built with React 19 + Vite + Tailwind. State is local; no global
> store. `clsx` + `tailwind-merge` for class composition. Zod for the
> form schema.
```

Adapt section names to the brief. If the brief uses different terminology ("design notes" instead of "key decisions"), match it.

---

## Production-OSS README extensions

The skeleton above is calibrated for **interview-deliverable** READMEs (single reviewer, time-boxed scope). When the project is a real **deployed open-source repo** — discoverable on GitHub, linkable from social, used by other developers — these sections matter too. Add them on top of the skeleton, don't replace it.

### Badge row (right under the title)

Place a single badge row immediately after the one-line description. Keep it to 3-5 badges max; more reads like cargo cult.

```markdown
# Project Name

One-sentence description matching what the project does.

**[Live demo →](https://your-app.netlify.app)** · [![Netlify Status](https://api.netlify.com/api/v1/badges/site/deploy-status)](https://app.netlify.com/sites/your-site/deploys) · [![License: MIT](https://img.shields.io/badge/License-MIT-aa3bff.svg)](LICENSE)
```

What's worth a badge:

| Badge | When to add | Source |
|---|---|---|
| **Live demo** link | Project is publicly deployed | Plain markdown link, not an image — most scannable |
| **Deploy status** | Netlify / Vercel / Cloudflare Pages | Platform-provided badge URL |
| **License** | Always, if OSS | `img.shields.io/badge/License-MIT-...` |
| **CI status** | A workflow runs tests on PRs | GitHub Actions badge URL (`actions/workflows/ci.yml/badge.svg`) |
| **Package version** | Publishing to npm | `img.shields.io/npm/v/...` |
| **Bundle size** | The bundle is a feature | `img.shields.io/bundlephobia/minzip/...` |

What's NOT worth a badge:
- "Made with React" / "Built with Vite" — covered in the Tech notes section
- "PRs welcome" — say it in CONTRIBUTING, not on a badge
- Code coverage % — Goodhart's Law fires immediately; ship the suite, not the number
- "Awesome" / "Made in [country]" — vanity, not signal

### Tests section

Goes after **How to run**, before **Architecture** or **Project structure**. Briefly state what runs and how, then table per-spec coverage so reviewers can jump to specific assertions.

```markdown
## Tests

Playwright E2E suite — N specs across M files.

\`\`\`bash
npm run e2e          # headless, against the local dev server
npm run e2e:ui       # Playwright UI mode for debugging
npm run e2e:prod     # smoke-test the deployed URL
\`\`\`

The config auto-starts the dev server when running locally — no separate
`npm run dev` needed in another terminal. See [playwright.config.ts](playwright.config.ts).

| Spec | Covers |
|---|---|
| [e2e/homepage.spec.ts](e2e/homepage.spec.ts) | List renders, filters toggle `aria-pressed`, pagination updates `aria-current` |
| [e2e/detail.spec.ts](e2e/detail.spec.ts) | Click-through, focus moves to H1, iframe `title` attribute |
| [e2e/errors.spec.ts](e2e/errors.spec.ts) | 404 alert without retry, unknown route fallback |
| [e2e/a11y.spec.ts](e2e/a11y.spec.ts) | First Tab reveals skip link, landmark count, no console errors |
```

Why a coverage table beats prose:
- Reviewers can jump straight to the spec they care about
- New contributors see what's tested without reading every file
- Forces honesty — empty rows are visible

### Live demo conventions

Place the live demo link **above the fold** — first or second line of the README. Two patterns work:

- **Inline link** in the badge row: `**[Live demo →](https://...)**` (preferred — visible without rendering badges)
- **Section header** for richer demo: a `## Demo` section with a screenshot / GIF / Loom and the link

Don't bury the demo link in "How to run" — most visitors want to *see* it before they decide whether to clone it.

### Deployment section (when the deploy is non-trivial)

If the project has meaningful deploy config beyond "push to main", add a Deployment section:

```markdown
## Deployment

Deployed to [Netlify](https://kratecms-reader.netlify.app) on every push to `main`.
Config lives in [`netlify.toml`](netlify.toml):

- `/api/*` proxies to the public API (sidesteps CORS in production)
- `/*` falls back to `index.html` (React Router handles client-side routes)
- `/assets/*` long-cached (`max-age=31536000, immutable`) — Vite outputs hashed filenames

For self-hosted deployments, point your reverse proxy at the same rules. The build is a static `dist/` directory — any static host works.
```

This section is a *production-OSS* concern. Skip it for interview deliverables.

### What NOT to add for production READMEs (still)

The "What NOT to document" rules below apply unchanged. In particular:

- Don't add a "Contributing" section with no real process behind it. Either ship CONTRIBUTING.md with actual guidelines, or leave it out.
- Don't add an "Acknowledgments" section that thanks 14 dependencies. The `package.json` is the canonical list.
- Don't add a roadmap that's aspirational rather than committed. The GitHub issues tracker is the roadmap.
- Don't add screenshots that go stale — link to the live demo instead, which updates with the code.

---

## The brief-restate comment at the top of the entry file

Senior move: open `App.tsx` (or `app/page.tsx`, or whatever the entry is) with a comment block restating the brief and your interpretation.

```tsx
/**
 * Pricing component for Netlify marketing site.
 *
 * Brief: Three tiers, monthly/yearly toggle, CTA per tier.
 *
 * Interpretation: I read this as a real component (reusable, themeable)
 * rather than a one-off layout. State for the billing period lives in
 * the parent; tier rendering is presentational.
 *
 * Out of scope (see README): real payment flow, currency switcher,
 * A/B variants.
 */
```

Why this matters:
- The reviewer reads it first → frames everything else
- It's your anchor in the review conversation
- It catches misalignment early ("oh, you read it as X — we meant Y")

---

## In-code commenting principles

Default: **no comment**. Add one only when the WHY is non-obvious from the code.

### Comment WHEN

- A decision had a real alternative ("uncontrolled because…")
- A workaround exists for a specific bug or browser quirk
- A non-obvious constraint applies ("must run before hydration")
- A line looks wrong but is correct (counterintuitive code)

### Don't comment WHEN

- The code says it (`// increment count` above `count++`)
- The function name says it (`getCustomerById` doesn't need "gets customer by id")
- The comment is `TODO` with no specifics
- The comment apologizes for the code ("hack", "this is gross")

### Good examples

```ts
// Uncontrolled because parent reads via FormData on submit;
// controlled would double renders for no benefit.
<input name="email" type="email" defaultValue="" />
```

```ts
// IntersectionObserver instead of scroll listener — scroll handlers
// fire dozens of times per second; IO fires once per visibility change.
useEffect(() => {
  const io = new IntersectionObserver(/* ... */);
  // ...
});
```

```ts
// tabIndex={-1} makes <main> focusable for the skip link without
// adding it to the natural tab order.
<main id="main" tabIndex={-1}>
```

### Bad examples (don't write these)

```ts
// Set count to 0
const [count, setCount] = useState(0);

// Map over the items
items.map(/* ... */);

// TODO: fix this later
```

A comment that disappears with a rename or refactor was probably noise.

---

## DESIGN.md / decisions log (for larger projects)

If the project exceeds ~200 lines or has multiple meaningful components, consider a separate `DESIGN.md`. Otherwise put decisions in the README.

```markdown
# Design decisions

## Component structure

[Tree, state ownership, why this shape and not another]

## State management

[Local state? Context? Reducer? Why this and not the others.]

## Validation strategy

[Where does validation live? Client only? Server too? Why.]

## Accessibility approach

[What's wired up. What's tested. What I'd verify next.]

## Performance considerations

[Anything you specifically thought about. "Nothing — premature for this scope" is a valid answer.]

## Considered and rejected

[2–5 bullets, each a real alternative you saw and didn't pick.]
```

A `DESIGN.md` is overkill for a 100-line component. Use judgment.

---

## The "considered and rejected" pattern

Every senior take-home should surface at least 2–3 things you **considered and didn't choose**. Highest-signal section in a review.

Why: it shows you saw the alternatives, made a call, can defend it. Pre-empts the reviewer's "but why didn't you…" question.

Format:

> **Considered: [alternative].** Rejected because [reason], though [acknowledgment of when it'd be the right call].

Examples:

> **Considered: react-hook-form for the contact form.** Rejected — the form has 3 fields and `useActionState` covers it without a dependency. If it grew past 6 fields or needed cross-field validation, I'd reach for RHF.

> **Considered: a custom Disclosure component with `aria-expanded`.** Rejected — native `<details>` ships the entire pattern. The only reason to roll my own would be exclusive open behavior, and `<details name>` handles that too.

> **Considered: memoizing the `<TierCard>` with `React.memo`.** Rejected — there are 3 tiers; the equality check would cost more than the recompute. If we scaled to 50 tiers I'd reconsider.

---

## PR description / writeup format (alternative when no README)

If the brief asks for a "PR description" or "summary writeup":

```markdown
## What

One sentence on what was built.

## How it's structured

Component tree + state ownership in 3–5 lines.

## Design decisions

- **[Decision]** because [reason].
- **[Decision]** because [reason].
- **[Decision]** because [reason].

## Accessibility

- [Wired]
- [Wired]
- [Verified manually with keyboard]
- [Not verified — would need real screen reader test]

## What's missing for time

- [Thing] — would take [estimate]; the [strategy] is already in place.
- [Thing] — out of scope; I'd reach for [tool] in production.

## Considered and rejected

- **[Alternative]** — [reason].
- **[Alternative]** — [reason].
```

Same content as a README, shorter framing.

---

## Collaboration writeups (commit messages, code review, written explanations)

If the exercise includes a "collaboration" component (Netlify's format explicitly includes one), your writing in commits, PR-style comments, or code review feedback is part of the eval.

### Commit messages — tell a story through `git log`

Each commit should be:
- **Scoped** — one logical change per commit
- **Imperative** — "add focus trap to modal" not "added focus trap to modal"
- **Concise** — under 70 chars for the subject line
- **Self-explanatory** — `git log --oneline` should read as a coherent progression

Good commit log:
```
feat: add Pricing component with 3 tiers and billing toggle
feat: add aria-live region so screen readers hear price updates
refactor: extract PricingTier to its own file
docs: README with decisions and tradeoffs
fix: keyboard focus order in mobile menu
```

Bad commit log:
```
wip
fix bug
more changes
final
```

Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`) is fine if you prefer structure — not required.

### Code review comments (giving feedback)

If the exercise asks you to review code, your comments are evaluated as carefully as code you write. Format each comment as:

1. **What** — the specific line or behavior
2. **Why it matters** — concrete reason, not stylistic preference
3. **Suggestion** — what you'd change (with a code snippet if non-trivial)

Example:

> **L42 — `aria-label` on a button with visible text.** Screen readers announce only the `aria-label`, so users hear "Submit" instead of the actual button text "Save changes". I'd drop the `aria-label`:
> ```diff
> - <button aria-label="Submit">Save changes</button>
> + <button>Save changes</button>
> ```

**Tone for code review:**
- **Substantive over stylistic.** "I'd rename this" is weak. "This name is ambiguous — readers won't know if it's [X] or [Y]" is strong.
- **Curious, not corrective.** "What's the reasoning for [choice]?" beats "this is wrong." You may learn something.
- **Acknowledge what's good.** 100% critique reads as adversarial. A "this is nice" comment costs nothing.
- **Separate severity.** Use prefixes: `nit:` (style), `suggestion:` (worth considering), `question:` (genuinely asking), `blocking:` (should change before merge).

### Written explanations of approach

If asked to explain why you built something a certain way (in a PR description, a doc, or a Slack message), the structure is:

1. **What it does** — one sentence
2. **Why this approach** — the key tradeoff you saw
3. **What you considered** — 1–2 alternatives and why you didn't pick them
4. **What's open / out of scope** — honest scope statement

Example:

> The newsletter form uses uncontrolled inputs with `FormData` on submit, validated via Zod. I went uncontrolled because the form submits as a unit and I didn't need per-keystroke state — no re-renders during typing. The alternative was `react-hook-form`, which I considered but felt overkill for 3 fields. Out of scope: real API integration (mocked the submit) and i18n for error messages.

### Async-friendly writing tactics

Sam and Nathan will read your commits and any text you write. Tactics:
- **Lead with the point.** First sentence is the conclusion. Detail follows.
- **Bullets for 3+ items.** Easier to scan than prose paragraphs.
- **Bold the verbs.** "**Considered** RHF, **rejected** because…" reads faster.
- **No filler.** "Just wanted to note that…" → cut it.

---

## What NOT to document

| Don't document | Because |
|---|---|
| Standard React conventions ("This is a functional component") | Reader knows |
| Library APIs ("`useState` returns [value, setter]") | Reader knows |
| Self-evident JSX ("Renders a button") | Code says it |
| Your "journey" or what you tried first | Doesn't help the reviewer |
| Imaginary future features beyond "What's next" | Speculation distracts from real decisions |
| Defensive disclaimers ("This isn't perfect but…") | Trust your work; let the reviewer disagree |
| Setup steps for unused tools | Noise |

---

## Tone and voice

- **Confident, not braggy.** "I went with X because…" not "I think it's probably better to…"
- **Specific, not vague.** "Reduced re-renders" → "removed per-keystroke re-renders by switching to uncontrolled inputs"
- **First-person singular.** "I built…" not "We thought…" — it's your work.
- **Past tense** for decisions made; **present tense** for code behavior; **future** for "what's next."
- **No apologies.** If something's missing for time, call it out — don't apologize.

---

## The Netlify simplicity calibration

The Netlify recruiter said verbatim: "we're not looking for completeness and this is not a test of cleverness or optimization, so we encourage you to keep it simple. The goal of this project will be to allow you to write code, showcase your problem-solving skills, and demonstrate your ability to create clear documentation."

Calibration:

- **Documentation is an eval criterion**, not a chore. Spend real time on it.
- **Don't claim more than you did.** "Tested with VoiceOver" only if you actually did.
- **Don't manufacture decisions to look thoughtful.** Five real decisions beats ten invented ones.
- **Lead with what you built**, not with how impressive it is. Let the reviewer draw the conclusion from the code.
- **Don't over-engineer the docs**. A short, focused README beats a sprawling DESIGN.md.

In the next-day review (1-hour GMeet), they'll ask **why** you made the decisions in your docs. Every decision listed needs a real reason — not jargon you copied from a cheat sheet.

---

## Final pass before submitting

- [ ] README opens with a one-line description matching the brief
- [ ] How-to-run commands actually work (test in a fresh terminal)
- [ ] Every "Key decision" has a real reason
- [ ] Every "Considered and rejected" was actually considered
- [ ] "What's next" is honest scope, not aspirational marketing
- [ ] No `TODO` / `FIXME` without an explanation
- [ ] No leftover `console.log` (or commented out with explanation)
- [ ] Brief-restate comment at the top of the entry file
- [ ] All linked file paths and commands tested

---

## Narration phrases (for the next-day review)

When asked "why did you build it this way?":
- "I had it in the decisions section — short version is [reason]. Longer version is [context]."
- "Looking at the DESIGN.md, I had two alternatives: X and Y. I went with X because [reason]."

When asked "what would you do differently?":
- "I called it out in 'What's next' — I'd [thing], because [reason]."

When asked "why didn't you do X?":
- "I considered it and chose not to — that's in 'Considered and rejected.' The reason was [reason]. Curious if you'd have gone the other way."

When asked "did you think about [thing]?":
- If yes: "Yes — [reason for what I did instead]."
- If no: "Honestly I didn't — would have approached it as [first thought]. What were you thinking?"

The last pattern (engaging when you didn't think of something) is far better than pretending you did. Curiosity beats false confidence.

## Authoritative references

- Write the Docs — Docs as Code: https://www.writethedocs.org/guide/docs-as-code/
- Make a README: https://www.makeareadme.com/
- Diátaxis (documentation framework): https://diataxis.fr/
- ADR (Architecture Decision Records): https://adr.github.io/
- Notion's "How to write a project README" patterns: https://www.notion.so/help (search "README")
- GitHub's docs on Markdown: https://docs.github.com/en/get-started/writing-on-github
