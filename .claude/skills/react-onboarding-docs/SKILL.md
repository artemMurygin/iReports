---
name: react-onboarding-docs
description: React patterns for product onboarding flows and documentation sites — multi-step flows, progress indicators, empty states, contextual hints, code-block components, TOC sidebars, on-this-page nav, callouts, copy-buttons, search, syntax highlighting. Use when building onboarding UI, product tours, documentation pages, knowledge bases, or developer-facing reference sites. Triggers on "onboarding", "tour", "walkthrough", "empty state", "tooltip", "documentation", "docs site", "code block", "TOC", "table of contents", "callout".
---

# react-onboarding-docs

Patterns for the two Netlify-scope surfaces beyond marketing pages: **onboarding flows** (first-run experiences, product tours, empty states) and **documentation** (code-heavy reference pages, callouts, navigation). Both are about **getting a user to "aha" fast** — onboarding through guided action, docs through scannable answers.

## The shared principle: progressive disclosure

Both onboarding and docs fail when they show everything at once. Show what's relevant *now*, hide the rest behind a click or scroll.

- Onboarding: one step at a time, each with one clear next action
- Docs: TOC + collapsible sections + "show more" code blocks, not 8000-word walls

## Part 1: Onboarding patterns

### Multi-step onboarding flow

```tsx
type Step = {
  id: string;
  title: string;
  description?: string;
  render: () => ReactNode;
};

export function OnboardingFlow({ steps, onComplete }: { steps: Step[]; onComplete: () => void }) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  return (
    <section aria-labelledby="onboarding-title">
      <ProgressBar current={index + 1} total={steps.length} />
      <header className="mt-6">
        <p className="text-sm font-medium text-fg-muted">
          Step {index + 1} of {steps.length}
        </p>
        <h2 id="onboarding-title" className="mt-1 text-2xl font-bold">
          {step.title}
        </h2>
        {step.description && (
          <p className="mt-2 text-fg-muted">{step.description}</p>
        )}
      </header>
      <div className="mt-8">{step.render()}</div>
      <footer className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIndex(i => Math.max(0, i - 1))}
          disabled={index === 0}
          className="text-fg-muted disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => (isLast ? onComplete() : setIndex(i => i + 1))}
          className="inline-flex items-center justify-center h-10 px-5 rounded-md bg-brand text-white font-medium hover:bg-brand-hover"
        >
          {isLast ? 'Finish' : 'Continue'}
        </button>
      </footer>
    </section>
  );
}
```

### Progress bar (a11y-aware)

```tsx
export function ProgressBar({ current, total }: { current: number; total: number }) {
  const percent = Math.round((current / total) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Step ${current} of ${total}`}
      className="h-1.5 w-full rounded-full bg-fg/10 overflow-hidden"
    >
      <div
        className="h-full bg-brand transition-all duration-300 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
```

**Senior moves**:
- `role="progressbar"` + `aria-valuenow/min/max` so screen readers announce progress
- `aria-label` describes the meaning, not the visual
- Animate `width` is fine here — it's a one-shot transition, not a per-frame animation, and it's a single element

### Empty state (the "we haven't shown you the product yet" moment)

```tsx
type EmptyStateProps = {
  illustration?: ReactNode;
  title: string;
  description: string;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; href: string };
};

export function EmptyState({
  illustration,
  title,
  description,
  primaryAction,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <section className="flex flex-col items-center text-center py-16 px-6">
      {illustration && (
        <div aria-hidden="true" className="mb-6 text-fg-muted">
          {illustration}
        </div>
      )}
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-fg-muted">{description}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {primaryAction && (
          <button
            type="button"
            onClick={primaryAction.onClick}
            className="inline-flex h-10 px-5 rounded-md bg-brand text-white font-medium hover:bg-brand-hover"
          >
            {primaryAction.label}
          </button>
        )}
        {secondaryAction && (
          <a
            href={secondaryAction.href}
            className="text-brand hover:underline underline-offset-4"
          >
            {secondaryAction.label}
          </a>
        )}
      </div>
    </section>
  );
}
```

**Senior frame for empty states**: an empty state is not an error state. It's the **highest-value real estate in your product** — it's the user's first instruction. Treat it like a hero, not a "no data" placeholder.

Bad: "No projects yet."
Good: "Connect your first site in under a minute. We'll guide you through linking a Git repo and your first deploy."

### Contextual hint / tooltip (built on `<button>` semantics)

```tsx
export function HintTooltip({ children, label }: { children: ReactNode; label: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={e => e.key === 'Escape' && setOpen(false)}
        className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-fg/10 text-fg-muted hover:bg-fg/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <span aria-hidden="true">?</span>
        <span className="sr-only">{label}</span>
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-full mt-2 -translate-x-1/2 z-10 w-max max-w-xs rounded-md bg-fg text-bg text-sm px-3 py-2 shadow-lg"
        >
          {children}
        </span>
      )}
    </span>
  );
}
```

**Senior notes**:
- Trigger is `<button>` — never just a `<span>` with mouseenter. Keyboard users need it too.
- Opens on hover AND focus; closes on blur AND Escape
- `aria-describedby` wires the tooltip content to the trigger
- For production: use Radix UI `Tooltip` or React Aria — they handle delay, positioning, and edge cases (mobile, RTL)

### "What's new" dismissible banner

```tsx
export function ChangelogBanner({ id, title, href, onDismiss }: ChangelogBannerProps) {
  return (
    <aside
      role="status"
      aria-labelledby={`banner-${id}`}
      className="flex items-start gap-3 rounded-lg border border-border bg-bg p-4"
    >
      <SparkIcon aria-hidden="true" className="mt-0.5 h-5 w-5 text-brand flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p id={`banner-${id}`} className="font-medium">
          {title}
        </p>
        <a href={href} className="mt-1 inline-block text-sm text-brand hover:underline">
          See what's new →
        </a>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-fg-muted hover:text-fg p-1 -m-1"
      >
        <XIcon aria-hidden="true" className="h-4 w-4" />
      </button>
    </aside>
  );
}
```

Persist dismissal in `localStorage` keyed by the banner ID so it stays dismissed.

## Part 2: Documentation site patterns

### Code block with copy button (the bread-and-butter docs component)

```tsx
'use client';
import { useState } from 'react';

type CodeBlockProps = {
  code: string;
  language?: string;
  filename?: string;
  highlightLines?: number[];
};

export function CodeBlock({ code, language, filename, highlightLines }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <figure className="rounded-lg overflow-hidden border border-border bg-fg/[0.03]">
      {filename && (
        <figcaption className="flex items-center justify-between px-4 py-2 border-b border-border bg-fg/[0.04]">
          <code className="text-sm text-fg-muted">{filename}</code>
          {language && (
            <span className="text-xs uppercase tracking-wide text-fg-muted">
              {language}
            </span>
          )}
        </figcaption>
      )}
      <div className="relative">
        <pre
          tabIndex={0}
          aria-label={`Code example${filename ? ` from ${filename}` : ''}`}
          className="overflow-x-auto p-4 text-sm font-mono leading-relaxed"
        >
          <code className={language ? `language-${language}` : undefined}>
            {code}
          </code>
        </pre>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'Copied' : 'Copy code'}
          aria-live="polite"
          className="absolute right-2 top-2 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-bg/80 backdrop-blur text-sm text-fg-muted hover:text-fg border border-border opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
        >
          {copied ? (
            <>
              <CheckIcon aria-hidden="true" className="h-3.5 w-3.5" />
              Copied
            </>
          ) : (
            <>
              <CopyIcon aria-hidden="true" className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
    </figure>
  );
}
```

**Senior moves**:
- `<figure>` + `<figcaption>` — semantic structure for "labeled media"
- `<pre tabIndex={0}>` so keyboard users can scroll long code blocks
- Copy button announces state via `aria-live` (screen reader users know it worked)
- Highlighting via Shiki or Prism — done at build time when possible (zero-runtime cost)

### TOC (table of contents) — auto-generated from headings

```tsx
'use client';
import { useEffect, useState } from 'react';

type Heading = { id: string; text: string; level: 2 | 3 };

export function TOC() {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLHeadingElement>('main h2, main h3')
    );
    setHeadings(
      els.map(el => ({
        id: el.id,
        text: el.textContent ?? '',
        level: (el.tagName === 'H2' ? 2 : 3) as 2 | 3,
      }))
    );

    const io = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: '0px 0px -70% 0px' }
    );
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="font-semibold mb-3">On this page</p>
      <ul className="space-y-2">
        {headings.map(h => (
          <li key={h.id} className={h.level === 3 ? 'ml-4' : ''}>
            <a
              href={`#${h.id}`}
              aria-current={activeId === h.id ? 'location' : undefined}
              className={
                activeId === h.id
                  ? 'text-brand font-medium'
                  : 'text-fg-muted hover:text-fg'
              }
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

**Senior detail**: `aria-current="location"` is announced as "current location" by screen readers — far better than just visual styling.

### Callout / admonition box

```tsx
type CalloutKind = 'note' | 'tip' | 'warning' | 'danger';

const kindConfig: Record<CalloutKind, { icon: ReactNode; label: string; className: string }> = {
  note:    { icon: <InfoIcon />,     label: 'Note',    className: 'border-fg/20 bg-fg/[0.03]' },
  tip:     { icon: <SparkIcon />,    label: 'Tip',     className: 'border-brand/30 bg-brand/[0.05]' },
  warning: { icon: <WarningIcon />,  label: 'Warning', className: 'border-amber-500/30 bg-amber-500/[0.05]' },
  danger:  { icon: <DangerIcon />,   label: 'Danger',  className: 'border-red-500/30 bg-red-500/[0.05]' },
};

export function Callout({
  kind = 'note',
  title,
  children,
}: { kind?: CalloutKind; title?: string; children: ReactNode }) {
  const c = kindConfig[kind];
  return (
    <aside
      role="note"
      aria-label={title ?? c.label}
      className={cn('flex gap-3 rounded-lg border p-4 my-6', c.className)}
    >
      <span aria-hidden="true" className="flex-shrink-0 mt-0.5">
        {c.icon}
      </span>
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div className="prose-sm">{children}</div>
      </div>
    </aside>
  );
}
```

**Senior detail**: color is paired with an icon AND a label — never relies on color alone (a11y requirement).

### On-this-page-quick anchor links (heading anchors)

```tsx
export function AnchorHeading({ as: Tag = 'h2', id, children }: AnchorHeadingProps) {
  return (
    <Tag id={id} className="group scroll-mt-20">
      <a
        href={`#${id}`}
        aria-label={`Link to ${typeof children === 'string' ? children : 'section'}`}
        className="absolute -ml-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-fg-muted hover:text-brand"
      >
        #
      </a>
      {children}
    </Tag>
  );
}
```

`scroll-mt-20` accounts for sticky header so anchored sections don't get hidden under it.

### Docs search (UX shape, not implementation)

The pattern most senior:
- `Cmd+K` opens a modal search overlay
- Type-ahead with keyboard nav (arrow up/down, Enter to select, Esc to close)
- Results grouped (Guides, API, Blog)
- Empty state shows popular searches / recent

A11y must-haves:
- Search input has a real label (`<label className="sr-only">`)
- Results in `role="listbox"`, items in `role="option"`
- `aria-activedescendant` tracks the keyboard-highlighted item
- Esc closes; focus returns to the trigger

This is one of the highest-effort components to build well. For an interview, mention you'd use Algolia DocSearch or Pagefind rather than rolling search yourself — it's the right tradeoff.

### Documentation page skeleton (Next.js App Router shape)

```tsx
// app/docs/[...slug]/page.tsx
export default function DocPage({ params }) {
  const { content, headings, frontmatter } = getDoc(params.slug);
  return (
    <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-[240px_1fr_240px] gap-12 px-6 py-12">
      <aside aria-label="Documentation navigation">
        <SidebarNav />
      </aside>
      <main id="main" tabIndex={-1}>
        <article className="prose prose-neutral max-w-none">
          <header>
            <h1>{frontmatter.title}</h1>
            {frontmatter.description && (
              <p className="lead">{frontmatter.description}</p>
            )}
          </header>
          {content}
        </article>
        <PrevNext />
      </main>
      <aside aria-label="On this page" className="hidden lg:block">
        <TOC headings={headings} />
      </aside>
    </div>
  );
}
```

## Onboarding/docs UX principles (the things to mention)

- **One next action per screen** — don't make users decide
- **Show the user where they are** — progress for onboarding, breadcrumbs/TOC for docs
- **Optimistic state** — assume success, show success, roll back on error
- **Don't trap users** — always a Back, always a Skip (with consequences explained)
- **Skim-readable** — bold the verbs, short paragraphs, generous whitespace
- **Code is content** — copyable, scrollable, syntax-highlighted, accessible
- **Search is non-optional for docs** — typing 4 characters > clicking 3 categories
- **The empty state is the hero** — it's the first instruction the user sees

## Common mistakes

| Mistake | Fix |
|---|---|
| Modal onboarding with no Skip | Always allow skip; track who skipped to improve later |
| Multi-step form with no progress indicator | Always show "Step N of M" |
| Tooltips on hover only (mouse-only) | Open on hover AND focus, close on blur AND Esc |
| Code blocks with no copy button | Add a copy button; announce success |
| TOC without active section indicator | Use IntersectionObserver + `aria-current` |
| Callout that conveys urgency by color alone | Always pair color with icon + text label |
| Docs page with no `<main>` landmark | Wrap content in `<main id="main">` + skip link |

## Narration phrases

- "Empty states are the highest-value real estate in a product — this is the user's first instruction, so I framed it as a hero with one clear next action rather than a 'no data' placeholder."
- "The progress bar uses `role='progressbar'` with `aria-valuenow/min/max` so screen reader users hear 'step 2 of 4' announced — visual progress alone leaves them behind."
- "I used a real `<figure>` and `<figcaption>` for the code block — semantic 'labeled media' instead of a wrapper div."
- "The TOC uses IntersectionObserver to mark the active section and `aria-current='location'` so screen readers announce it as 'current location'."
- "For search, in a real build I'd reach for Algolia DocSearch or Pagefind — rolling search well is a multi-week project, not a multi-hour one."
- "Callouts pair color, icon, and label — color alone fails a11y and the print-out version."
