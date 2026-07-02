---
name: react-senior-ux
description: Senior UX Engineer-level React orchestrator — opening moves, decision framework, and routing to specialized React skills (component design, a11y, styling, performance, marketing patterns, onboarding/docs, interview narration). Use when starting any React component build, UI feature, technical interview task, marketing-site work, product onboarding, or documentation site work. Triggers on "React", "component", "UX engineer", "interview build", "landing page", "onboarding", "docs site", or any prompt that mixes UI + code judgment.
---

# react-senior-ux — Orchestrator

This skill is the entry point for any React work that's framed as **UX engineering** (not pure data/logic). It sets the mental model, routes to specialized skills, and prevents the most common interview failure mode: writing code before deciding what "done" looks like.

## When to use this skill (vs. jump straight to a sub-skill)

Invoke this orchestrator first when:
- The brief is open-ended ("build X component", "make this landing page")
- You're starting a build session for an interview or take-home
- You need to decide *what to optimize for* before writing code

Skip to a sub-skill when:
- The task is narrow and named (e.g. "fix this a11y issue" → `react-a11y` directly)

## The 4 senior-engineer opening moves

Before writing a single line of JSX, do these in order:

### 1. Restate the brief in your own words
Out loud or as a comment at the top of the file:
```
// Brief: Build a pricing card component used on the marketing site.
// Must: 3 tiers, monthly/yearly toggle, CTA per tier, responsive.
// Implied: a11y, design tokens, hover/focus states, mobile-first.
```
Why this matters: in a "solo build + review" format, this comment becomes your narration anchor.

### 2. Identify the "UX Engineer signal map"
For any UI brief, **at least three** of these should be visible in your code by the end:
- **Semantic HTML** — `<button>` not `<div onClick>`, `<nav>` for nav, real `<form>`
- **Accessibility** — keyboard nav works, focus visible, labels associated, contrast
- **Component API** — props are minimal, intent-revealing, typed
- **Responsive** — works at 320px, 768px, 1280px without breaking
- **Design tokens** — no magic numbers; spacing/colors via tokens or theme
- **States** — hover, focus, active, disabled, loading, error, empty
- **Performance** — no layout shift, no janky animation, no oversized images
- **Polish** — micro-interactions, transitions, attention to spacing

If you only ship "it works", you're a mid-level. If you ship 5+ of the above visibly, you're senior.

### 3. Scope: MoSCoW the build
Write three lists before coding:
- **Must** (will fail without): core happy path, the visible UI matching the brief
- **Should** (will mention but maybe skip): error states, edge cases, one extra a11y polish
- **Won't** (will explicitly call out in review): testing, theming abstraction, motion library

In the walkthrough, **naming the "Won't"s is a senior signal**. It shows you saw them and made a call.

### 4. Pick one "wow" detail (conditional — see Calibrate section below)
Choose ONE thing you'll over-invest in — the thing the reviewer will remember.
Good candidates for Netlify Marketing:
- A keyboard-perfect interactive (combobox, tabs, carousel)
- An accessibility detail nobody asks for (live region for form errors, skip link, prefers-reduced-motion)
- A micro-interaction that respects motion preferences
- A precisely-implemented design token system

**Important**: skip or downplay this step if the brief signals simplicity. See "Calibrate to the brief" below.

## Calibrate to the brief — when simple beats clever

The "pick a wow detail" advice is calibrated for **performative** interviews (live coding, "impress us"). For **deliverable** interviews where the brief explicitly says things like:

- "Keep it simple"
- "We're not testing optimization or cleverness"
- "Documentation is part of the evaluation"
- "Don't worry about completeness"

...flip the strategy. **Solid working code + clear documentation + 1–2 defensible decisions** beats a flashy demo with rough edges.

The Netlify Senior UX Engineer technical project is in the second category. The recruiter said verbatim: *"we're not looking for completeness and this is not a test of cleverness or optimization, so we encourage you to keep it simple. The goal of this project will be to allow you to write code, showcase your problem-solving skills, and demonstrate your ability to create clear documentation."*

Translation: ship working, well-documented, well-considered code. Don't add a roving-tabindex tabs component if a `<details>`-based FAQ would deliver the brief.

### Senior-signal recalibration for simplicity-signaled briefs

- **Cut your "wow" to zero or one.** Don't over-invest visibly.
- **Invest the saved time in documentation** (see the `react-docs-writing` skill).
- **Prefer native HTML + simple state over compound components and headless hooks** (see `react-html-platform`).
- **Resist adding libraries.** Each dep is a decision you'll have to defend.
- **Make 2–3 decisions you can clearly justify in the next-day review.** That's senior signal — not the number of advanced patterns you used.

### Senior-signal that stays the same for both kinds of briefs

Regardless of calibration:

- **Semantic HTML.** Always.
- **Real `<label>`, real `<button>`, real `<form>`.** Always.
- **Keyboard works, focus is visible, errors are announced.** Always.
- **No magic numbers; every spacing/color is a token.** Always.
- **TypeScript that types intent, not just shape.** Always.

These are baseline; they're not the "wow." If they're missing, no calibration saves you.

## Routing to specialized skills

Once you've done the 4 opening moves, the work routes naturally:

| If the brief is about... | Load this skill |
|---|---|
| API design, reusability, compound patterns | `react-component-design` |
| Forms, modals, menus, anything interactive | `react-a11y` |
| Visual fidelity, responsive, motion, tokens | `react-styling` |
| Slow page, bundle, images, Core Web Vitals | `react-performance` |
| Hero, CTA, pricing, lead form, marketing page | `react-marketing-patterns` |
| Multi-step onboarding, empty state, docs page, code block, TOC | `react-onboarding-docs` |
| Preparing the verbal walkthrough | `react-interview-narration` |
| Building against a REST API (TanStack Query, fetch wrapper, normalization) | `react-api-consumer` |
| Multi-route SPA (data router, focus on route change, scroll restoration) | `react-routing` |
| Third-party media embeds (YouTube, SoundCloud, Vimeo, X-Frame-Options) | `react-embeds` |

These can be invoked together — a pricing card touches design, a11y, styling, and marketing patterns simultaneously.

## Polish phase — after the build, before the ship

The "wow detail" lives in the build. **Polish** is a different mode — production hardening of something that already works. Reach for these when the brief said "deploy this" or you're past MVP and entering the "make it shippable" stage.

### Polish-phase routing

| If the polish is about... | Load this skill |
|---|---|
| Tests (E2E, unit, a11y assertions, CI) | `react-testing` |
| Favicon, OG/Twitter card, social meta, theme-color | `react-performance` (Social + brand assets section) |
| README badges, Tests section, live demo link, deploy notes | `react-docs-writing` (Production-OSS extensions) |
| Known-quirks index for a specific API the app consumes | The API-specific skill (e.g. `kratecms-api`) |
| Looking up the canonical spec for OG / WCAG / manifest / `theme-color` | `react-resources` |

### Polish checklist (run before declaring "shipped")

- [ ] **Repo hygiene**: LICENSE present, README is accurate, `.gitignore` doesn't leak `.claude` / `.idea` / test artifacts
- [ ] **Repo discoverability**: GitHub topics set, homepage URL points at the live deploy
- [ ] **Social surface**: favicon (SVG + apple-touch-icon), OG card (1200×630), Twitter Card, `theme-color`, canonical link
- [ ] **Test surface**: at least one happy-path E2E spec + a "no console errors" spec; CI runs them on PR
- [ ] **Production deploy**: deploy config in repo (`netlify.toml` / `vercel.json`), SPA fallback wired, long-cache on hashed assets
- [ ] **Deployed URL works**: hard-navigate to a deep route, refresh — no 404 from the host
- [ ] **Production smoke**: same E2E suite passes against the deployed URL (`E2E_BASE_URL` pattern)
- [ ] **No dev-only assumptions in production**: no `localhost` hardcoded, no DDEV / dev-cert references, no `console.log` in shipped code
- [ ] **No `TODO`/`FIXME` that aren't tracked**: either resolve, or file an issue and link to it from the code

This checklist is *separate* from the build-time "before done" checklist further down — it covers the production layer.

## Netlify Senior UX Engineer (Marketing) — explicit JD signals

From the actual job description, the role spans:
- **Brand and product UX** — both marketing and in-product
- **Marketing campaigns, product launches, onboarding, and documentation** — wider than just landing pages
- **Growth campaigns and conversion-focused initiatives** — frame work in user/business outcomes
- **Design systems and open source** — value reusability and contribution mindset
- **Cross-disciplinary collaboration** — with designers, PMs, marketers (not just engineers)
- **AI for code generation** — explicit signal that AI-tooling fluency is desired

Implicit technical values (Netlify-specific):
- **Core Web Vitals are not optional** — LCP < 2.5s, INP < 200ms, CLS < 0.1
- **Accessibility is table stakes** — they ship public surfaces to a savvy audience
- **Developer aesthetic** — clean type, generous whitespace, restrained color, sharp interactions
- **Static-first thinking** — server components / SSG where possible, hydrate sparingly
- **Component reusability** — pages share primitives; the right component fits the system

If you're given a choice and don't know the convention, bias toward: **static, accessible, fast, restrained, reusable**.

## Frame work in user + business outcomes, not just craft

The JD emphasizes "strategic thinker," "human-centered," "conversion-focused." Don't just describe what you built — describe **what user friction it removes** or **what business outcome it serves**.

Bad framing: "I built a multi-step form."
Good framing: "I built a multi-step form because a single long form had 60% abandonment. Each step has one job, one CTA, and a progress indicator so the user can see the end."

Bad framing: "I used semantic HTML."
Good framing: "I started with semantic HTML — accessibility is a Netlify product value, and `<button>` ships keyboard behavior for free, which means I spend interview time on the hard parts."

Bad framing: "I added Framer Motion."
Good framing: "Motion guides the eye from the headline to the CTA. I gated it on `prefers-reduced-motion` so we don't trade conversion for inclusion."

Three frames to keep in your back pocket:
1. **Conversion / friction** — "This removes a click; this clarifies the next action."
2. **Consistency / system** — "This reuses the system's primitive; this would belong in the design system."
3. **Inclusion / craft** — "This works for keyboard, screen reader, low-vision; the craft level matches the brand."

## AI-collaboration mindset (the JD explicitly wants this)

The JD calls out: *"Growth mindset: curious, adaptable, and eager to explore new technologies, tools, and methods—**including AI for code generation**."* That phrasing is rare — they're saying it on purpose.

Translation: **don't be apologetic about using AI tools.** If you used Claude / Copilot / etc. during the build, mention it confidently. Frame it as a *senior engineer's force multiplier*, not as a crutch.

What that sounds like in the walkthrough:
- "I used Claude to scaffold the form a11y wiring quickly so I could spend the time on the validation UX and design-token integration."
- "I leaned on AI for the boilerplate, then hand-edited the parts that needed real judgment — prop API, error copy, focus management."
- "I treat AI like a fast pair: it drafts, I review and reject. The senior call is what to keep."

What NOT to say:
- "I let Claude write it." (passive — sounds like you didn't own it)
- "Sorry, this is AI-generated." (apologetic — they don't want that)
- "I would have done it differently myself." (undermines your own output)

If they ask "what role did AI play?" have a real answer: where you used it, where you didn't, and *why*.

## The senior-engineer "before done" checklist

Before you say "I'm finished" in the review:

- [ ] Keyboard: I can tab through every interactive element in sensible order, and focus is always visible
- [ ] Screen reader: every control has an accessible name (label, aria-label, or visible text)
- [ ] Responsive: works at 320px wide without horizontal scroll
- [ ] States: hover, focus, active, disabled, loading, error, empty — anything missing is intentional
- [ ] No layout shift on load (images sized, fonts swap-safe)
- [ ] No console errors/warnings
- [ ] TypeScript: no `any`, no `@ts-ignore`
- [ ] Naming: every prop and component name reads like English
- [ ] One "wow" detail is present and intentional

## Anti-patterns that signal mid-level

Avoid these — interviewers notice:
- `<div onClick>` instead of `<button>`
- Manual prop drilling beyond 2 levels (use children/composition)
- `useState` for derived values (compute from props)
- `useEffect` for things that aren't side effects (computing, transforming)
- Inline arrow functions in render when memoization matters (rare — but call it out)
- Magic numbers in CSS (`margin: 17px`)
- Class names like `red-button` instead of `button-primary`
- `aria-label` on something that already has a visible label
- Animating `width`/`height`/`top` instead of `transform`
- Forgetting `prefers-reduced-motion`
- Forgetting `loading="lazy"` on below-the-fold images
- Forgetting `width`/`height` on images (causes CLS)

## When in doubt, articulate the tradeoff

The senior move when uncertain isn't to pick correctly — it's to **make the tradeoff visible**:

> "I went with controlled input here because the parent needs the value for validation. If this were used in a form library context, I'd switch to uncontrolled with a ref to avoid the rerender."

> "I'm using `useMemo` here because the filter runs on every keystroke against a 200-item list. For a 10-item list I wouldn't bother — the memo overhead would cost more than the recompute."

That's the senior-level signal: **you saw the tradeoff, you made a call, you can defend it**.
