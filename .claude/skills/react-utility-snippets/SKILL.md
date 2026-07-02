---
name: react-utility-snippets
description: Paste-ready React hooks and helpers that other react-* skills reference but don't define — cn (clsx + tailwind-merge), useMediaQuery (SSR-safe), usePrefersReducedMotion, useFocusTrap, useAnnouncer + LiveRegion, useOnClickOutside, useLocalStorage (SSR-safe), useIsomorphicLayoutEffect, useDebounce, useThrottle, useEventListener, useInterval, useId patterns. Every snippet is SSR-safe and dependency-light. Load this skill at the start of any interview build. Triggers on "useMediaQuery", "focus trap", "cn helper", "clsx", "tailwind-merge", "live region", "useAnnouncer", "useLocalStorage", "useDebounce", "useThrottle", "snippet", "utility hook", "paste-ready", "click outside", "prefers reduced motion".
---

# react-utility-snippets

Paste-ready React utility hooks and helpers that the other react-* skills reference but don't define. Every snippet is **SSR-safe**, dependency-light, and ready to drop into a fresh interview build. Don't waste time reinventing these mid-build.

## The full kit

| Utility | Reach for it when |
|---|---|
| `cn` | Conditional Tailwind class composition |
| `useMediaQuery` | Read a media query into React state |
| `usePrefersReducedMotion` | Gate animations on user preference |
| `useFocusTrap` | Trap Tab inside modal / dialog / off-canvas |
| `useAnnouncer` + `<LiveRegion>` | Imperative screen reader announcements |
| `useOnClickOutside` | Close popover / menu / dropdown |
| `useLocalStorage` | Persist tiny UI state |
| `useIsomorphicLayoutEffect` | useLayoutEffect without SSR warning |
| `useDebounce` / `useThrottle` | Defer or rate-limit derived values |
| `useEventListener` | Cleaner window/element event listener |
| `useInterval` | setInterval that respects component lifecycle |
| `useId` patterns | Stable IDs for label/input/error wiring |

## `cn` — className composer

```ts
// lib/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

`clsx` handles conditional strings; `twMerge` resolves Tailwind class conflicts (`px-2` then `px-4` → final `px-4`). If Tailwind isn't on the table, drop `twMerge` and just use `clsx`.

```tsx
<button className={cn('btn', variant === 'primary' && 'btn-primary', className)} />
```

## `useMediaQuery` — SSR-safe

The naive `window.matchMedia(...)` version crashes during SSR. This version starts with a safe default and syncs after mount.

```tsx
// hooks/useMediaQuery.ts
import { useEffect, useState } from 'react';

export function useMediaQuery(query: string, defaultValue = false): boolean {
  const [matches, setMatches] = useState(defaultValue);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
```

The `defaultValue` argument lets you pass a sensible SSR default (`false` for desktop-first, `true` for mobile-first) so first paint isn't always wrong.

```tsx
const isMobile = useMediaQuery('(max-width: 767px)');
const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
```

## `usePrefersReducedMotion` — the specific shortcut

```tsx
import { useMediaQuery } from './useMediaQuery';

export function usePrefersReducedMotion() {
  return useMediaQuery('(prefers-reduced-motion: reduce)', false);
}
```

```tsx
const reduced = usePrefersReducedMotion();
const transition = reduced ? 'none' : 'transform 200ms var(--ease)';
```

## `useFocusTrap` — vanilla, no library

The 30-line implementation that keeps Tab and Shift+Tab cycling inside a container. Use this when a modal/dialog/menu is open.

```tsx
// hooks/useFocusTrap.ts
import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useFocusTrap(
  ref: RefObject<HTMLElement>,
  active: boolean
) {
  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;

    const focusables = () =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS))
        .filter(el => !el.hasAttribute('aria-hidden') && el.offsetParent !== null);

    // Move focus inside on activate
    const els = focusables();
    els[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const current = focusables();
      if (current.length === 0) return;
      const first = current[0];
      const last = current[current.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    root.addEventListener('keydown', onKey);
    return () => root.removeEventListener('keydown', onKey);
  }, [ref, active]);
}
```

```tsx
function Modal({ open, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open);
  if (!open) return null;
  return (
    <div ref={ref} role="dialog" aria-modal="true">
      {children}
    </div>
  );
}
```

**Note**: if you're using native `<dialog>` with `.showModal()`, the browser handles focus trap for you — skip this hook.

## `useAnnouncer` + `<LiveRegion>` — imperative screen reader announcements

For announcing state changes (form submitted, item added, search results loaded) to screen reader users without inline `aria-live` regions everywhere.

```tsx
// components/Announcer.tsx
'use client';
import {
  createContext, useContext, useState, useCallback,
  type ReactNode,
} from 'react';

type AnnouncerContext = {
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
};

const Ctx = createContext<AnnouncerContext>({ announce: () => {} });

export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState('');
  const [assertive, setAssertive] = useState('');

  const announce = useCallback(
    (msg: string, priority: 'polite' | 'assertive' = 'polite') => {
      // Clear then set so identical messages still announce
      if (priority === 'polite') {
        setPolite('');
        setTimeout(() => setPolite(msg), 50);
      } else {
        setAssertive('');
        setTimeout(() => setAssertive(msg), 50);
      }
    },
    []
  );

  return (
    <Ctx.Provider value={{ announce }}>
      {children}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {polite}
      </div>
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertive}
      </div>
    </Ctx.Provider>
  );
}

export function useAnnouncer() {
  return useContext(Ctx);
}
```

The `sr-only` utility (Tailwind ships this; otherwise):
```css
.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

```tsx
// In root layout:
<AnnouncerProvider>{children}</AnnouncerProvider>

// Anywhere in the tree:
const { announce } = useAnnouncer();
announce('Subscribed — check your inbox', 'polite');
announce('Error: payment declined', 'assertive');
```

**Why polite vs assertive**: `polite` queues the message (doesn't interrupt). `assertive` interrupts whatever the screen reader is saying. Use assertive only for errors / urgent state changes.

## `useOnClickOutside` — close popovers cleanly

```tsx
// hooks/useOnClickOutside.ts
import { useEffect, type RefObject } from 'react';

export function useOnClickOutside<T extends HTMLElement>(
  ref: RefObject<T>,
  handler: (event: MouseEvent | TouchEvent) => void
) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      const el = ref.current;
      if (!el || el.contains(event.target as Node)) return;
      handler(event);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}
```

```tsx
const ref = useRef<HTMLDivElement>(null);
useOnClickOutside(ref, () => setOpen(false));
return <div ref={ref}>…</div>;
```

**Note**: if using the `popover` attribute, the browser handles light dismiss — skip this hook.

## `useLocalStorage` — SSR-safe

```tsx
// hooks/useLocalStorage.ts
import { useEffect, useState } from 'react';

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw));
    } catch {}
  }, [key]);

  const set = (next: T | ((prev: T) => T)) => {
    setValue(prev => {
      const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(v));
      } catch {}
      return v;
    });
  };

  return [value, set];
}
```

Reads happen in `useEffect` (after mount) to avoid SSR hydration mismatch. If you need the value during initial server render, use a cookie instead.

## `useIsomorphicLayoutEffect`

```tsx
import { useEffect, useLayoutEffect } from 'react';

export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;
```

Use this anywhere you'd reach for `useLayoutEffect` in code that also runs server-side — silences the SSR warning while keeping sync behavior on the client.

## `useDebounce`

```tsx
// hooks/useDebounce.ts
import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
```

Classic search-as-you-type:
```tsx
const [query, setQuery] = useState('');
const debounced = useDebounce(query, 250);
useEffect(() => { search(debounced); }, [debounced]);
```

## `useThrottle`

```tsx
import { useEffect, useRef, useState } from 'react';

export function useThrottle<T>(value: T, limit = 200): T {
  const [throttled, setThrottled] = useState(value);
  const last = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    const remaining = limit - (now - last.current);
    if (remaining <= 0) {
      last.current = now;
      setThrottled(value);
    } else {
      const id = setTimeout(() => {
        last.current = Date.now();
        setThrottled(value);
      }, remaining);
      return () => clearTimeout(id);
    }
  }, [value, limit]);

  return throttled;
}
```

Use for scroll position, window size on resize, mouse coordinates.

## `useEventListener`

```tsx
// hooks/useEventListener.ts
import { useEffect, useRef } from 'react';

export function useEventListener<K extends keyof WindowEventMap>(
  type: K,
  handler: (event: WindowEventMap[K]) => void,
  target: Window | HTMLElement | null =
    typeof window !== 'undefined' ? window : null
) {
  const saved = useRef(handler);
  useEffect(() => { saved.current = handler; }, [handler]);

  useEffect(() => {
    if (!target) return;
    const listener = (e: Event) => saved.current(e as WindowEventMap[K]);
    target.addEventListener(type, listener);
    return () => target.removeEventListener(type, listener);
  }, [type, target]);
}
```

`saved.current` keeps the handler reference fresh without re-attaching the listener on every render.

```tsx
useEventListener('keydown', e => {
  if (e.key === 'Escape') close();
});
```

## `useInterval` — SSR-safe and pause-able

```tsx
// hooks/useInterval.ts
import { useEffect, useRef } from 'react';

export function useInterval(callback: () => void, delay: number | null) {
  const saved = useRef(callback);
  useEffect(() => { saved.current = callback; }, [callback]);

  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
```

Pass `null` to pause:
```tsx
useInterval(() => setSeconds(s => s + 1), running ? 1000 : null);
```

## `useId` patterns

`useId()` (React 18+) returns a stable SSR-safe ID. Use it to wire label/input/error/description together.

```tsx
import { useId } from 'react';

function Field({ label, error }: { label: string; error?: string }) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
      />
      {error && <p id={errorId} role="alert">{error}</p>}
    </div>
  );
}
```

For multiple related IDs from one `useId()`:
```tsx
const id = useId();
const labelId = `${id}-label`;
const buttonId = `${id}-button`;
const menuId = `${id}-menu`;
```

## Common pitfalls

| Mistake | Fix |
|---|---|
| `useMediaQuery` reads `window` on first render | Use the SSR-safe version above |
| Focus trap leaks Tab to address bar | The wrap-around handler covers Shift+Tab + Tab |
| `useDebounce` cleanup forgotten | Always `return () => clearTimeout(id)` |
| `useLocalStorage` reads synchronously during render | Read after mount in `useEffect` |
| `useEventListener` re-attaches every render | Store `handler` in a ref |
| `useId` used as a key in a list | `useId` is per-component, not per-item — use `item.id` for keys |

## Narration phrases

- "I keep these hooks in a `lib/hooks/` directory — each is SSR-safe and tested. Saves me from reinventing them in every component."
- "I'm using `usePrefersReducedMotion` instead of inlining the matchMedia call so the intent is obvious at the call site."
- "The focus trap is a 30-line hook — for production I'd reach for `focus-trap-react` but the inline version is enough for the time-boxed build."
- "I went with `useDebounce` over `useDeferredValue` because I want a real time delay; deferred is React's scheduling-aware version which behaves differently under concurrent rendering."

## Authoritative references

- React reference: https://react.dev/reference/react
- `useId` docs: https://react.dev/reference/react/useId
- `useLayoutEffect` SSR caveats: https://react.dev/reference/react/useLayoutEffect
- `useDeferredValue` (alternative to debounce in some cases): https://react.dev/reference/react/useDeferredValue
- MDN matchMedia: https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia
- usehooks.com (additional patterns): https://usehooks.com/
- React Aria hooks (production-grade reference): https://react-spectrum.adobe.com/react-aria/
- focus-trap-react source (reference impl): https://github.com/focus-trap/focus-trap-react
