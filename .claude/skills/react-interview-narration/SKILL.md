---
name: react-interview-narration
description: Senior-engineer narration patterns for code review walkthroughs — how to articulate component design decisions, tradeoffs, accessibility choices, performance considerations, and unspoken assumptions. Use when preparing to present code to interviewers, walking through a take-home, or documenting design decisions in PR descriptions. Triggers on "interview", "walkthrough", "review", "present", "narrate", "explain my code", "PR description".
---

# react-interview-narration

The synchronous build is half the interview. The walkthrough is the other half — and it's where seniors separate from mids. Most candidates write working code and then describe **what** they wrote. Seniors describe **why** and **what they chose not to do**.

## The 4-part walkthrough structure

Use this for any 5-15 minute review. Even if the interviewer drives, you can steer to it.

### 1. Context (30 seconds)
Restate the brief and your interpretation. This catches misalignment early.

> "The brief was a pricing card with three tiers, monthly/yearly toggle, and CTA. I read it as a real component (reusable, themeable) rather than a one-off layout, so I built it as `<Pricing>` with `<PricingTier>` children. Let me know if that read is off."

### 2. Design (90 seconds — most important)
Walk the **shape**, not the lines. Component tree, prop API, key decisions.

> "There are two components: `Pricing` owns the billing-period state and the tier data, `PricingTier` is presentational and gets a tier object plus the current billing period. I considered making `PricingTier` self-contained but that meant duplicating the toggle state — the parent is the right place for it."

### 3. Implementation (3-5 minutes)
Walk the code. **Stop on the decisions, fly over the obvious.**

> "Here's the toggle. It's a `radiogroup` so the keyboard handles arrow keys natively — I'd have had to wire that up if I'd used buttons. Notice the price changes inside `aria-live='polite'` so screen reader users hear it update."

> *(skip past obvious JSX)*

> "On the card itself, I made `featured` a boolean instead of `variant='featured'` because there's exactly one featured tier and the visual difference is small — an enum would be over-engineering. If we added 'free' or 'enterprise' visual variants, I'd switch to a variant prop."

### 4. Tradeoffs / what's missing (60 seconds — second most important)
The thing seniors do that nobody else does: **proactively name what you skipped**.

> "Three things I'd add with more time:
> 1. The CTA loading state — right now it's a plain link, but if it triggered a flow it'd need `aria-busy` and a spinner.
> 2. Animation on the toggle — the price change is jarring. I'd add a 200ms cross-fade.
> 3. Tests — I'd want a Playwright test for the keyboard flow and a unit test for the price calculation.
>
> One thing I considered and rejected: extracting a `<BillingToggle>` component. The toggle is 12 lines and only used here — pulling it out would be premature abstraction."

## The "decisions to volunteer" checklist

In any walkthrough, at minimum mention:

- [ ] **One naming decision** — why a prop or component is called what it is
- [ ] **One semantic-HTML choice** — `<button>` vs `<a>` vs `<details>`, etc.
- [ ] **One a11y decision** — focus, ARIA, labels, contrast
- [ ] **One responsive decision** — breakpoint reasoning or a mobile-specific change
- [ ] **One thing you considered and rejected** — shows you saw the alternative
- [ ] **One thing missing for time** — shows you saw what's incomplete
- [ ] **One performance consideration** — even "I deliberately did not optimize X because…"

Hit 5-7 of these and you sound senior without sounding rehearsed.

## Cross-functional framing (the "UX Engineer" twist)

A regular FE engineer narrates code-to-code. A **UX Engineer** narrates code-to-user and code-to-business. The Netlify JD calls for "strategic thinker," "human-centered," and "cross-disciplinary collaboration" — so frame decisions in language designers, PMs, and marketers can follow.

### Three frames to layer in

1. **User-friction frame** — what friction does this remove? what does the user *not* have to do?
   > "I broke this into three steps because a single 14-field form had a hidden cost — every required field is a place users abandon. Three steps trade vertical scroll for visible progress."

2. **System/consistency frame** — does this fit (or extend) the design system?
   > "I built this as a primitive — `<Card>` with named slots — because pricing, testimonials, and feature highlights all want the same shell. If this lived in the design system, marketing pages would compose instead of fork."

3. **Conversion / outcome frame** — what business result does the UX choice serve?
   > "The CTA's only color contrast in the section is intentional — it's the highest-conversion action on the page, so I want it visually unmistakable. Everything else is competing for attention I'd rather give the CTA."

### Talking to non-engineers in the room

If a designer or PM is in the review, adjust language:

| Engineer-only | Cross-functional |
|---|---|
| "I memoized the filter callback." | "I made sure typing stays smooth even on slow phones." |
| "I used `aria-live='polite'`." | "Screen reader users hear the price update — same feedback sighted users get visually." |
| "It's a compound component with context." | "The shape lets you re-order or restyle children without rewriting the component." |
| "LCP is under 2.5s." | "The hero image loads first — the page feels instant on slow connections." |
| "I extracted a `useDisclosure` hook." | "The open/close logic is reusable — we can drop it into other modals or dropdowns without duplicating it." |

### AI-collaboration framing (Netlify explicitly values this)

If asked, or if it comes up naturally:
> "I used Claude for the scaffolding — form a11y wiring, the basic JSX shape — so I could spend the time on the parts that need real judgment: the prop API, error copy, focus management. I treat AI like a fast pair: it drafts, I decide what to keep."

> "Honestly, on a take-home like this, not using AI would feel like writing the build script in vim instead of using a script runner. The senior call is what AI doesn't see — taste, tradeoffs, and what to leave out."

Don't apologize. Don't oversell. Just show that AI-tooling is a tool you use deliberately.

## Senior-signal phrases (use these, but make them yours)

### Tradeoff language
- "The tradeoff here is X versus Y. I went with X because…"
- "I considered Y, but it would have meant Z, which felt like overkill for this scope."
- "If this were used in N more places, I'd pull it out — but at one usage it's just indirection."
- "There's a small re-render cost here, but the user-visible benefit outweighs it."

### Accessibility language
- "I started with semantic HTML — `<button>` and `<form>` give me keyboard handling for free."
- "The `aria-live` is `polite` because the update isn't urgent — `assertive` would interrupt the user."
- "I added a visible focus ring because the design didn't show one — keyboard users need it."
- "I gated the auto-advance on `prefers-reduced-motion` — not everyone wants motion."

### Performance language
- "I'm not memoizing this because the children are cheap and the equality check would cost more."
- "The LCP element is the hero image, so it gets `priority` and a modern format."
- "I deferred this with `dynamic()` because it's below the fold and only loaded on interaction."

### Scoping language
- "For the time-boxed version I shipped X. Production-grade I'd add Y."
- "I marked these as TODO comments rather than half-implementing them."
- "I read the brief as 'real component' rather than 'one-off page' — happy to adjust if that was the wrong read."

### Humility (don't oversell)
- "I'd want to run this past a designer before shipping the spacing."
- "I haven't tested with a real screen reader — that's the next thing I'd do."
- "If I were doing this again, I'd start with X instead of Y."

## What NOT to do in the walkthrough

- **Don't read the code line-by-line.** It's slow and signals you don't know what's important.
- **Don't apologize for things you haven't said yet.** "Sorry, I know this is messy…" — let them ask.
- **Don't oversell tiny details.** Calling out `forwardRef` on a button when nobody asked screams "I'm performing seniority."
- **Don't be defensive when challenged.** "I see why you'd do it that way" is stronger than "but mine works too."
- **Don't say "obviously" or "trivially"** — these alienate.
- **Don't say "I would have but I ran out of time" for things you wouldn't have anyway.** Be honest about what was out of scope.

## The next-day project review (45 min walkthrough + 10–15 min Q&A)

The Netlify format: 45 minutes walking through the exercises with **two engineers (Sam + Nathan Houle)**, then 10–15 minutes for **your** questions. The dynamics differ from a live walkthrough:

- **The explicit focus is your thought process.** Sam said verbatim: "you'll have a chance to talk through your thought process."
- **You've had a day to think.** Use it. Re-read your own code and Slack transcript before the review.
- **They've had time to read.** They've gone through your code and README in advance. Don't re-explain what they've already read; deepen it.
- **Two interviewers, one conversation.** Don't favor one — answer the room. If Sam asks something, glance at Nathan when you finish to invite his follow-up.
- **It's a conversation, not a presentation.** Let them drive. Answer crisply.
- **The last 10–15 minutes are for YOUR questions** — prepare them and use the time.
- **Multiple exercises means multiple walkthroughs.** Spend roughly proportional time on each — don't burn 30 min on the first exercise and rush the rest.

### Pre-review prep (30 minutes the morning of)

- Re-read your README. If anything reads unclear, jot a note for what you'd say in person.
- Re-skim your code. Identify the 2–3 most interesting decisions; rehearse the why in one sentence each.
- Look up anything you used that you'd hate to be caught not knowing (e.g., exact semantics of `useDeferredValue`).
- Prepare 3 questions to ask them (see below).

### Questions to ask the engineers (one of the strongest signals)

Asking thoughtful questions is itself a signal — shows you're thinking about whether you'd thrive there, not just whether they'll hire you. Three categories:

**About the team's day-to-day:**
- "What does a typical sprint look like for someone in this role? More marketing pages, more in-product UX, or both?"
- "Where do design and engineering hand off? Is there a Figma → token pipeline, or is it more collaborative?"
- "How does the team handle code review for marketing-page changes vs product changes?"

**About the engineering culture:**
- "What's the team's posture on AI-assisted coding? You mentioned in the JD it's valued — curious how that shows up day-to-day."
- "How do you handle the tension between shipping fast for marketing campaigns and the higher-craft expectations for the product surface?"
- "What's the testing culture like on the marketing side — does anything ship without automated tests, or is there a baseline?"

**About growth:**
- "What does the path from Senior to Staff look like on this team?"
- "What separates the engineers who thrive here from those who don't?"
- "What's the most exciting thing the team is working on for the next 6 months?"

Pick 3 you'd actually want to know the answer to. Authenticity matters — don't ask "what's the culture like" because it's a script.

### Handling questions about your decisions

The reviewer will ask "why did you do X?" for several decisions. Pattern:

1. **State the decision in one sentence.** ("I went with uncontrolled inputs.")
2. **Give one concrete reason.** ("Form submits as a unit; per-keystroke state was unnecessary re-renders.")
3. **Acknowledge the alternative briefly.** ("Controlled would have made cross-field validation easier; I didn't need it here.")
4. **Stop.** Let them respond.

Three-sentence answers per decision are usually right. If you've been talking for 30 seconds and they haven't said anything, you're rambling.

### Handling pushback

If the reviewer challenges a decision: **engage with the substance, don't get defensive.**

> "That's a fair point — I hadn't considered [their angle]. If I were doing it again with that constraint, I'd [adjusted approach]."

Or, if you stand by it:

> "I see why you'd do it that way. The reason I went the other direction was [specific reason]. Where I think your approach would win is [acknowledged tradeoff]. Curious which way the team usually goes."

The senior move is to **engage with the tradeoff**, not defend your code as right.

### What to do with silence

If they pause, **don't fill it.** Drink water, nod, wait. They might be:
- Forming the next question
- Reading something in your code
- Giving you space to add to what you said (don't!)

Filling silence with extra explanation often digs holes.

### Closing the review

Near the end:
> "Before we wrap, I had a couple of questions if there's time."

Then ask 1–2 of your prepared questions. Pick the most relevant — don't fire all 3.

At the very end:
> "Thanks for the conversation — really enjoyed walking through this. Looking forward to next steps."

## Handling common interview questions

### "Why did you build it this way?"
This is an opportunity, not an attack. Structure: **what you considered → what you chose → why**.

> "I considered two options: a single `<Pricing>` with internal cards or a parent + child setup. I went with parent + child because the toggle state belongs at the parent, and child rendering stays simple. The tradeoff is one more component to grok — worth it for clarity."

### "What would you do differently?"
Have one real answer ready. Specific, not vague.

> "I'd start with a state machine for the form rather than three booleans — by the time I added the error case, the boolean version was getting tangled. I refactored partway through but a cleaner v2 would start that way."

### "How would you test this?"
Don't say "Jest" and stop. Layer it:

> "Three layers: a unit test for the price calculation logic, a component test with Testing Library for the toggle behavior — assert that aria-checked flips and the price updates — and an E2E in Playwright that tabs through with the keyboard to confirm focus order."

### "What if the data scales to 1000 tiers?"
The trap: candidates start optimizing. The senior answer: question the premise.

> "First I'd push back — a pricing page with 1000 tiers is a product problem, not an engineering one. If it really were 1000 — like a configurator — I'd virtualize the list and probably make the toggle work differently. But I'd want to understand the use case before designing for it."

### "Walk me through your accessibility decisions"
Have 3 ready. Going beyond `<button>` is the signal.

> "Three things: (1) the toggle is a `radiogroup` so keyboard arrow keys work natively, (2) the price update is in an `aria-live` region so screen readers announce the change, (3) the focus rings use `focus-visible` so they only show for keyboard users — never for mouse clicks. I also tested by tabbing through with the mouse unplugged."

### "How would you handle dark mode?"
The Senior UX Engineer signal answer:

> "I'd use CSS custom properties for tokens — `--color-bg`, `--color-fg`. Dark mode flips them with a class on `<html>`. The advantage is theme switching is one DOM mutation, not a React re-render. I'd also handle initial render server-side to avoid a flash of wrong theme."

### "How would you handle errors here?"
- Don't say "try/catch". Say where, why, what the user sees.

> "The fetch wraps in try/catch and sets an error state. The UI shows the error inline above the submit button with `role='alert'` so screen readers announce it. For unexpected errors I'd surface a generic 'something went wrong' rather than the raw error message — users don't need stack traces."

## When you're stuck mid-build (and they're watching)

The mid-level move is to fight the silence. The senior move is to **think out loud**.

> "Hmm — the focus is jumping somewhere weird. Let me think. The modal portals to body, so the parent's focus context is lost. I bet I need to capture `document.activeElement` before opening."

This is gold. They get to see how you debug. Don't perform confidence — perform **process**.

If you're truly blocked:

> "Let me time-box this — if I haven't found it in 3 minutes, I'll move on and come back. The core feature works without this."

## PR description / commit message version

If the assignment includes writing a PR description or readme:

```markdown
## What

Adds a `<Pricing>` component for the marketing site with three tiers
and a monthly/yearly toggle.

## Design decisions

- **Two-component split** (`<Pricing>` + `<PricingTier>`) — parent owns
  billing state, children stay presentational. Considered a single
  component with internal cards; rejected because it couples layout
  to the toggle.
- **`featured` as boolean, not variant** — there's exactly one featured
  tier and the visual delta is small. Would switch to a variant prop
  if we added free/enterprise visual styles.
- **Radiogroup for toggle** — gets arrow-key navigation for free vs.
  rolling our own with buttons.

## A11y

- Keyboard-complete: arrow keys cycle the toggle, Tab through CTAs.
- Price changes announced via `aria-live="polite"`.
- Color is never the only state signal (featured tier has a label too).
- `focus-visible` rings — keyboard users only.

## What I'd add with more time

- Cross-fade animation on price change (200ms, gated on
  `prefers-reduced-motion`)
- CTA loading state with `aria-busy`
- Playwright test for keyboard flow
- Unit test for `priceForBilling(tier, period)`

## What I considered and rejected

- Extracting `<BillingToggle>` — 12 lines, single use, would be
  premature abstraction.
- Animating via Framer Motion — CSS transition is sufficient and
  adds no bundle weight.
```

## Final 60 seconds before review

Have these one-liners ready in your head:
1. One sentence describing the component tree and prop API
2. One sentence about the most interesting decision
3. One sentence about the most important a11y choice
4. One thing you didn't have time for, and what you'd do
5. One thing you considered and rejected

That's your skeleton. If they only let you talk for 60 seconds, hit these five.
