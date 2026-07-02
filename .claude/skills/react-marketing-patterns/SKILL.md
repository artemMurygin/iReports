---
name: react-marketing-patterns
description: Marketing-site React patterns — hero sections, CTAs, pricing tables, testimonial carousels, lead-capture forms, sticky navigation, scroll-triggered animations, FAQ accordions, feature comparison tables, newsletter signups. Use when building landing pages, marketing components, conversion-focused UI, or Jamstack marketing sites. Triggers on "landing page", "hero", "CTA", "pricing", "testimonial", "lead form", "marketing site", "newsletter", "FAQ".
---

# react-marketing-patterns

Production-ready patterns for marketing-site components. Each pattern below is built with: semantic HTML, keyboard a11y, design tokens, responsive default, and respect for motion preferences.

These are scaffolds. Don't ship them verbatim — adapt to the brief. But know them cold so you don't burn the clock inventing structure.

## Hero section

```tsx
type HeroProps = {
  eyebrow?: string;
  title: ReactNode;     // ReactNode so caller can highlight a span
  subtitle?: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  image?: { src: string; alt: string; width: number; height: number };
};

export function Hero({
  eyebrow,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  image,
}: HeroProps) {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-32 lg:flex lg:items-center lg:gap-16">
        <div className="lg:flex-1">
          {eyebrow && (
            <p className="text-sm font-semibold uppercase tracking-wider text-brand">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-6 text-lg leading-relaxed text-fg-muted max-w-xl">
              {subtitle}
            </p>
          )}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href={primaryCta.href}
              className="inline-flex items-center justify-center h-12 px-6 rounded-md bg-brand text-white font-medium hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand transition-colors"
            >
              {primaryCta.label}
            </a>
            {secondaryCta && (
              <a
                href={secondaryCta.href}
                className="inline-flex items-center h-12 px-6 rounded-md text-fg font-medium hover:bg-fg/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand transition-colors"
              >
                {secondaryCta.label}
                <span aria-hidden="true" className="ml-1">→</span>
              </a>
            )}
          </div>
        </div>
        {image && (
          <div className="mt-12 lg:mt-0 lg:flex-1">
            <img
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              fetchPriority="high"
              className="w-full h-auto rounded-lg shadow-lg"
            />
          </div>
        )}
      </div>
    </section>
  );
}
```

**Key senior moves**:
- `title` is `ReactNode` — caller can highlight words: `title={<>Build <span className="text-brand">smarter</span></>}`
- One `<h1>` per page — this is the page title
- `fetchPriority="high"` on hero image
- Width/height on image prevents CLS
- `focus-visible` for keyboard focus rings
- Arrow uses `aria-hidden` (not part of accessible name)

## CTA button (component-grade)

```tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { forwardRef } from 'react';

const button = cva(
  'inline-flex items-center justify-center font-medium rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-white hover:bg-brand-hover',
        secondary: 'bg-fg/5 text-fg hover:bg-fg/10',
        ghost: 'bg-transparent text-fg hover:bg-fg/5',
        link: 'bg-transparent text-brand underline-offset-4 hover:underline px-0',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button> & {
    loading?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(button({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner className="mr-2" aria-hidden="true" />}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
```

## Pricing card / tier

```tsx
type Tier = {
  name: string;
  price: { monthly: number; yearly: number };
  description: string;
  features: string[];
  cta: { label: string; href: string };
  featured?: boolean;
};

export function PricingTier({ tier, billing }: { tier: Tier; billing: 'monthly' | 'yearly' }) {
  const price = tier.price[billing];
  return (
    <article
      className={cn(
        'flex flex-col rounded-lg border bg-bg p-8',
        tier.featured ? 'border-brand ring-2 ring-brand' : 'border-border'
      )}
      aria-label={`${tier.name} plan`}
    >
      {tier.featured && (
        <p className="self-start mb-4 inline-flex items-center px-3 py-1 rounded-full bg-brand/10 text-brand text-xs font-semibold uppercase tracking-wide">
          Most popular
        </p>
      )}
      <h3 className="text-xl font-semibold">{tier.name}</h3>
      <p className="mt-2 text-fg-muted">{tier.description}</p>
      <p className="mt-6">
        <span className="text-4xl font-bold tracking-tight">${price}</span>
        <span className="ml-2 text-fg-muted">
          /{billing === 'monthly' ? 'mo' : 'yr'}
        </span>
      </p>
      <ul className="mt-8 space-y-3" role="list">
        {tier.features.map(feature => (
          <li key={feature} className="flex items-start gap-2">
            <CheckIcon
              className="mt-1 h-4 w-4 text-brand flex-shrink-0"
              aria-hidden="true"
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <a
        href={tier.cta.href}
        className="mt-8 inline-flex items-center justify-center h-11 px-5 rounded-md bg-brand text-white font-medium hover:bg-brand-hover transition-colors"
      >
        {tier.cta.label}
      </a>
    </article>
  );
}
```

**With monthly/yearly toggle**:
```tsx
export function Pricing({ tiers }: { tiers: Tier[] }) {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  return (
    <section>
      <div role="radiogroup" aria-label="Billing period" className="flex justify-center gap-1 rounded-md bg-fg/5 p-1 w-fit mx-auto">
        {(['monthly', 'yearly'] as const).map(option => (
          <button
            key={option}
            role="radio"
            aria-checked={billing === option}
            onClick={() => setBilling(option)}
            className={cn(
              'px-4 py-2 rounded text-sm font-medium transition-colors',
              billing === option ? 'bg-bg text-fg shadow-sm' : 'text-fg-muted'
            )}
          >
            {option === 'monthly' ? 'Monthly' : 'Yearly'}
            {option === 'yearly' && (
              <span className="ml-2 text-xs text-brand">Save 20%</span>
            )}
          </button>
        ))}
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {tiers.map(tier => (
          <PricingTier key={tier.name} tier={tier} billing={billing} />
        ))}
      </div>
    </section>
  );
}
```

## Lead capture form (the senior version)

```tsx
'use client';
import { useState } from 'react';

type FormState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success' }
  | { status: 'error'; message: string };

export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<FormState>({ status: 'idle' });
  const [emailError, setEmailError] = useState<string | null>(null);

  const validate = (value: string): string | null => {
    if (!value) return 'Email is required';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return 'Enter a valid email';
    return null;
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const error = validate(email);
    if (error) {
      setEmailError(error);
      return;
    }
    setEmailError(null);
    setState({ status: 'submitting' });
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error('Subscription failed');
      setState({ status: 'success' });
      setEmail('');
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Something went wrong',
      });
    }
  };

  if (state.status === 'success') {
    return (
      <p role="status" className="rounded-md bg-brand/10 p-4 text-brand">
        Thanks — check your inbox to confirm.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col sm:flex-row gap-3">
      <div className="flex-1">
        <label htmlFor="newsletter-email" className="sr-only">
          Email
        </label>
        <input
          id="newsletter-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={e => {
            setEmail(e.target.value);
            if (emailError) setEmailError(null);
          }}
          placeholder="you@example.com"
          aria-invalid={!!emailError}
          aria-describedby={emailError ? 'email-error' : undefined}
          disabled={state.status === 'submitting'}
          className="w-full h-12 px-4 rounded-md border border-border bg-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        />
        {emailError && (
          <p id="email-error" role="alert" className="mt-2 text-sm text-danger">
            {emailError}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={state.status === 'submitting'}
        aria-busy={state.status === 'submitting' || undefined}
        className="inline-flex items-center justify-center h-12 px-6 rounded-md bg-brand text-white font-medium hover:bg-brand-hover disabled:opacity-50 transition-colors"
      >
        {state.status === 'submitting' ? 'Subscribing…' : 'Subscribe'}
      </button>
      {state.status === 'error' && (
        <p role="alert" className="text-sm text-danger sm:basis-full">
          {state.message}
        </p>
      )}
    </form>
  );
}
```

**Senior moves**:
- State machine (`idle | submitting | success | error`) — no boolean soup
- `noValidate` on form, then explicit validation (full control over messaging)
- `aria-invalid` + `aria-describedby` wiring the error to the input
- `role="alert"` on error message → announced by screen reader
- `aria-busy` while submitting
- Error clears on next keystroke (don't shame the user)
- `autocomplete="email"` for password managers / browser autofill
- Sr-only label (visually hidden but available to screen readers)

## Testimonial carousel (a11y nightmare made calm)

```tsx
export function TestimonialCarousel({ items }: { items: Testimonial[] }) {
  const [index, setIndex] = useState(0);
  const prefersReduced = useMediaQuery('(prefers-reduced-motion: reduce)');

  useEffect(() => {
    if (prefersReduced) return;
    const id = setInterval(() => setIndex(i => (i + 1) % items.length), 6000);
    return () => clearInterval(id);
  }, [prefersReduced, items.length]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Customer testimonials"
      className="relative"
    >
      <div
        aria-live={prefersReduced ? 'off' : 'polite'}
        aria-atomic="true"
        className="min-h-[200px]"
      >
        <blockquote className="text-xl md:text-2xl">
          <p>"{items[index].quote}"</p>
          <footer className="mt-6 text-base text-fg-muted">
            — {items[index].name}, {items[index].role}
          </footer>
        </blockquote>
      </div>
      <div role="tablist" aria-label="Choose testimonial" className="mt-8 flex justify-center gap-2">
        {items.map((item, i) => (
          <button
            key={item.name}
            role="tab"
            aria-selected={index === i}
            aria-label={`Testimonial ${i + 1} of ${items.length}`}
            onClick={() => setIndex(i)}
            className={cn(
              'h-2 w-8 rounded-full transition-colors',
              index === i ? 'bg-brand' : 'bg-fg/20 hover:bg-fg/30'
            )}
          />
        ))}
      </div>
    </section>
  );
}
```

**Senior moves**:
- Auto-advance respects `prefers-reduced-motion` (and `aria-live` follows it)
- `aria-roledescription="carousel"` is more accurate than `role="region"` here
- Pagination dots have accessible labels
- `min-height` prevents layout shift as content changes length

## Sticky navigation with scroll behavior

```tsx
export function StickyNav({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-all duration-200',
        scrolled
          ? 'bg-bg/80 backdrop-blur-md border-b border-border'
          : 'bg-transparent'
      )}
    >
      {children}
    </header>
  );
}
```

**Senior detail**: `{ passive: true }` on the scroll listener — tells the browser the handler won't `preventDefault`, so scroll stays smooth.

## Skip link (always include with a sticky nav)

```tsx
<a
  href="#main"
  className="absolute left-2 top-2 z-50 -translate-y-16 focus:translate-y-0 bg-brand text-white px-4 py-2 rounded-md transition-transform"
>
  Skip to main content
</a>
…
<main id="main" tabIndex={-1}>…</main>
```

## FAQ accordion (native `<details>` is fine!)

The simplest, most accessible accordion is native HTML:

```tsx
export function FAQ({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-border">
      {items.map(item => (
        <details key={item.q} className="group py-4">
          <summary className="flex justify-between items-center cursor-pointer list-none font-medium">
            {item.q}
            <ChevronIcon
              aria-hidden="true"
              className="h-5 w-5 transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="mt-3 text-fg-muted">{item.a}</div>
        </details>
      ))}
    </dl>
  );
}
```

**Why this is senior**: native `<details>`/`<summary>` ships keyboard, focus, expanded state, and screen reader semantics — no ARIA needed. Use a custom Disclosure only when you need shared/exclusive open state or animation that `<details>` doesn't allow.

## Feature comparison table

```tsx
type Feature = { label: string; tiers: Record<string, boolean | string> };

export function ComparisonTable({ features, tiers }: ComparisonProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <caption className="sr-only">Plan feature comparison</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="py-4 pr-6 font-medium">Feature</th>
            {tiers.map(tier => (
              <th key={tier} scope="col" className="py-4 px-6 font-medium">
                {tier}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {features.map(feature => (
            <tr key={feature.label} className="border-b border-border">
              <th scope="row" className="py-4 pr-6 font-normal">
                {feature.label}
              </th>
              {tiers.map(tier => {
                const value = feature.tiers[tier];
                return (
                  <td key={tier} className="py-4 px-6">
                    {typeof value === 'boolean' ? (
                      value ? (
                        <>
                          <CheckIcon className="h-5 w-5 text-brand" aria-hidden="true" />
                          <span className="sr-only">Included</span>
                        </>
                      ) : (
                        <>
                          <span aria-hidden="true" className="text-fg-muted">—</span>
                          <span className="sr-only">Not included</span>
                        </>
                      )
                    ) : (
                      value
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Senior moves**:
- `<th scope="col">` and `<th scope="row">` — screen readers announce row/column headers
- `<caption className="sr-only">` for context (a real table caption when it makes sense visually)
- Icons paired with `sr-only` text — color/icon never conveys meaning alone
- `overflow-x-auto` parent for mobile

## Scroll-triggered fade-in (motion-respecting)

```tsx
export function FadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const prefersReduced = useMediaQuery('(prefers-reduced-motion: reduce)');

  useEffect(() => {
    if (prefersReduced) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [prefersReduced]);

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(12px)',
        transition: prefersReduced ? 'none' : `opacity 400ms ease ${delay}ms, transform 400ms ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
```

## Newsletter / lead form variants quick reference

- **Inline single field** → simplest, highest conversion for top-of-funnel
- **Two-field** (name + email) → marginal lift, friction increase, use for gated content
- **Multi-step** → enterprise lead-gen, complex products
- **Exit-intent modal** → noisy, only if conversions matter > UX (and even then a11y carefully)

## Common marketing-page section anatomy

The "scrollytelling" rhythm most marketing sites follow:
1. **Hero** — pitch in 3 seconds, primary CTA
2. **Social proof** — logos, "trusted by"
3. **Features (3-6)** — icon + headline + 1-sentence body
4. **Detailed feature** — image + paragraph alternating
5. **Testimonials**
6. **Pricing** (if applicable)
7. **FAQ**
8. **Final CTA** — repeats the hero's promise
9. **Footer**

If you're given a brief for a marketing page and no specific structure, this is a safe default.

## Narration phrases

- "I used a `<details>` element for the FAQ because it ships keyboard and screen reader behavior for free — building a custom accordion would have been more code and worse a11y."
- "The carousel auto-advance is gated on `prefers-reduced-motion` — if the user opted out, content still cycles via the dots but doesn't move on its own."
- "I made `title` a `ReactNode` instead of a string so the caller can highlight specific words in brand color — composition over a `highlight` prop."
- "Form state is a tagged union — no boolean soup. The compiler enforces that we handle every state."
- "I used `aria-busy` on the button and a real `role='alert'` for errors so screen reader users get the same feedback as everyone else."
