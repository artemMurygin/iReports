---
name: react-modern-react
description: React 19 features and patterns for both vanilla React (Vite, Astro, plain) and Next.js App Router — useActionState, useFormStatus, useOptimistic, useTransition, useDeferredValue, the React Compiler, Suspense + use() for promises, Error Boundaries. Vanilla React 19 features work in any project; Next-specific patterns (Server Components, Server Actions, App Router conventions, metadata API) are clearly separated. Use when working in any React 19+ project to apply current patterns over older ones. Triggers on "React 19", "useActionState", "useFormStatus", "useOptimistic", "useTransition", "useDeferredValue", "React Compiler", "Suspense", "use()", "Server Component", "Server Action", "App Router", "metadata", "modern React", "current React", "RSC".
---

# react-modern-react

React 19 (current as of 2026) adds hooks and patterns that change idiomatic React code. Some work in **any** React 19+ project (Vite, plain React, Astro islands); others are Next-specific. This skill separates them so you reach for the right one based on the stack.

## The React 19 menu

| Feature | Vanilla React 19 | Next-specific |
|---|---|---|
| `useTransition` | ✓ | ✓ |
| `useDeferredValue` | ✓ | ✓ |
| `useOptimistic` | ✓ | ✓ |
| `useActionState` | ✓ | ✓ |
| `useFormStatus` | ✓ | ✓ |
| `use()` for promises | ✓ | ✓ |
| `<Suspense>` | ✓ | ✓ |
| React Compiler | ✓ (with plugin) | ✓ (with config) |
| Error Boundaries (class) | ✓ | ✓ |
| Server Components | | ✓ |
| Server Actions | | ✓ |
| App Router file conventions | | ✓ |
| Metadata API | | ✓ |

The hooks work in any React 19+ project. Server Components and Server Actions need a framework that supports them.

---

## Part 1: Vanilla React 19 features

These work in Vite, plain React, Astro React islands, etc.

### `useTransition` — mark updates as non-urgent

```tsx
import { useState, useTransition } from 'react';

export function Search({ items }: { items: Item[] }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(items);
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    startTransition(() => {
      // Filter and update results — marked as non-urgent
      setResults(items.filter(i => i.name.includes(value)));
    });
    // The input itself updates urgently (instant feedback)
    setQuery(value);
  };

  return (
    <>
      <input value={query} onChange={handleChange} />
      {isPending && <Spinner aria-label="Filtering" />}
      <List items={results} />
    </>
  );
}
```

**When**: a state update triggers expensive rendering that competes with user input (typing, dragging).

### `useDeferredValue` — defer a derived value

```tsx
import { useState, useDeferredValue } from 'react';

export function SearchResults({ items }: { items: Item[] }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  // Heavy filter uses the deferred value
  const filtered = items.filter(item => item.name.includes(deferredQuery));
  const isStale = query !== deferredQuery;

  return (
    <>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <div style={{ opacity: isStale ? 0.5 : 1 }}>
        <List items={filtered} />
      </div>
    </>
  );
}
```

**When**: you have a derived value (filter result, formatted output) that's expensive to compute and don't need to recompute on every keystroke.

**vs `useTransition`**: `useTransition` wraps an action (you control the set); `useDeferredValue` lags a value (you control the read). Both result in similar UX; pick based on which side of the data flow you have access to.

### `useOptimistic` — show success before the server confirms

```tsx
import { useOptimistic } from 'react';

type Like = { count: number; pending?: boolean };

export function LikeButton({
  initialCount,
  onLike,
}: {
  initialCount: number;
  onLike: () => Promise<void>;
}) {
  const [optimistic, addOptimistic] = useOptimistic<Like, void>(
    { count: initialCount },
    (state) => ({ count: state.count + 1, pending: true })
  );

  return (
    <button
      onClick={async () => {
        addOptimistic();
        await onLike();
      }}
    >
      👍 {optimistic.count}
    </button>
  );
}
```

**When**: UI feedback for actions that almost always succeed (likes, adding to cart, toggling). If the action throws, React rolls back the optimistic state automatically.

### `useActionState` — manage form state via an action

Works with `<form action={fn}>`. The action receives `(prevState, formData)` and returns the new state.

```tsx
'use client';
import { useActionState } from 'react';

type State = { status: 'idle' | 'success' | 'error'; message?: string };

async function action(_prev: State, formData: FormData): Promise<State> {
  const email = formData.get('email');
  if (!email || !String(email).includes('@')) {
    return { status: 'error', message: 'Enter a valid email' };
  }
  // call API...
  return { status: 'success', message: 'Thanks!' };
}

export function NewsletterForm() {
  const [state, formAction] = useActionState(action, { status: 'idle' });

  return (
    <form action={formAction}>
      <input name="email" type="email" required />
      <button type="submit">Subscribe</button>
      {state.status === 'error' && <p role="alert">{state.message}</p>}
      {state.status === 'success' && <p role="status">{state.message}</p>}
    </form>
  );
}
```

In **vanilla React 19**, the action is a client function. In **Next.js**, it can be marked `'use server'` (becomes a Server Action). The hook is the same.

### `useFormStatus` — read pending state in a form descendant

```tsx
'use client';
import { useFormStatus } from 'react-dom';

export function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending || undefined}>
      {pending ? 'Submitting…' : 'Submit'}
    </button>
  );
}
```

Reads from the **nearest enclosing `<form>`**. No prop drilling for `isSubmitting`.

```tsx
// Parent form just composes — no state plumbing
<form action={action}>
  <input name="email" />
  <SubmitButton />            {/* reads pending from useFormStatus internally */}
</form>
```

### `use()` for promises and contexts

Lets you "await" a promise in a component (suspends until resolved):

```tsx
import { use, Suspense } from 'react';

function UserInfo({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise);
  return <p>Welcome, {user.name}</p>;
}

export function Profile({ userId }: { userId: string }) {
  const userPromise = fetchUser(userId);   // start fetch, don't await
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <UserInfo userPromise={userPromise} />
    </Suspense>
  );
}
```

`use()` can also read context conditionally (unlike `useContext`):

```tsx
function Item({ id }: { id: string }) {
  if (id === 'header') return <Header />;
  const theme = use(ThemeContext);     // legal: `use` can be conditional
  return <div className={theme}>…</div>;
}
```

### `<Suspense>` — declarative loading boundaries

```tsx
<Suspense fallback={<Skeleton />}>
  <SlowComponent />
</Suspense>
```

Anything inside `<Suspense>` that suspends (lazy component, `use()` of a promise) renders the fallback. Use for code-split components and async data fetching.

### Error Boundaries — class component (still needed)

React doesn't have a hook-based Error Boundary yet; the class component is still the way.

```tsx
import { Component, type ReactNode } from 'react';

class ErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) { console.error(error); }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
```

Or use `react-error-boundary` library:
```tsx
import { ErrorBoundary } from 'react-error-boundary';

<ErrorBoundary fallback={<p>Something went wrong</p>}>
  <App />
</ErrorBoundary>
```

### The React Compiler

If your project enables it (Vite plugin, Next built-in), the compiler auto-memoizes components and values. You can **stop adding `useMemo` / `useCallback` / `React.memo` manually** for most cases.

Check if it's on:
```bash
grep -r "react-compiler" package.json next.config.js vite.config.ts
```

If enabled, narration:
> "I'm letting the Compiler handle memoization. Manual `useMemo` would add code without measurable benefit since the Compiler tracks dependencies more precisely than I would."

If **not** enabled (still the more common case): default to no premature memoization. Add only when profiled.

---

## Part 2: Next.js App Router features

Only relevant if you're in a Next 13+ App Router project. Skip if Vite or plain React.

### Server vs Client Component — decision tree

```
Is the component:
├── Reading from a database / filesystem / private API?  → Server
├── Using useState / useEffect / event handlers / refs?   → Client
├── Using browser APIs (window, localStorage)?            → Client
├── Importing a Client-only library?                      → Client
└── Just rendering props + children?                      → Server (default)
```

Default to Server. Add `'use client'` only at the leaves where needed.

```tsx
// app/page.tsx — Server Component (default, no 'use client')
import { Hero } from './hero';
import { NewsletterForm } from './newsletter-form';

export default async function Page() {
  const data = await fetchData();          // direct async, no useEffect
  return (
    <main>
      <Hero data={data} />
      <NewsletterForm />                   // Client component
    </main>
  );
}

// app/newsletter-form.tsx
'use client';
import { useActionState } from 'react';
// ...
```

### Server Actions

A function with `'use server'` runs on the server but can be called from Client Components and `<form action={...}>`.

```tsx
// app/actions/subscribe.ts
'use server';
import { z } from 'zod';

const Schema = z.object({ email: z.string().email() });

export async function subscribe(_prev: State, formData: FormData) {
  const result = Schema.safeParse({ email: formData.get('email') });
  if (!result.success) return { status: 'error', message: 'Invalid email' };
  await saveToDatabase(result.data);
  return { status: 'success' };
}
```

```tsx
// app/components/NewsletterForm.tsx
'use client';
import { useActionState } from 'react';
import { subscribe } from '@/app/actions/subscribe';

export function NewsletterForm() {
  const [state, action] = useActionState(subscribe, { status: 'idle' });
  return <form action={action}>…</form>;
}
```

The huge win: forms work **without JS** — Next's runtime handles the form submission via plain HTML form POST, then enhances when JS loads. Progressive enhancement for free.

### Metadata API

```tsx
// app/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — Netlify',
  description: 'Pricing tiers for Netlify customers',
  openGraph: {
    title: 'Pricing — Netlify',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
  },
};

export default function PricingPage() { /* ... */ }
```

For dynamic metadata:
```tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await getPost(params.slug);
  return { title: post.title, description: post.excerpt };
}
```

### `generateStaticParams` (SSG)

```tsx
// app/docs/[slug]/page.tsx
export async function generateStaticParams() {
  const docs = await getAllDocs();
  return docs.map(doc => ({ slug: doc.slug }));
}
```

Tells Next to pre-render these paths at build time.

### Route segment config

```tsx
// app/page.tsx
export const revalidate = 3600;            // ISR — re-build every hour
export const dynamic = 'force-static';     // or 'force-dynamic' / 'auto'
export const fetchCache = 'force-cache';
```

### File conventions

| File | Purpose |
|---|---|
| `page.tsx` | The route's page |
| `layout.tsx` | Shared layout (wraps children) |
| `loading.tsx` | Suspense fallback for the route |
| `error.tsx` | Error boundary for the route (must be Client) |
| `not-found.tsx` | 404 for the route |
| `route.ts` | API route (vs page) |

---

## When to reach for what — quick decision table

| Situation | Reach for |
|---|---|
| Search input with expensive filter | `useDeferredValue` |
| Action triggers slow update; keep typing snappy | `useTransition` |
| Form submission with feedback | `<form action={fn}>` + `useActionState` |
| Submit button shows pending | `useFormStatus` |
| "Added!" feedback before server confirms | `useOptimistic` |
| Read data on server, no useEffect | Server Component (Next) |
| Lazy-load a component | `lazy()` + `<Suspense>` |
| Conditional context read | `use(Context)` |
| Catch render errors | `<ErrorBoundary>` (class or library) |
| Trigger a server function from a form | `'use server'` action + `<form action>` |

---

## Anti-patterns to retire (now that React 19 ships)

| Old pattern | Modern replacement |
|---|---|
| `useState` + `useEffect` for fetching | Server Component (Next) or `use(promise)` |
| `useState` + manual `isSubmitting` boolean | `useActionState` + `useFormStatus` |
| Multiple sequential `setState` (waterfall renders) | `startTransition(() => { multipleSets() })` |
| `useMemo` everywhere "just in case" | Let the Compiler handle it, or don't memoize |
| `useEffect` to sync derived state | Compute inline or with `useMemo` |
| Custom "is this loading?" state for lazy components | `<Suspense fallback={...}>` |
| Class component for state | Functional + hooks (Error Boundary is the exception) |

---

## The Compiler note (important if it's enabled)

If your project has the React Compiler enabled:
- Drop most `useMemo` / `useCallback` / `React.memo`
- The Compiler memoizes more aggressively and accurately than humans
- Your code reads cleaner because optimization is invisible

If the Compiler is **not** enabled (still the more common case): use `useMemo` / `useCallback` / `React.memo` only where profiling shows a real benefit. Default to no premature memoization either way.

---

## Calibration for the Netlify "keep it simple" brief

Some of these features (Server Actions, `useOptimistic`, `useTransition`) are cool but might be overkill for a 2-hour build that's explicitly "not testing cleverness."

For a Netlify-style brief:

| Probably use | Probably skip |
|---|---|
| `useActionState` for forms (it's simpler than manual state) | `useOptimistic` (unless the brief calls for instant feedback) |
| `useFormStatus` for submit buttons | `useTransition` for tiny lists |
| Plain `useState` + hooks | Server Actions if you're on Vite |
| Default React behavior | The Compiler manually configured |
| `<Suspense>` for lazy components | `use()` for fetching if you can pass data as a prop |

The senior signal isn't "I used every new hook." It's "I used the right hook for the situation, and I can explain why I didn't reach for others."

---

## Narration phrases

- "I'm using `useActionState` instead of manual `useState` for the form — ships pending tracking, and the form works without JS if Server Actions are involved."
- "I went with `useDeferredValue` over `useTransition` because I'm reading the value, not setting it — they're often interchangeable but the API matches the use case."
- "I deliberately didn't memoize this — the Compiler would handle it, and the component is cheap enough that manual memoization is noise."
- "This is a Server Component because it's just rendering data; `'use client'` is only on the form, which is the leaf that needs interactivity."
- "I considered `useOptimistic` for instant feedback, but for a single newsletter signup the server response is fast enough that the rollback logic isn't worth it."

## Authoritative references

- React 19 release notes: https://react.dev/blog/2024/12/05/react-19
- `useActionState`: https://react.dev/reference/react/useActionState
- `useFormStatus`: https://react.dev/reference/react-dom/hooks/useFormStatus
- `useOptimistic`: https://react.dev/reference/react/useOptimistic
- `useTransition`: https://react.dev/reference/react/useTransition
- `useDeferredValue`: https://react.dev/reference/react/useDeferredValue
- `use()` API: https://react.dev/reference/react/use
- React Compiler: https://react.dev/learn/react-compiler
- `<Suspense>` reference: https://react.dev/reference/react/Suspense
- Next.js App Router: https://nextjs.org/docs/app
- Next.js Server Components: https://nextjs.org/docs/app/building-your-application/rendering/server-components
- Next.js Server Actions: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
- react-error-boundary library: https://github.com/bvaughn/react-error-boundary
