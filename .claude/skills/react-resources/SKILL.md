---
name: react-resources
description: Curated authoritative documentation URL library for React 19, accessibility (WAI-ARIA APG, WebAIM), performance (web.dev Core Web Vitals), HTML/CSS platform (MDN), forms (Zod, react-hook-form), testing (Testing Library, Playwright), Next.js App Router, TypeScript, and tooling — indexed by problem keyword for quick lookup during interview builds. Claude can WebFetch any of these URLs for current authoritative content when inline knowledge isn't enough. Use when you need to verify a pattern, look up a spec, or pull in primary-source docs mid-build. Triggers on "where to find", "documentation for", "spec for", "look up", "research", "reference", "WAI-ARIA", "MDN", "web.dev", "React docs", "Next docs", "Tailwind docs", "what does X say about", "authoritative".
---

# react-resources

The research / documentation-pulling layer for the React skill set. Indexed by problem keyword, then organized by source. When you hit an edge case the inline skills don't cover, Claude can `WebFetch` any of these for current authoritative info.

**How Claude should use this skill**: when Jabal asks about a topic that's not fully covered in the inline skills, look up the keyword in the index, identify the canonical URL, and WebFetch it. Cite the source in the response so Jabal can verify.

## Index by problem keyword

| Keyword | Look at |
|---|---|
| accessibility, a11y, WCAG | WAI-ARIA APG, MDN ARIA, WebAIM |
| anchor positioning | MDN CSS Anchor Positioning |
| ARIA pattern (any) | WAI-ARIA Authoring Practices Guide |
| autocomplete / combobox | WAI-ARIA APG Combobox |
| bundle analysis | web.dev bundle reduction |
| color contrast | WebAIM contrast checker |
| compound component | Kent C. Dodds blog |
| container queries | MDN Container Queries |
| Core Web Vitals | web.dev/articles/vitals |
| dialog / modal | MDN `<dialog>`, web.dev a11y dialog |
| docs / README | Make a README, Diátaxis |
| dropdown / select | WAI-ARIA APG Combobox or Listbox |
| dynamic / lazy | React.dev `lazy()` and `<Suspense>` |
| focus management | TPGi focus management, MDN focus |
| forms (general) | React.dev forms, Zod docs |
| Framer Motion | Framer docs |
| `:has()` | MDN `:has()` |
| hydration error | React.dev hydration errors |
| INP | web.dev INP, Chrome DevTools Performance |
| keyboard navigation | WAI-ARIA APG, Inclusive Components |
| LCP | web.dev LCP |
| `light-dark()` | MDN `light-dark()` |
| listbox | WAI-ARIA APG Listbox |
| memoization | React.dev `useMemo` / Compiler docs |
| menu | WAI-ARIA APG Menu and Menubar |
| metadata (Next) | Next.js Metadata API |
| meta tags / OG / Twitter Cards / favicon / theme-color | Social / SEO metadata section below |
| Next.js App Router | Next.js docs |
| optimistic UI | React.dev `useOptimistic` |
| `popover` attribute | MDN Popover API |
| `prefers-reduced-motion` | MDN media queries |
| `:user-valid` / `:user-invalid` | MDN |
| Radix Primitives | radix-ui.com |
| react-hook-form | react-hook-form.com |
| React Aria | react-spectrum.adobe.com/react-aria |
| screen reader testing | WebAIM, Deque University |
| Server Actions (Next) | Next.js Server Actions |
| Server Components | Next.js Server Components |
| Suspense | React.dev `<Suspense>` |
| Tailwind | tailwindcss.com |
| testing | Testing Library, Playwright |
| TypeScript + React | React.dev TypeScript, react-typescript-cheatsheet |
| `useActionState` | React.dev |
| `useDeferredValue` | React.dev |
| `useFormStatus` | React.dev |
| `useOptimistic` | React.dev |
| `useTransition` | React.dev |
| WCAG | w3.org/WAI/standards-guidelines/wcag/ |
| browser support (any feature) | caniuse.com |
| package size | bundlephobia.com |

---

## React core

| URL | What's there |
|---|---|
| https://react.dev/reference/react | Full hook reference (canonical) |
| https://react.dev/blog/2024/12/05/react-19 | React 19 release notes |
| https://react.dev/reference/react/useActionState | `useActionState` reference |
| https://react.dev/reference/react-dom/hooks/useFormStatus | `useFormStatus` reference |
| https://react.dev/reference/react/useOptimistic | `useOptimistic` reference |
| https://react.dev/reference/react/useTransition | `useTransition` reference |
| https://react.dev/reference/react/useDeferredValue | `useDeferredValue` reference |
| https://react.dev/reference/react/use | `use()` API for promises and context |
| https://react.dev/reference/react/Suspense | `<Suspense>` reference |
| https://react.dev/learn/react-compiler | React Compiler |
| https://react.dev/learn/typescript | React + TypeScript guide |
| https://react.dev/learn/you-might-not-need-an-effect | The canonical anti-patterns article (worth re-reading) |
| https://react.dev/learn/synchronizing-with-effects | When useEffect is actually correct |

---

## Accessibility

| URL | What's there |
|---|---|
| https://www.w3.org/WAI/ARIA/apg/patterns/ | WAI-ARIA Authoring Practices — canonical patterns (combobox, listbox, menu, tabs, dialog, etc.) |
| https://www.w3.org/WAI/standards-guidelines/wcag/ | WCAG 2.2 standard |
| https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA | MDN ARIA reference |
| https://webaim.org/ | WebAIM — practical a11y guides |
| https://webaim.org/resources/contrastchecker/ | Color contrast checker |
| https://inclusive-components.design/ | Inclusive Components (Heydon Pickering) — canonical patterns rebuilt accessibly |
| https://www.tpgi.com/the-difference-between-keyboard-and-screen-reader-navigation/ | Keyboard vs screen reader nav distinction |
| https://www.deque.com/axe/ | axe DevTools — automated a11y testing |
| https://dequeuniversity.com/screenreaders/ | Screen reader keyboard shortcuts |

---

## Performance

| URL | What's there |
|---|---|
| https://web.dev/articles/vitals | Core Web Vitals overview |
| https://web.dev/articles/lcp | LCP deep dive |
| https://web.dev/articles/inp | INP deep dive |
| https://web.dev/articles/cls | CLS deep dive |
| https://web.dev/articles/optimize-lcp | LCP optimization tactics |
| https://web.dev/articles/optimize-inp | INP optimization tactics |
| https://web.dev/articles/optimize-cls | CLS optimization tactics |
| https://developer.chrome.com/docs/devtools/performance | Chrome DevTools Performance panel |
| https://developer.chrome.com/docs/lighthouse | Lighthouse docs |
| https://web.dev/articles/font-best-practices | Font loading best practices |

---

## HTML / CSS platform

| URL | What's there |
|---|---|
| https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog | `<dialog>` reference |
| https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details | `<details>` and `name` attribute |
| https://developer.mozilla.org/en-US/docs/Web/API/Popover_API | Popover API |
| https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_anchor_positioning | CSS Anchor Positioning |
| https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inert | `inert` attribute |
| https://developer.mozilla.org/en-US/docs/Web/CSS/:has | `:has()` |
| https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-within | `:focus-within` |
| https://developer.mozilla.org/en-US/docs/Web/CSS/:user-valid | `:user-valid` / `:user-invalid` |
| https://developer.mozilla.org/en-US/docs/Web/CSS/light-dark | `light-dark()` |
| https://developer.mozilla.org/en-US/docs/Web/CSS/color-mix | `color-mix()` |
| https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries | Container queries |
| https://developer.mozilla.org/en-US/docs/Web/HTML/Constraint_validation | Native form validation |
| https://developer.mozilla.org/en-US/docs/Web/API/FormData | FormData API |
| https://caniuse.com/ | Browser support lookup |

---

## Forms and validation

| URL | What's there |
|---|---|
| https://zod.dev/ | Zod docs (schemas + type inference) |
| https://react-hook-form.com/ | react-hook-form docs |
| https://www.w3.org/WAI/ARIA/apg/practices/form-instructions/ | Form a11y patterns (APG) |
| https://webaim.org/techniques/formvalidation/ | WebAIM form validation |
| https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations | Next Server Actions |

---

## Component patterns and headless libraries

| URL | What's there |
|---|---|
| https://www.radix-ui.com/primitives | Radix Primitives (production headless components — read source for reference implementations) |
| https://react-spectrum.adobe.com/react-aria/ | React Aria hooks (Adobe's production a11y primitives) |
| https://patterns.dev/ | Common React patterns library |
| https://kentcdodds.com/blog/compound-components-with-react-hooks | Compound components essay |
| https://kentcdodds.com/blog/inversion-of-control | Inversion of control / headless |
| https://www.joshwcomeau.com/ | Josh Comeau — great writing on React + CSS |

---

## Styling

| URL | What's there |
|---|---|
| https://tailwindcss.com/docs | Tailwind docs (v4 current) |
| https://tailwindcss.com/docs/installation/using-vite | Tailwind v4 with Vite |
| https://tailwindcss.com/docs/upgrade-guide | Tailwind v3 → v4 migration |
| https://cva.style/docs | class-variance-authority |
| https://github.com/lukeed/clsx | clsx |
| https://github.com/dcastil/tailwind-merge | tailwind-merge |
| https://ui.shadcn.com/ | shadcn/ui — component API patterns reference |
| https://every-layout.dev/ | Every Layout — primitive layout patterns |

---

## Testing

| URL | What's there |
|---|---|
| https://testing-library.com/docs/react-testing-library/intro | React Testing Library |
| https://testing-library.com/docs/queries/about | Queries cheat sheet |
| https://playwright.dev/docs/intro | Playwright docs |
| https://playwright.dev/docs/accessibility-testing | Playwright + axe |
| https://playwright.dev/docs/locators | Playwright locators (getByRole, getByLabel, etc.) |
| https://playwright.dev/docs/api/class-page | Playwright Page API |
| https://playwright.dev/docs/test-configuration | Playwright config reference |
| https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright | @axe-core/playwright |
| https://www.deque.com/axe/core-documentation/api-documentation/ | axe-core API |
| https://vitest.dev/ | Vitest docs |
| https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications | Testing trophy (testing philosophy) |

---

## Social / SEO metadata

For the document head — favicons, OG/Twitter cards, theme colors, manifests, canonical links.

| URL | What's there |
|---|---|
| https://ogp.me/ | The Open Graph protocol — canonical spec for `og:*` meta tags |
| https://developer.x.com/en/docs/x-for-websites/cards/markup | Twitter Cards markup reference |
| https://developer.x.com/en/docs/x-for-websites/cards/overview/markup | Twitter Cards types (summary, summary_large_image, player, app) |
| https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name/theme-color | `<meta name="theme-color">` reference (incl. media-query variants) |
| https://developer.mozilla.org/en-US/docs/Web/Manifest | Web App Manifest reference |
| https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link | `<link rel>` values (icon, apple-touch-icon, manifest, canonical) |
| https://web.dev/articles/add-manifest | web.dev: adding a manifest |
| https://www.opengraph.xyz/ | OG preview tester (paste a URL, see how Facebook/LinkedIn/Slack will render it) |
| https://cards-dev.twitter.com/validator | Twitter card validator (X's renamed but URL still works) |
| https://realfavicongenerator.net/ | Audit your favicon coverage across platforms |
| https://github.com/audreyfeldroy/favicon-cheat-sheet | The minimum-viable favicon set (most projects need less than they think) |

---

## Next.js (when applicable)

| URL | What's there |
|---|---|
| https://nextjs.org/docs/app | App Router docs |
| https://nextjs.org/docs/app/building-your-application/rendering/server-components | Server Components |
| https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations | Server Actions |
| https://nextjs.org/docs/app/building-your-application/optimizing/metadata | Metadata API |
| https://nextjs.org/docs/app/api-reference/file-conventions/page | File conventions |
| https://nextjs.org/docs/app/api-reference/components/image | next/image |
| https://nextjs.org/docs/app/api-reference/components/font | next/font |
| https://nextjs.org/docs/app/building-your-application/caching | Caching model |

---

## TypeScript

| URL | What's there |
|---|---|
| https://www.typescriptlang.org/docs/ | TypeScript handbook |
| https://react-typescript-cheatsheet.netlify.app/ | React + TypeScript cheatsheet (community) |
| https://github.com/sindresorhus/type-fest | type-fest utility types |

---

## Documentation

| URL | What's there |
|---|---|
| https://www.makeareadme.com/ | README best practices |
| https://diataxis.fr/ | Diátaxis documentation framework |
| https://adr.github.io/ | Architecture Decision Records |
| https://www.writethedocs.org/guide/docs-as-code/ | Docs as code principles |
| https://docs.github.com/en/get-started/writing-on-github | GitHub Markdown reference |

---

## Tools and references

| URL | What's there |
|---|---|
| https://caniuse.com/ | Browser support for any feature |
| https://bundlephobia.com/ | Package size lookup |
| https://www.npmjs.com/ | Package registry |
| https://github.com/ | GitHub for source-of-truth library code |

---

## How Claude should use this skill

When Jabal asks about a topic not fully covered in his inline skills:

1. **Look up the keyword** in the index at the top of this file.
2. **Identify the canonical URL** for that topic.
3. **Use `WebFetch`** to retrieve current content.
4. **Synthesize the answer** with the source linked.

If Claude is confident in inline knowledge AND the topic isn't changing rapidly, the fetch can be skipped. For anything that may have changed (React, Next.js, browser support), prefer the fetch.

**When in doubt, fetch and cite.** It's faster to verify than to be wrong in a 2-hour interview.

## Authoritative references

This whole skill is the reference. See above.
