---
name: react-brief-recipes
description: 30-second component-tree decision recipes for common interview prompts. When the brief drops, look it up here and get tree + state-ownership + must/should/won't + one "wow" detail. Covers pricing card, hero + signup, multi-step onboarding, FAQ, modal, tabs, combobox, comparison table, newsletter, sticky nav, sidebar nav, code block, dashboard card, testimonial carousel, feature grid. Load this skill FIRST when starting any interview build. Triggers on "interview build", "what should I build", "component tree", "where to start", "brief recipe", "pricing card", "hero", "build a form", "build a modal", "build tabs", "build accordion", "build navigation", "build dashboard".
---

# react-brief-recipes

The first skill you load when an interview brief drops. Maps common prompts to immediate decisions so you skip the blank-file freeze. Every recipe gives you tree, state-ownership, MoSCoW scope, and one "wow" detail to over-invest in.

## How to use this skill

1. Read the brief twice.
2. Find the closest recipe below.
3. Spend 60 seconds adapting it to the brief's exact wording.
4. Drop the component skeleton and start typing.

**Do not** scroll this list during the build — pick once, commit. The point is to eliminate decision overhead in the first 5 minutes.

## Calibrate to the brief — when simple beats clever

The "Wow" line in each recipe is **conditional**. If the brief explicitly signals simplicity ("keep it simple," "not testing cleverness," "documentation is part of the eval"), cut the wow down to nothing or use the simplest available version.

The Netlify Senior UX Engineer technical project is one such brief — the recruiter said verbatim: *"we're not looking for completeness and this is not a test of cleverness or optimization."* For that kind of brief:

- **Use the Tree, Must, Should, Won't from the recipe — skip or downplay Wow.**
- **Spend the saved time on documentation** (see `react-docs-writing`).
- **Don't add abstractions** the recipe doesn't require.
- **Prefer native HTML** wherever a recipe offers a choice (e.g., `<details>` for FAQ over a custom Disclosure — see `react-html-platform`).

For performative briefs (live coding, "show your range"), keep the wow.

## Multi-exercise briefs

The "brief" might be a single component build — or it might be a **set of smaller exercises** (the Netlify format). Sam confirmed verbatim: *"a few programming, collaboration, and UX design exercises."*

When you have multiple exercises:

- **Read every prompt first** before starting any one
- **Budget time roughly equal** across them — don't over-invest in the first
- **Apply recipes per-exercise**, not to the whole repo
- **The "wow" budget is total**, not per-exercise — pick one detail across the whole set, or none
- **A solid pass at all exercises beats one polished + others empty**

For the Netlify format specifically: a 2-hour window with "a few" exercises means ~30–40 min per exercise with buffer for setup + README polish at the end.

## The recipe format

Every recipe has:
- **Tree**: components + state ownership
- **Must**: visible in v1, brief-aligned
- **Should**: ship if time
- **Won't**: out-of-scope, call out in walkthrough
- **Wow**: one detail to over-invest in (the thing the reviewer will remember)

---

## Recipe 1 — Pricing card / pricing page

> "Build a pricing component with 3 tiers and a monthly/yearly toggle."

**Tree:**
```
<Pricing>                          // owns billing state ('monthly' | 'yearly')
  <BillingToggle/>                 // inline, role=radiogroup
  <PricingTier tier={…} billing={…} />        // presentational
  <PricingTier tier={…} billing={…} />
  <PricingTier tier={…} billing={…} featured />
</Pricing>
```

**Must**: 3 tiers, billing toggle, CTA per tier, semantic structure (one h1/h2 per page, h3 per tier), responsive grid (1 col mobile, 3 cols desktop)

**Should**: featured tier styling, "save 20%" callout on yearly, hover/focus states, currency formatting

**Won't**: real payment flow, currency switcher, regional pricing, A/B test variants

**Wow**: billing toggle is `role="radiogroup"` (free arrow-key nav) + price changes in `aria-live="polite"` region (screen readers hear updates)

---

## Recipe 2 — Hero + email signup

> "Build a marketing hero with an email signup form."

**Tree:**
```
<Hero>                             // server component, pure markup
  <h1 />
  <p />                            // subtitle
  <NewsletterForm />               // 'use client' island, form state machine
</Hero>
```

**Form state**: `idle | submitting | success | error` discriminated union (or `useActionState` if Server Action).

**Must**: h1, subtitle, email input with associated label, submit button, success state, error state, `autoComplete="email"`

**Should**: visible focus rings, inline error a11y wiring (`aria-invalid` + `aria-describedby` + `role="alert"`), error clears on next keystroke

**Won't**: real API integration (stub it), double-opt-in flow, marketing analytics, exit-intent triggers

**Wow**: Server Action + `useFormStatus` + `useActionState` — no client state for "submitting", progressive enhancement for free

---

## Recipe 3 — Multi-step onboarding flow

> "Build a 3-step onboarding wizard."

**Tree:**
```
<OnboardingFlow steps={…}>         // owns step + form data via useReducer
  <ProgressBar />                   // role=progressbar with aria-valuenow
  <StepHeader />                    // "Step N of M" + h2 title
  <StepContent>{steps[i].render()}</StepContent>
  <StepFooter onBack onContinue />
</OnboardingFlow>
```

**State**: `useReducer({ step, data, errors })` — better than 3 useStates here.

**Must**: progress indicator, back/continue, per-step validation, final submit, can't continue with invalid data

**Should**: keyboard nav, persistence across refresh (localStorage), focus moves to step heading on advance, skip with consequence ("you can fill this later")

**Won't**: branching logic, server-side validation, analytics, A/B variants

**Wow**: progress bar uses `aria-valuenow`/`aria-valuemax` + focus moves to the new step's heading on advance (screen readers reorient automatically)

---

## Recipe 4 — FAQ accordion

> "Build an FAQ section with expandable questions."

**Tree:**
```
<FAQ items={…}>                    // no state — DOM owns it
  <details name="faq">             // <details name> for exclusive group
    <summary>{q}</summary>
    <div>{a}</div>
  </details>
  ...
</FAQ>
```

**Must**: keyboard accessible (free via `<details>`), expand/collapse, visible chevron with rotation

**Should**: smooth open/close animation, anchor links to specific questions (#faq-1), exclusive open via `name` attribute

**Won't**: rich content inside answers (links/code OK, but not nested accordions), search, deep linking from URL

**Wow**: native `<details>` ships everything; in the walkthrough mention "I considered a custom Disclosure with `aria-expanded` and state — rejected because `<details>` ships the entire pattern (keyboard, screen reader, expanded state) for free"

---

## Recipe 5 — Modal / dialog

> "Build a modal that opens when you click a button."

**Tree:**
```
<DialogTrigger />                  // button with `popovertarget` or onClick
<Dialog open={…} onClose={…}>      // native <dialog> + .showModal()
  <DialogTitle />                  // h2 with id, referenced by aria-labelledby
  <DialogBody />
  <DialogActions />
</Dialog>
```

**Use native `<dialog>`** — ships focus trap, Esc-to-close, backdrop, inert siblings. Call `dialog.showModal()` to open, `dialog.close()` to close.

**Must**: opens on trigger, closes on Esc + backdrop click + close button, focus moves in on open, focus returns to trigger on close

**Should**: scroll lock on body, animated enter/exit, `aria-labelledby` wired to title, `aria-describedby` if needed

**Won't**: nested modals, portal management (dialog uses top-layer), custom backdrop behaviors

**Wow**: `<dialog>` + `::backdrop` + `interpolate-size: allow-keywords` for smooth animation; mention "re-implementing focus trap + Esc + backdrop is a full day; the platform ships it"

---

## Recipe 6 — Tabs

> "Build a tabbed interface for our settings page."

**Tree:**
```
<Tabs defaultValue={…}>            // context owns active value
  <Tabs.List>                      // role=tablist
    <Tabs.Tab value="a" />         // roving tabindex
    <Tabs.Tab value="b" />
  </Tabs.List>
  <Tabs.Panel value="a">…</Tabs.Panel>
  <Tabs.Panel value="b">…</Tabs.Panel>
</Tabs>
```

**Use compound components** — caller controls structure, you own a11y wiring.

**Must**: arrow keys move active tab, Tab key exits the group (not between tabs), Enter/Space activates, panel content swaps

**Should**: Home/End jump to first/last, automatic vs manual activation prop, `aria-controls`/`aria-labelledby` wiring, animation between panels

**Won't**: vertical tabs, async-loaded panel content, lazy panels, drag to reorder

**Wow**: WAI-ARIA APG-correct keyboard model (roving tabindex + arrow keys) + `aria-controls` wiring; mention React Aria's tabs API as production reference

---

## Recipe 7 — Combobox / autocomplete

> "Build a search input with autocomplete."

**Tree:**
```
<Combobox>                         // headless hook + custom UI
  <ComboboxInput />                // role=combobox, aria-expanded, aria-controls, aria-activedescendant
  <ComboboxList>                   // role=listbox
    <ComboboxOption />             // role=option, aria-selected
  </ComboboxList>
</Combobox>
```

**Logic in a hook** (`useCombobox`); UI is bespoke.

**Must**: typing filters list, ArrowDown/ArrowUp navigate, Enter selects, Esc clears/closes

**Should**: `aria-activedescendant` pattern (focus stays on input, virtual focus moves through options), debounced async search, empty state message

**Won't**: virtualization (mention as TODO if 1000+ items), multi-select, server-side search beyond a `fetch` stub, recently-selected list

**Wow**: full APG combobox keyboard model — typing focuses input, arrows move virtual focus, Enter selects, Esc closes — without losing input focus

---

## Recipe 8 — Comparison table

> "Build a feature comparison table for our plans."

**Tree:**
```
<Comparison features={…} tiers={…}>
  <table>
    <caption className="sr-only">Plan feature comparison</caption>
    <thead>
      <tr><th>Feature</th><th scope="col">{tier1}</th>…</tr>
    </thead>
    <tbody>
      <tr><th scope="row">{feature}</th><td>{value}</td>…</tr>
    </tbody>
  </table>
</Comparison>
```

**Use a real `<table>`** with `scope="row"`/`scope="col"` + `<caption>` — semantic, screen-reader-navigable.

**Must**: every cell has meaning, headers associated (scope), mobile-readable (horizontal scroll or stack)

**Should**: sticky header on scroll, sticky first column on horizontal scroll, icon + sr-only text for check/cross cells

**Won't**: sortable columns, virtualization, complex cell types (inline tooltips OK), filter

**Wow**: responsive transformation — `<table>` on desktop, stacked cards with feature-label-per-row on mobile; check/cross cells have `<span class="sr-only">Included</span>` so color/icon never carries meaning alone

---

## Recipe 9 — Newsletter form (standalone)

> "Build a newsletter signup component."

**Tree:**
```
<NewsletterForm>                   // 'use client' island
  <Label htmlFor="email" className="sr-only" />
  <Input
    name="email"
    type="email"
    required
    autoComplete="email"
    aria-invalid={…}
    aria-describedby={…}
  />
  <SubmitButton />                 // useFormStatus → pending
  <ErrorMessage />                 // role=alert
</NewsletterForm>
```

**Form**: Server Action + `useActionState` for response state + `useFormStatus` for submit pending.

**Must**: email validation, success state, error state, label (sr-only or visible), `autoComplete="email"`

**Should**: focus management on success, error clears on next keystroke, optimistic disabled-while-submitting via `useFormStatus`

**Won't**: double-opt-in flow, regional GDPR copy, list segmentation, A/B test variants

**Wow**: Zod schema → infer type → Server Action validates → typed `fieldErrors` flow back to component — single source of truth for shape + validation + errors

---

## Recipe 10 — Sticky nav with scroll behavior

> "Build a sticky top nav for our marketing site."

**Tree:**
```
<header className="sticky top-0">
  <SkipLink />                     // visible on focus
  <StickyNav>                      // 'use client' if reading scroll
    <Logo />
    <NavItems />
    <CTAs />
    <MobileMenuTrigger />          // hamburger
  </StickyNav>
</header>
<main id="main" tabIndex={-1}>…</main>
<MobileMenu />                     // <dialog> for off-canvas
```

**State**: `scrolled` boolean (background blur after 8px scroll) + `mobileOpen` boolean.

**Must**: sticky position, skip-to-main link, mobile hamburger that opens a real menu, keyboard accessible

**Should**: background blur/border on scroll, focus trap on mobile menu (free if `<dialog>`), `inert` on main content when menu open

**Won't**: mega-menu, search integration, multi-level dropdown, hide-on-scroll

**Wow**: skip link first in DOM + `<dialog>` for mobile menu (free focus trap) + `inert` on `<main>` when menu open (screen readers don't traverse hidden content)

---

## Recipe 11 — Sidebar docs nav

> "Build a sidebar for our documentation site."

**Tree:**
```
<aside aria-label="Documentation">
  <DocsNav sections={…}>
    <DocsNavSection>
      <h2 />                       // section heading
      <ul>
        <li>
          <a aria-current={isActive ? 'page' : undefined}>…</a>
        </li>
      </ul>
    </DocsNavSection>
  </DocsNav>
</aside>
```

**Must**: highlight current page (`aria-current="page"`), collapsible sections (use `<details>`), scrollable independently from main content, real `<nav>` or `<aside>` landmark

**Should**: search input at top, keyboard nav, mobile drawer behavior (slide in from left), recently-viewed pages

**Won't**: lazy loading sections, deep search index, multi-version routing, breadcrumb sync

**Wow**: `aria-current="page"` is announced as "current page" by screen readers — far better than visual-only styling

---

## Recipe 12 — Code block with copy

> "Build a code block component for our docs."

**Tree:**
```
<CodeBlock filename={…} lang={…} code={…}>
  <figure>
    <figcaption>
      <code>{filename}</code>
      <span>{lang}</span>
    </figcaption>
    <pre tabIndex={0}>
      <code className={`language-${lang}`}>…</code>
    </pre>
    <CopyButton />                 // announces "Copied" via aria-live
  </figure>
</CodeBlock>
```

**Must**: copy button, monospace, scrollable on overflow, syntax highlighting (Shiki at build time preferred)

**Should**: line numbers, highlight specific lines, filename header, copy button appears on hover and keyboard focus

**Won't**: live editing, runtime syntax highlighting (use Shiki / Prism at build), live execution

**Wow**: `<figure>` + `<figcaption>` semantic structure, `<pre tabIndex={0}>` so keyboard users can scroll the code, copy button announces success via `aria-live="polite"`

---

## Recipe 13 — Dashboard card / KPI

> "Build a stats card for our dashboard."

**Tree:**
```
<StatCard>
  <CardHeader>
    <CardTitle />                  // h3
    <CardTrend direction />        // up/down indicator with sr-only text
  </CardHeader>
  <CardValue />                    // big number
  <CardDescription />              // context line
  <CardChart />                    // optional sparkline
</StatCard>
```

**Must**: big number, label, trend indicator with sr-only "increased by X%" / "decreased by Y%"

**Should**: hover for details, loading skeleton with `aria-busy`, comparison to previous period

**Won't**: real charting library (mention Chart.js or Recharts in walkthrough), drill-down interactions, complex tooltips

**Wow**: trend uses icon + text + color (never color alone); loading skeleton has `aria-busy="true"` so screen readers don't read partial content

---

## Recipe 14 — Testimonial carousel

> "Build a testimonial section that auto-rotates."

**Tree:**
```
<TestimonialCarousel items={…}>    // 'use client'
  <div
    aria-live="polite"
    aria-atomic="true"
    aria-roledescription="carousel"
  >
    <blockquote>{quote}</blockquote>
    <footer>{name, role}</footer>
  </div>
  <Pagination />                   // role=tablist with dots
</TestimonialCarousel>
```

**State**: `current` index. Auto-rotate **only** if `!usePrefersReducedMotion()`.

**Must**: rotation gated on reduced-motion, clickable pagination dots, screen reader announcements, prev/next buttons

**Should**: pause on hover, pause on focus, swipe gestures (touch)

**Won't**: 3D effects, video testimonials, filtering by category, virtualization

**Wow**: auto-advance respects `prefers-reduced-motion`, `min-height` on the quote container prevents layout shift between quotes of different lengths, `aria-roledescription="carousel"` is more accurate than generic region

---

## Recipe 15 — Feature grid

> "Build a 3x2 feature highlights section."

**Tree:**
```
<FeatureGrid>                      // pure markup, no state
  <Feature>
    <FeatureIcon aria-hidden />
    <h3 />
    <p />
    {/* optional CTA */}
  </Feature>
  ... (6 total)
</FeatureGrid>
```

**Must**: 3-col desktop, 2-col tablet, 1-col mobile (or auto-fit), semantic headings (h3 per feature), responsive without media-query soup

**Should**: subtle hover lift, icon + heading + description hierarchy, optional CTA per feature

**Won't**: animations on scroll (unless wow pick), video, interactive demos, A/B variants

**Wow**: `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))` — reflows without media queries (and mention it in the walkthrough as "I chose auto-fit so the layout adapts to any viewport without me declaring breakpoints — fewer places to forget to update")

---

## When the brief is fuzzy

If nothing maps cleanly:

1. Pick the **closest** recipe — adapt rather than invent.
2. The "wow" pick is the most flexible part — swap it for something that fits.
3. If asked "why this structure?" point to the recipe's reasoning (parent owns shared state, child is presentational, etc.).

## When the brief is a combination

Common combinations (pick the dominant pattern):
- "Pricing page with FAQ" → Recipe 1 + Recipe 4 stacked
- "Landing page with hero, features, signup" → Recipe 2 + Recipe 15 + footer
- "Settings page with tabs and forms" → Recipe 6 + Recipe 9 inside each panel
- "Docs page with sidebar + code blocks" → Recipe 11 + Recipe 12

## The 4 opening moves (after picking a recipe)

Even with a recipe in hand:

1. **Restate the brief** as a comment at the top of the file
2. **Confirm signal map** — 5+ visible: semantic HTML, a11y, component API, responsive, design tokens, states (hover/focus/active/disabled/loading/error/empty), perf, polish
3. **MoSCoW the build** — write Must/Should/Won't lists (mention the Won'ts in the walkthrough)
4. **Pick the ONE wow** — the recipe gives you a default; keep or swap

## Authoritative references

- WAI-ARIA Authoring Practices Guide (canonical patterns): https://www.w3.org/WAI/ARIA/apg/patterns/
- Inclusive Components (Heydon Pickering): https://inclusive-components.design/
- Patterns.dev (React patterns): https://patterns.dev/
- Radix Primitives (production headless components): https://www.radix-ui.com/primitives
- React Aria (Adobe's production hooks): https://react-spectrum.adobe.com/react-aria/
- Tailwind UI (paid marketing patterns reference): https://tailwindui.com/
