---
name: react-a11y
description: React accessibility (WCAG 2.2 AA) — semantic HTML first, ARIA only when needed, focus management, keyboard navigation, screen reader support, color contrast, prefers-reduced-motion. Use when building any user-facing UI, forms, modals, menus, tabs, carousels, or when accessibility is in scope. Critical for Senior UX Engineer interview signal. Triggers on "a11y", "accessibility", "WCAG", "ARIA", "keyboard", "screen reader", "focus", "semantic".
---

# react-a11y

Accessibility is the single highest-signal differentiator for a Senior UX Engineer. Most candidates ship working code; few ship code that works with a keyboard, screen reader, and reduced motion. Be the latter.

## The "first rule of ARIA" — don't use it

Before reaching for `role=` or `aria-*`, ask: **is there an HTML element that already does this?** If yes, use it. The built-in element ships behavior (keyboard, focus, semantics) for free.

| Tempting to write | Use instead |
|---|---|
| `<div onClick={…}>` | `<button>` |
| `<div role="button">` | `<button>` |
| `<a onClick={…}>` (no href) | `<button>` |
| `<span>` for a label | `<label htmlFor="…">` |
| Custom dropdown div | `<select>` for simple cases |
| `<div role="dialog">` | `<dialog>` (with caveats) or robust modal pattern |
| `<div role="list">` | `<ul>` / `<ol>` |
| `<i className="icon">` for meaningful icons | Icon `<svg>` with `<title>` |

If you find yourself writing `role="button"`, stop and use `<button>`. The interview reviewer will catch this in 2 seconds.

## The pre-flight a11y triage (run before "done")

Before you say done, walk this list in order. **5 minutes.**

### 1. Keyboard only — unplug the mouse
- Tab through every interactive element. Does focus follow visual order?
- Is the focused element always visible (visible focus ring)?
- Esc closes modals/popovers?
- Enter/Space activates buttons?
- Arrow keys navigate composite widgets (tabs, menus, listboxes)?

### 2. Names — what does a screen reader say?
For each interactive element, the accessible name should be unambiguous in isolation.
- Buttons: have text OR `aria-label`. **Never icon-only without a label.**
- Form inputs: have a `<label htmlFor>` OR `aria-labelledby`. `placeholder` is not a label.
- Links: text describes the destination. **Never "click here" or "read more"** without context.
- Images: `alt` describes intent (decorative → `alt=""`).

### 3. Landmarks and headings
- One `<h1>` per page (or per major region in a single-page app)
- Heading levels don't skip (`h2` → `h3`, not `h2` → `h4`)
- Page has `<main>`, `<nav>`, `<footer>` (and `<header>` if appropriate)

### 4. Contrast
- Text: 4.5:1 (3:1 for large text ≥ 24px / ≥ 19px bold)
- UI components (buttons, inputs borders) and focus indicators: 3:1
- Check both light AND dark mode if applicable
- Use `axe` DevTools or the Lighthouse a11y audit

### 5. Motion
- Wrap non-essential animations in:
  ```css
  @media (prefers-reduced-motion: no-preference) {
    .animated { animation: slide 0.3s ease; }
  }
  ```
- Or in JS:
  ```tsx
  const prefersReduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  ```
- No flashing > 3 times/second (seizure risk)

## Focus management patterns

### Pattern: Focus on modal open, restore on close
```tsx
function Modal({ open, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      dialogRef.current?.focus();
    } else if (triggerRef.current instanceof HTMLElement) {
      triggerRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      tabIndex={-1}
      className="modal"
    >
      {children}
    </div>,
    document.body
  );
}
```

Also needed in production: **focus trap** (Tab/Shift+Tab stays inside the dialog), **scroll lock** on body. Use `focus-trap-react` or roll your own — call this out in the walkthrough.

### Pattern: Skip link
Always include for any layout with a nav:
```tsx
<a href="#main" className="skip-link">Skip to main content</a>
…
<main id="main" tabIndex={-1}>…</main>
```
```css
.skip-link {
  position: absolute;
  left: -9999px;
}
.skip-link:focus {
  left: 0;
  top: 0;
  /* visible styles */
}
```

### Pattern: Focus on SPA route change

The single highest-impact a11y move for any client-side router. When a user navigates in an SPA, **the DOM updates but focus stays on the old link** — screen reader users hear nothing change, keyboard users find themselves halfway down a navigation they've already left. Move focus to the new page's heading.

```tsx
// In the page-level component (PostDetail, ProductPage, etc.)
function PostDetailPage() {
  const { data } = useQuery(...);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the title when the page's primary data arrives
  useEffect(() => {
    if (data && titleRef.current) titleRef.current.focus();
  }, [data]);

  return (
    <article>
      <h1
        ref={titleRef}
        tabIndex={-1}              // makes a non-interactive element focusable
        className="outline-none"   // we still want :focus-visible, just not a click-focus ring
      >
        {data?.title}
      </h1>
      {/* ... */}
    </article>
  );
}
```

Why `tabIndex={-1}`: an `<h1>` isn't focusable by default. `-1` makes it programmatically focusable without inserting it into the tab order. Screen readers will read the heading when focus lands on it.

Why `outline-none` (with `:focus-visible` left intact elsewhere): a click-triggered focus on a heading is visual noise. Keep the global `:focus-visible` ring for actual keyboard interactions.

The dependency on `data` (rather than route params) means focus moves *when content actually arrives*, not before the loading spinner.

For loaders/Suspense-based routers, a wrapper component that focuses on mount works:

```tsx
function PageHeading({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return <h1 ref={ref} tabIndex={-1} className="outline-none">{children}</h1>;
}
```

Don't combine this with scroll-restoration logic — let the router's `ScrollRestoration` (React Router) handle scroll, and let focus handle screen-reader announcement separately.

### Pattern: Roving tabindex (tabs, menus, listbox)
Only one element in the group is tabbable at a time; arrow keys move focus:
```tsx
function Tabs({ items }: TabsProps) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key === 'ArrowRight') {
      const next = (i + 1) % items.length;
      setActive(next);
      refs.current[next]?.focus();
    } else if (e.key === 'ArrowLeft') {
      const prev = (i - 1 + items.length) % items.length;
      setActive(prev);
      refs.current[prev]?.focus();
    }
  };

  return (
    <div role="tablist">
      {items.map((item, i) => (
        <button
          key={item.id}
          ref={el => { refs.current[i] = el; }}
          role="tab"
          aria-selected={active === i}
          tabIndex={active === i ? 0 : -1}
          onClick={() => setActive(i)}
          onKeyDown={e => onKey(e, i)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
```

## Form a11y patterns

### Every input has a real label
```tsx
// Good
<label htmlFor="email">Email</label>
<input id="email" type="email" />

// Also good (label wraps)
<label>
  Email
  <input type="email" />
</label>

// Acceptable when label is visual elsewhere
<input aria-label="Search" type="search" />
```

### Errors are programmatically associated
```tsx
<label htmlFor="email">Email</label>
<input
  id="email"
  type="email"
  aria-invalid={!!error}
  aria-describedby={error ? 'email-error' : undefined}
/>
{error && (
  <p id="email-error" role="alert">
    {error}
  </p>
)}
```
`role="alert"` announces the error when it appears. For multi-field forms, prefer a single `<div role="alert" aria-live="polite">` summary at the top of the form so the user hears all errors at once.

### Required fields
```tsx
<label htmlFor="name">
  Name <span aria-hidden="true">*</span>
</label>
<input id="name" required aria-required="true" />
```
Or describe the convention once in form intro:
```tsx
<p>Fields marked with <span aria-hidden="true">*</span> are required.</p>
```

### Submit feedback (live region)
```tsx
<div role="status" aria-live="polite">
  {submitting && 'Submitting your request…'}
  {submitted && 'Form submitted successfully.'}
</div>
```

## Image and icon a11y

```tsx
// Decorative — empty alt
<img src="/swirl.svg" alt="" />

// Meaningful image — describe intent, not pixels
<img src="/team.jpg" alt="The Netlify marketing team on stage at JamstackConf" />

// Icon with no accompanying text → label it
<button aria-label="Close">
  <XIcon aria-hidden="true" />
</button>

// Icon next to text → hide from screen reader (text wins)
<button>
  <DownloadIcon aria-hidden="true" />
  Download
</button>
```

For decorative `<svg>` always include `aria-hidden="true"`. For meaningful SVG include `<title>` as first child or use `aria-label` on the svg.

## Color and contrast

- **Never** convey state by color alone — pair with icon, text, or shape
- Error text + red color + error icon — not just red
- Focus rings: use both color and a 2px+ ring; ensure 3:1 contrast against adjacent surfaces
- For text on images, use overlay/scrim to guarantee contrast

## prefers-reduced-motion

For any motion: opacity, transform, transition, animation, scroll-triggered effect:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```
This is a Senior UX Engineer signal — most candidates forget it.

## ARIA gotchas (the easy mistakes)

- `aria-label` on an element with visible text — the label overrides the text (screen reader users hear only the label)
- `role="presentation"` on something interactive — strips semantics
- `aria-hidden="true"` on something focusable — screen reader users tab to nothing
- `aria-expanded` without `aria-controls` (or vice versa) — partial wiring
- `aria-live="polite"` on a region that doesn't exist yet at announcement time — it must already be in the DOM
- `tabindex` > 0 — never use; it breaks tab order

## Testing tools (mention in walkthrough)

- **axe DevTools** (browser extension): finds 30-40% of automatable issues
- **Lighthouse Accessibility** audit
- **Keyboard test**: hands off mouse, tab through everything
- **Screen reader test**: VoiceOver (Cmd+F5 on Mac), NVDA on Windows
- **Color contrast**: Chrome DevTools picker, axe, WebAIM contrast checker

> "I ran axe and Lighthouse; both clean. I tabbed through with the keyboard and the focus order matches reading order. For the modal, I'd add a real focus trap library in production — for the time-boxed build I shipped Esc-to-close and initial focus."

## Quick reference — WCAG 2.2 AA must-haves

- 1.1.1 Non-text content has alt text
- 1.3.1 Info and relationships preserved by semantic HTML
- 1.4.3 Text contrast 4.5:1
- 1.4.11 Non-text contrast 3:1 (UI components)
- 2.1.1 All functionality available from keyboard
- 2.4.3 Focus order is logical
- 2.4.7 Focus is visible
- 2.5.5 Target size 24×24px min (AA), 44×44px (AAA, but worth aiming for)
- 3.3.2 Form fields have labels
- 4.1.2 Custom controls have name, role, value

## Narration phrases

- "I started with semantic HTML — `<button>` and `<form>` give me keyboard handling and focus for free."
- "For the modal, I capture focus on open and restore it on close. In production I'd add a real focus trap library."
- "I added a live region for the form errors so screen reader users hear them immediately."
- "I wrapped the slide animation in `prefers-reduced-motion: no-preference` — not everyone wants motion."
- "I used `aria-current` for the active nav item — it's announced as 'current page' which is more meaningful than visual styling alone."
