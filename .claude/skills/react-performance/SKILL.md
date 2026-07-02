---
name: react-performance
description: React performance and Core Web Vitals — LCP, INP, CLS, bundle size, lazy loading, code splitting, memoization patterns (useMemo, useCallback, React.memo), image optimization, font optimization, when NOT to optimize. Use when optimizing slow components, debugging performance, building for performance-critical pages (marketing/landing), or auditing Core Web Vitals. Triggers on "performance", "slow", "Core Web Vitals", "LCP", "INP", "CLS", "bundle", "lazy", "memoize", "image optimization".
---

# react-performance

Senior performance work is mostly **not** about React. It's about images, fonts, layout shift, and not shipping JS users don't need. Optimize React last.

## The performance triage order

When asked to "make this faster", check in this order. The first three usually fix 80%.

1. **Images** — are they sized, lazy-loaded below the fold, modern formats?
2. **Fonts** — are they self-hosted, preloaded, `font-display: swap`?
3. **Layout shift** — do images/ads have reserved space?
4. **Bundle size** — what's in the JS? Code split anything route-bound?
5. **Third-party scripts** — what's blocking?
6. **Then** look at React-specific concerns (re-renders, expensive components)

Mid-level engineers reach for `React.memo` first. Senior engineers reach for `<Image priority>`.

## Core Web Vitals (memorize these thresholds)

| Metric | What it measures | Good | Needs work |
|---|---|---|---|
| **LCP** (Largest Contentful Paint) | Time to render the biggest above-fold element | ≤ 2.5s | > 4s |
| **INP** (Interaction to Next Paint) | Latency on user interactions (replaces FID in 2024) | ≤ 200ms | > 500ms |
| **CLS** (Cumulative Layout Shift) | How much things visually jump | ≤ 0.1 | > 0.25 |

Plus useful supplements:
- **FCP** (First Contentful Paint): first text/image, ≤ 1.8s
- **TTFB** (Time to First Byte): server response, ≤ 0.8s
- **TBT** (Total Blocking Time): main-thread blocked during load, ≤ 200ms

## LCP — make the hero render fast

The LCP element is usually the hero image, hero heading, or hero video. Speed it up:

### Image LCP fixes
```tsx
// Next.js
import Image from 'next/image';

<Image
  src="/hero.jpg"
  alt="Build smarter, ship faster"
  width={1200}
  height={630}
  priority           // preload, skip lazy
  fetchPriority="high"
  sizes="100vw"      // or specific sizes per breakpoint
/>
```

Plain HTML equivalent:
```html
<link rel="preload" as="image" href="/hero.avif" type="image/avif" fetchpriority="high" />
<picture>
  <source type="image/avif" srcset="/hero.avif" />
  <source type="image/webp" srcset="/hero.webp" />
  <img
    src="/hero.jpg"
    alt="…"
    width="1200"
    height="630"
    fetchpriority="high"
    decoding="async"
  />
</picture>
```

- **Always** width/height (prevents CLS)
- **Modern formats**: AVIF, WebP fallback to JPEG
- **Responsive sizes**: `srcset` + `sizes` so phones don't download desktop images
- **Below-the-fold**: `loading="lazy"` (default off for above-the-fold)
- **Don't lazy-load the LCP image** — it should be eager + priority

### Font LCP fixes
```tsx
// Next.js — self-hosts and inlines optimally
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'], display: 'swap' });
```

Plain HTML:
```html
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="preload" as="font" type="font/woff2" href="/fonts/inter-var.woff2" crossorigin />
```

```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-var.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-display: swap;   /* render with fallback first, swap when loaded */
}
```

- **Self-host** WOFF2 — eliminates a third-party DNS hop
- **Variable fonts** — one file for all weights
- **`font-display: swap`** — render text immediately with fallback
- **Subset** to needed characters (Latin only if your audience is Latin)

### Render-blocking resources
- Move non-critical CSS out of the critical path
- Defer third-party scripts: `<script defer>` or `<script async>` (defer is usually right)
- Inline critical CSS if you're squeezing TTFB

## INP — keep interactions snappy

INP is the new FID. It measures the worst event handler delay over a session.

### Top INP fixes

1. **Don't do expensive work in event handlers**
   ```tsx
   // Bad — re-filters 10k items on every keystroke, then renders
   onChange={e => setQuery(e.target.value)}  // OK
   // but if filtering happens during render and it's heavy → INP suffers

   // Fix: useDeferredValue
   const deferredQuery = useDeferredValue(query);
   const results = useMemo(() => filterHeavy(items, deferredQuery), [items, deferredQuery]);
   ```

2. **Break up long tasks**
   ```tsx
   // Yield to the browser between batches
   async function processChunked(items: Item[]) {
     for (let i = 0; i < items.length; i += 100) {
       processBatch(items.slice(i, i + 100));
       await new Promise(r => setTimeout(r, 0));  // yields
     }
   }
   ```

3. **Use CSS for visual feedback first**
   ```tsx
   <button className="active:scale-95 transition-transform">…</button>
   ```
   CSS feedback is instant; JS work can come after.

4. **`startTransition` for non-urgent updates**
   ```tsx
   const [isPending, startTransition] = useTransition();
   onClick={() => {
     startTransition(() => {
       setBigStateUpdate();   // marked as low-priority
     });
   }}
   ```

5. **Virtualize long lists**
   Use `@tanstack/react-virtual` or `react-window` for any list > 100 items.

## CLS — don't make things jump

CLS is the cheapest to fix. Common causes:

| Cause | Fix |
|---|---|
| Images without `width`/`height` | Always set them (or use `aspect-ratio` CSS) |
| Web fonts swapping in (FOUT/FOIT) | `font-display: swap` + size-adjust fallback fonts |
| Dynamically injected ads/embeds | Reserve fixed space with `min-height` |
| Late-loading hero text | Render server-side, not client-side |
| Animating layout properties | Animate transform instead |

Reserve aspect ratio:
```css
.video-embed { aspect-ratio: 16 / 9; }
.image-wrapper { aspect-ratio: var(--ratio); }
```

Or use `size-adjust` to match fallback font metrics to web font:
```css
@font-face {
  font-family: 'Inter Fallback';
  src: local('Arial');
  size-adjust: 107%;
  ascent-override: 90%;
  /* tools: github.com/seek-oss/capsize */
}
```

## Bundle size — what to ship, what to defer

### See what's in your bundle
- Next.js: `ANALYZE=true next build` (with `@next/bundle-analyzer`)
- Vite: `vite-plugin-visualizer`
- General: `source-map-explorer`

### Common bundle bloat causes
| Cause | Fix |
|---|---|
| Importing the whole lodash | `import debounce from 'lodash-es/debounce'` (or use native) |
| Moment.js | Use `date-fns` (tree-shakable) or `Intl.DateTimeFormat` |
| Whole icon library | Per-icon imports or use SVG inline |
| Bundling polyfills for modern browsers | Set `browserslist` to "modern" |
| Client component when server would do | Use Server Components (Next App Router) |
| Importing dev-only code | Check that `process.env.NODE_ENV` branches are dead-code-eliminated |

### Code splitting
```tsx
// Route-level (Next App Router does this automatically)
// Per-page is already split

// Component-level lazy load
import dynamic from 'next/dynamic';
const HeavyChart = dynamic(() => import('./HeavyChart'), {
  loading: () => <ChartSkeleton />,
  ssr: false,  // if it can't SSR
});

// Plain React
const HeavyChart = lazy(() => import('./HeavyChart'));
<Suspense fallback={<ChartSkeleton />}>
  <HeavyChart />
</Suspense>
```

Good candidates for code splitting:
- Modals / drawers (only loaded when opened)
- Below-the-fold sections (use IntersectionObserver to trigger)
- Heavy editors / charts / maps
- Localized content not on the current path

## React-specific perf (only after the above)

### When to memoize

**`useMemo`** — when:
- The computed value is genuinely expensive (filtering 1000+ items, parsing, formatting)
- The value is a referenced dependency of another hook that re-runs unnecessarily
- The value is passed as a prop to a `React.memo`'d child

**`useCallback`** — when:
- The function is a referenced dependency in `useEffect` / `useMemo`
- The function is passed to a `React.memo`'d child
- The function is in a deeply re-rendering tree

**`React.memo`** — when:
- The component is rendered many times in a list
- The component is expensive AND props are stable
- You've profiled and confirmed re-renders are the bottleneck

**When NOT to memoize**:
- Cheap components (a button, a small div)
- Components rendered once
- Props are inline objects/arrays anyway (`{ x: 1 }` is new every render → memo useless)

```tsx
// Often-wrong premature memo
const Greeting = React.memo(({ name }: { name: string }) => <p>Hello {name}</p>);
// Cost: equality check on every render. Benefit: zero, since <p> is cheap.
```

### React 19+ note
React Compiler (when enabled) handles most memoization automatically. If you're on React 19 + Compiler, you can stop manually adding `useMemo`/`useCallback` and just let the compiler. Mention this in a walkthrough if relevant.

### Common React perf footguns

```tsx
// Bad — new object every render, defeats child memo
<Child config={{ foo: 1 }} />

// Bad — inline component, remounts every render
function Parent() {
  function Inner() { return <div />; }
  return <Inner />;
}

// Bad — useState init runs every render
const [data] = useState(expensiveCompute());
// Good — lazy init
const [data] = useState(() => expensiveCompute());

// Bad — useEffect with object dep, runs every render
useEffect(() => {…}, [{ id: userId }]);
// Good — primitive dep
useEffect(() => {…}, [userId]);
```

## Image optimization checklist

- [ ] `width` and `height` attributes set (or `aspect-ratio` CSS)
- [ ] `loading="lazy"` for below-the-fold
- [ ] `loading="eager"` + `fetchpriority="high"` for the LCP image
- [ ] Modern format (AVIF / WebP) with JPEG/PNG fallback
- [ ] Responsive `srcset` + `sizes`
- [ ] `decoding="async"` (Next/Image does this by default)
- [ ] `alt` text (a11y, not perf, but never miss)

## Font optimization checklist

- [ ] Self-hosted WOFF2 (avoid third-party CSS files)
- [ ] `font-display: swap`
- [ ] Subset to needed character ranges
- [ ] Variable font if you use 3+ weights
- [ ] `<link rel="preload">` for the critical weight
- [ ] Fallback font with `size-adjust` to match metrics

## Social + brand assets

A separate problem from photos and fonts — these ship in the document head, get crawled by social platforms, and need their own sizing/format rules.

### The five files every production site needs

| File | Size | Format | Where it goes |
|---|---|---|---|
| `favicon.svg` | < 2 KB | SVG | `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` |
| `favicon.ico` (legacy fallback) | < 15 KB | ICO with 16×16 + 32×32 | `<link rel="icon" sizes="32x32" href="/favicon.ico">` — only if you must support pre-Chromium Edge or older Safari |
| `apple-touch-icon.png` | < 10 KB | PNG, 180×180 | `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` (iOS rounds the corners itself) |
| `og.png` | < 500 KB (target ~200 KB) | PNG or JPG, 1200×630 | `<meta property="og:image" content="…">` + Twitter Card |
| `manifest.webmanifest` (optional PWA) | < 1 KB | JSON | `<link rel="manifest" href="/manifest.webmanifest">` |

### Favicon — SVG primary, PNG fallback

SVG favicons render crisp at any DPI, scale to OS dark mode, and are tiny. Use SVG as primary and only add a PNG/ICO fallback if your audience includes browsers that don't support SVG icons (basically: pre-2019 Edge).

Don't bother with the historical 47-link-tag favicon dance unless you're shipping to a true legacy audience. Modern minimum:

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

For a dark-aware SVG favicon:

```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="light-dark(#aa3bff, #c084fc)" />
  <path d="…" fill="light-dark(#fff, #0c0a14)" />
</svg>
```

`light-dark()` is supported on all modern browsers and respects `color-scheme: light dark`.

### OG / Twitter card — the 1200×630 image

Standard dimensions across platforms (Facebook, LinkedIn, Twitter/X, Slack unfurl, iMessage rich link):

- **1200 × 630** (1.91:1 aspect)
- **PNG or JPG**, max ~5 MB (platform caps), target ~200–500 KB
- **Critical text in the center 1200×600**, since some platforms crop the edges
- **No fine text** — render at 1× and you're done; mobile previews are ~300px wide, so anything smaller than 24px on a 1200×630 canvas is illegible

### Generating OG cards via screenshot — system fonts only

A common pattern is rendering an HTML template at 1200×630 and screenshotting it. The trap: **web fonts haven't loaded yet** when the screenshot fires, so you get FOIT/FOUT artifacts (missing characters, fallback fonts) baked into your card.

Two ways out:

1. **Use system fonts** in the OG template only. `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif`. Looks fine in a card, dodges the font-loading race entirely.
2. **`await document.fonts.ready`** before screenshotting if you must use a custom font.

Don't try to inline a `@font-face` declaration in the OG template — the screenshotter's headless browser still needs to download the font file before rendering.

### The meta tag set (paste-ready)

```html
<!-- Open Graph — https://ogp.me -->
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Your Site" />
<meta property="og:title" content="Your Title" />
<meta property="og:description" content="One sentence." />
<meta property="og:url" content="https://example.com/" />
<meta property="og:image" content="https://example.com/og.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Describe the card visually." />

<!-- Twitter Cards — https://developer.x.com/en/docs/x-for-websites/cards/ -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Your Title" />
<meta name="twitter:description" content="One sentence." />
<meta name="twitter:image" content="https://example.com/og.png" />
<meta name="twitter:image:alt" content="Describe the card visually." />

<!-- Theme + color scheme -->
<meta name="theme-color" content="#aa3bff" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#16171d" media="(prefers-color-scheme: dark)" />
<meta name="color-scheme" content="light dark" />

<!-- Canonical -->
<link rel="canonical" href="https://example.com/" />
```

Both `og:` and `twitter:` blocks are needed — Twitter prefers its own tags but falls back to OG; LinkedIn reads only OG; Slack reads both. Ship both.

### Brand asset checklist

- [ ] `favicon.svg` exists, references brand color, dark-mode aware
- [ ] `apple-touch-icon.png` 180×180, brand background, no rounded corners (iOS rounds them)
- [ ] `og.png` 1200×630, < 500 KB, key content centered
- [ ] Open Graph tags present (`og:title`, `og:description`, `og:url`, `og:image` + width/height/alt)
- [ ] Twitter Card tags present (`twitter:card="summary_large_image"`, title/description/image/alt)
- [ ] `theme-color` meta with light/dark variants
- [ ] `canonical` link
- [ ] Tested in https://www.opengraph.xyz/ or https://cards-dev.twitter.com/validator (or equivalent)

## Performance audit walkthrough

1. **Lighthouse** in Chrome DevTools → mobile, simulated 4G, "Performance" category
2. **WebPageTest** for real-world conditions across geographies
3. **Chrome DevTools Performance panel** for INP / main-thread profiling
4. **Coverage panel** for unused JS/CSS
5. **Network panel** with throttling for image/font loading order
6. **Real User Monitoring** in production: Vercel Speed Insights, Cloudflare Web Analytics, or Netlify's own RUM

## When the interviewer asks "how would you make this faster?"

Senior answer follows the order from this skill:
1. "First I'd check the LCP element — usually an image. Make sure it's sized, in a modern format, and not lazy-loaded."
2. "Then fonts — `font-display: swap`, self-hosted, preload the critical weight."
3. "Then layout shift — reserve aspect ratios for media."
4. "Then bundle — what's importing the whole lodash? What can be a Server Component?"
5. "Then React-level — but I'd profile before assuming `React.memo` matters."
6. "I'd measure on a throttled mobile profile, not my MacBook on wifi."

## Narration phrases

- "The LCP element is the hero image, so I gave it `priority` and a modern format."
- "I'm not adding `useMemo` here — the children are cheap, and the wrap cost would exceed the recompute cost."
- "I deferred the chart with `dynamic()` because it's below the fold and weighs 60 KB."
- "I virtualized the list because we render 500 rows and only ~10 are visible."
- "I wrapped the search filter in `useDeferredValue` so keystrokes stay responsive even on slow phones."
- "The animation is on `transform`, not `top`/`width`, so it doesn't trigger layout — keeps CLS at zero."
