---
name: react-html-platform
description: Modern HTML platform APIs that delete React code — native `<dialog>` for modals (ships focus trap + Esc + backdrop free), `<details>` and `<details name>` for accordions (zero JS, exclusive groups), `popover` attribute for tooltips and menus (with anchor positioning), `inert` for off-screen focus management, native form validation (`:user-valid`, `:user-invalid`, `:has()`, FormData), `<datalist>` for autocomplete, `<output>` for live form results, `<progress>` and `<meter>` for status. Each pattern is a 30-second senior-engineer signal that replaces 50+ lines of JS. Triggers on "dialog", "modal", "popover", "tooltip", "accordion", "details element", "native validation", "inert", "datalist", "anchor positioning", "html platform", "native form", "FormData", ":user-valid", ":has", "browser native".
---

# react-html-platform

Modern HTML elements and attributes that ship behavior React would otherwise re-implement. Each is a "delete this code" pattern — and reaching for them first is a strong senior-engineer signal because it shows you know the platform, not just the framework.

## The first rule

Before reaching for `useState` + ARIA + event handlers, ask: **"Is there an HTML element or attribute that already does this?"** If yes, use it. The platform's implementation handles edge cases (mobile, RTL, screen reader quirks) you'd otherwise have to chase.

Browser support is solid for everything in this skill (mid-2026). For Netlify's marketing surface, these all ship today.

---

## `<dialog>` — the modern modal

The native dialog element ships:
- **Focus trap** inside the dialog
- **Esc key** closes it
- **Backdrop** (`::backdrop` pseudo-element)
- **Inert state** for content behind
- **Top-layer rendering** (always on top, no z-index war)
- Proper ARIA semantics (`role="dialog"` + `aria-modal="true"`)

```tsx
'use client';
import { useEffect, useRef, type ReactNode } from 'react';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
};

export function Dialog({ open, onClose, labelledBy, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  // Sync open prop with imperative dialog API
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // Bridge native `close` event back to parent
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => onClose();
    el.addEventListener('close', handler);
    return () => el.removeEventListener('close', handler);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClick={(e) => {
        // Backdrop click = click on the dialog element itself (not content)
        if (e.target === e.currentTarget) onClose();
      }}
      className="rounded-lg border-0 p-6 max-w-lg w-[90vw] bg-bg text-fg"
    >
      {children}
    </dialog>
  );
}
```

```tsx
<Dialog open={isOpen} onClose={() => setOpen(false)} labelledBy="dialog-title">
  <h2 id="dialog-title">Confirm deletion</h2>
  <p>This action cannot be undone.</p>
  <button onClick={() => setOpen(false)}>Cancel</button>
  <button onClick={confirm}>Delete</button>
</Dialog>
```

### Style the backdrop

```css
dialog::backdrop {
  background: hsl(0 0% 0% / 0.5);
  backdrop-filter: blur(4px);
}

dialog[open] {
  animation: dialog-in 200ms ease;
}

@keyframes dialog-in {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  dialog[open] { animation: none; }
}
```

### `.show()` vs `.showModal()`

| Method | Behavior | Use for |
|---|---|---|
| `dialog.showModal()` | Modal: focus-trap, backdrop, inert siblings | 95% of cases |
| `dialog.show()` | Non-modal: no trap, no backdrop | Replace with the `popover` attribute now |

### Pitfalls

- Setting the `open` attribute via JSX (`<dialog open>`) makes the dialog visible **without** modal behavior. Always call `.showModal()` imperatively.
- For exit animations, listen for the `close` event after a timeout — the dialog's `display` is set to `none` immediately on close.
- Form inside dialog with `method="dialog"` automatically closes the dialog on submit (with `returnValue` = button value).

---

## `<details>` / `<summary>` — built-in disclosure

```tsx
<details>
  <summary>How do I install Netlify CLI?</summary>
  <p>Run <code>npm install -g netlify-cli</code></p>
</details>
```

Ships keyboard (Enter/Space toggles), focus, expanded state announcement, and screen reader semantics. **Zero JS.**

### `<details name>` — exclusive accordion

All `<details>` with the same `name` attribute form an exclusive group. Opening one closes the others.

```tsx
<details name="faq"><summary>Question 1</summary>…</details>
<details name="faq"><summary>Question 2</summary>…</details>
<details name="faq"><summary>Question 3</summary>…</details>
```

This is the entire accordion pattern. No state, no context, no ARIA wiring.

### Animating `<details>` open/close

```css
details {
  interpolate-size: allow-keywords;
}

details::details-content {
  block-size: 0;
  overflow-y: clip;
  transition: block-size 0.3s ease, content-visibility 0.3s ease allow-discrete;
}

details[open]::details-content {
  block-size: auto;
}

@media (prefers-reduced-motion: reduce) {
  details::details-content { transition: none; }
}
```

Chromium 131+. For wider browser support, ship without animation — it degrades cleanly.

### Custom summary styling

```css
summary {
  list-style: none;             /* Remove default disclosure triangle */
  cursor: pointer;
}
summary::-webkit-details-marker { display: none; }   /* Safari */

summary::after {
  content: '';
  /* Add your own chevron via SVG or border */
}

details[open] summary .chevron {
  transform: rotate(180deg);
}
```

---

## `popover` attribute — tooltips and menus without state

```tsx
<button popovertarget="hint" popovertargetaction="toggle">
  ?
</button>

<div id="hint" popover="auto">
  Tip content here
</div>
```

| Value | Behavior |
|---|---|
| `popover="auto"` | Closes on click outside or Esc; one auto-popover open at a time |
| `popover="manual"` | You control open/close imperatively via `el.showPopover()` / `el.hidePopover()` |

The browser handles:
- Open/close
- Light dismiss (click outside, Esc)
- Top-layer rendering (always on top)
- Focus management

### With anchor positioning

Anchor positioning lets a popover position itself relative to its trigger without JS.

```css
.tooltip-trigger {
  anchor-name: --tooltip-anchor;
}

[popover] {
  position: absolute;
  position-anchor: --tooltip-anchor;
  top: anchor(bottom);
  left: anchor(center);
  translate: -50% 8px;
}
```

No `getBoundingClientRect` math. No third-party positioning library. Browser handles scroll, resize, and edge collision.

### Open imperatively

```tsx
const ref = useRef<HTMLDivElement>(null);
const open = () => ref.current?.showPopover();
const close = () => ref.current?.hidePopover();

<div ref={ref} popover="manual">…</div>
```

---

## `inert` — disable a subtree

```tsx
<main inert={menuOpen}>
  {/* When menuOpen, all of main is unfocusable + screen-reader-hidden */}
  <YourPage />
</main>
<aside>
  <MobileMenu />
</aside>
```

`inert` makes a subtree:
- **Not focusable** (Tab skips it entirely)
- **Not clickable** (clicks don't fire)
- **Not announced** by screen readers
- Not interactive in any way

This is the right tool for "modal-like overlay on top of the page" when you're not using `<dialog>`.

---

## Native form validation

### `:user-valid` and `:user-invalid` — CSS state after interaction

```css
input:user-invalid {
  border-color: hsl(0 70% 50%);
}
input:user-valid {
  border-color: hsl(140 70% 40%);
}
```

Match only **after the user has interacted with the field**. No premature red rings on blank fields. Much better than the older `:invalid` which matches before interaction.

### Constraint validation API

```tsx
<form>
  <input
    type="email"
    name="email"
    required
    minLength={5}
    pattern="[^@\s]+@[^@\s]+\.[^@\s]+"
  />
  <input
    type="tel"
    name="phone"
    pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}"
  />
  <input
    type="url"
    name="website"
    required
  />
  <button type="submit">Submit</button>
</form>
```

The browser, for free:
- Prevents submit when validation fails
- Focuses the first invalid field
- Shows native error tooltip
- Matches `:user-invalid` on invalid fields

### Custom validity messages

```tsx
<input
  type="email"
  required
  onInvalid={(e) => {
    e.currentTarget.setCustomValidity('Please use your work email');
  }}
  onInput={(e) => {
    e.currentTarget.setCustomValidity('');  // clear on type
  }}
/>
```

### `FormData` over `useState`

```tsx
function onSubmit(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const data = new FormData(e.currentTarget);
  const email = data.get('email');
  const subscribe = data.get('subscribe') === 'on';
  // ...
}
```

No per-input state. **Zero re-renders during typing.** Forms can have dozens of fields without React re-rendering on every keystroke.

In Server Actions, the function receives FormData directly:
```tsx
async function subscribe(formData: FormData) {
  'use server';
  const email = formData.get('email');
  // ...
}

<form action={subscribe}>
  <input name="email" type="email" required />
  <button>Subscribe</button>
</form>
```

---

## `<datalist>` — autocomplete without a library

```tsx
<label htmlFor="country">Country</label>
<input id="country" list="countries" name="country" />
<datalist id="countries">
  <option value="United States" />
  <option value="United Kingdom" />
  <option value="Canada" />
  <option value="Germany" />
  <option value="Japan" />
</datalist>
```

The browser shows a dropdown of matching options as the user types. Keyboard, mouse, mobile — all native.

**Good for**: country, currency, time zone, simple finite suggestions.
**Not good for**: complex search, async results, multi-select, custom rendering of options.

---

## `<output>` — form result display

```tsx
<form onInput={onInput}>
  <label htmlFor="qty">Quantity</label>
  <input type="range" id="qty" name="quantity" min="1" max="10" defaultValue="1" />
  <output htmlFor="qty">{quantity}</output>
  × $10 = $<output>{quantity * 10}</output>
</form>
```

`<output>` is a live region by default — screen readers announce updates without you adding `aria-live`. Perfect for calculators, sliders with live values, dynamic totals.

---

## `<progress>` and `<meter>`

```tsx
{/* Task progress: 3 of 5 steps complete */}
<progress value={3} max={5}>3 of 5</progress>

{/* A gauge with thresholds: 65% storage used (optimal <80%) */}
<meter value={0.65} min={0} max={1} optimum={0.8}>65%</meter>
```

| Element | Use for |
|---|---|
| `<progress>` | Task progress (loading, upload, multi-step flow) |
| `<meter>` | A gauge with thresholds (storage used, password strength, rating) |

Both ship `role="progressbar"` semantics. Add `aria-label` if no visible label.

---

## `:has()` — parent selector

The "select the parent based on its descendants" pseudo-class. Removes the need for state-driven className toggles in many cases.

```css
/* Style a form differently if any field is invalid */
form:has(:user-invalid) .submit-warning {
  display: block;
}

/* Card has a "featured" badge → tinted background */
.card:has(.badge--featured) {
  background: hsl(173 80% 95%);
  border-color: hsl(173 80% 70%);
}

/* Show an error icon next to invalid fields */
.field:has(:user-invalid) .icon-error {
  display: block;
}

/* Image has caption → adjust layout */
figure:has(figcaption) {
  padding-bottom: 1rem;
}
```

---

## `:focus-within`

```css
/* Highlight a field group when any descendant is focused */
.field:focus-within {
  outline: 2px solid var(--color-brand);
  outline-offset: 2px;
}

/* Show a "this field is active" hint */
.field:focus-within .hint {
  opacity: 1;
}
```

---

## `light-dark()` — theme-aware colors without media queries

```css
:root {
  color-scheme: light dark;
  --color-bg: light-dark(white, hsl(0 0% 7%));
  --color-fg: light-dark(hsl(0 0% 10%), hsl(0 0% 96%));
}
```

The function returns the first arg in light mode, the second in dark mode. Combined with `color-scheme`, you get automatic theme switching without `@media (prefers-color-scheme)` blocks. Chromium 123+, Firefox 120+, Safari 17.5+.

---

## `color-mix()` — derive colors at the CSS layer

```css
:root {
  --color-brand: hsl(173 80% 40%);
  --color-brand-hover: color-mix(in oklch, var(--color-brand), black 10%);
  --color-brand-tint: color-mix(in oklch, var(--color-brand), white 90%);
}
```

Lets you define one brand color and derive hover/tint variants without a build step.

---

## Modern attributes worth knowing

| Attribute | Purpose |
|---|---|
| `enterkeyhint="search"` | Soft keyboard "go" button label on mobile (`search`, `send`, `done`, `next`, etc.) |
| `inputmode="numeric"` | Show numeric keyboard without the quirks of `type="number"` |
| `autocomplete="email"` | Browser autofill + password manager integration |
| `spellcheck="false"` | For code, usernames, addresses |
| `fetchpriority="high"` | LCP image hint |
| `loading="lazy"` | Below-the-fold images |
| `decoding="async"` | Image decoding off main thread |
| `crossorigin="anonymous"` | Required on `<link rel="preload">` for fonts |

---

## Anti-patterns to retire

| Don't | Do |
|---|---|
| `useState` + `useEffect` + portal + focus management for modals | `<dialog>` + `.showModal()` |
| Custom accordion with `aria-expanded` + state | `<details>` + `<details name>` |
| Tooltip via `useState` + portal + position calc | `popover` attribute + anchor positioning |
| `display: none` toggle for focus management | `inert` |
| `useState` per form input + manual validation | `FormData` + `required`/`pattern` + `:user-invalid` |
| Custom autocomplete from scratch for simple lists | `<datalist>` |
| `aria-live` div to announce calculator result | `<output>` |
| Conditional className via React for hover state | `:hover` / `:focus-within` / `:has()` |

---

## Browser support cheat (mid-2026)

- `<dialog>` — universal
- `<details name>` — Chromium 120+, Safari 17+, Firefox 124+
- `popover` attribute — universal
- Anchor positioning — Chromium 125+, Firefox/Safari behind flag (degrade gracefully)
- `inert` — universal
- `:user-valid` / `:user-invalid` — universal
- `:has()` — universal
- `:focus-within` — universal
- `light-dark()` — universal (post-2024)
- `color-mix()` — universal
- `interpolate-size: allow-keywords` — Chromium 131+ only

For features without universal support, fallbacks are typically "no animation" or "no auto-position" — degrades gracefully without breaking UX.

---

## Narration phrases

- "I used native `<dialog>` because `.showModal()` ships focus trap, Esc, and backdrop inertness for free — re-implementing those is days of work and a source of subtle bugs."
- "The FAQ is `<details name='faq'>` — exclusive accordion, zero state, zero JS, accessible by default. I considered a custom Disclosure but the platform shipped the whole pattern."
- "I used the `popover` attribute because the browser handles light dismiss and top-layer rendering — no z-index management, no Floating UI dependency."
- "The form uses `:user-invalid` so red borders only show after the user has interacted. Premature `:invalid` is a small but real UX paper cut."
- "I wrapped the offscreen content in `inert` so screen readers and keyboard users don't accidentally traverse it. `inert` is the modern alternative to `aria-hidden` + `tabindex={-1}` everywhere."
- "Form state is `FormData` instead of `useState` per field — zero re-renders per keystroke and the form works without JS via Server Actions."

## Authoritative references

- MDN `<dialog>`: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog
- MDN `<details>` and `name`: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details
- MDN Popover API: https://developer.mozilla.org/en-US/docs/Web/API/Popover_API
- CSS Anchor Positioning: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_anchor_positioning
- MDN `inert`: https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inert
- Constraint Validation API: https://developer.mozilla.org/en-US/docs/Web/HTML/Constraint_validation
- MDN `:user-valid` and `:user-invalid`: https://developer.mozilla.org/en-US/docs/Web/CSS/:user-valid
- MDN `:has()`: https://developer.mozilla.org/en-US/docs/Web/CSS/:has
- web.dev — Building a modern modal dialog: https://web.dev/articles/building/a-dialog-component
- Can I Use (browser support lookup): https://caniuse.com/
