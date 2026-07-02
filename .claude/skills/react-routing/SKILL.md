---
name: react-routing
description: Client-side routing in React with React Router v6/v7 — createBrowserRouter and the data router, route definition patterns, dynamic params, loaders + actions vs. TanStack Query (when to use which), scroll restoration, focus management on route change, route-based code splitting with lazy(), nested routes and Outlet, NavLink active states, programmatic navigation, 404 / errorElement, type-safe params, when to skip routing entirely. Use whenever a React SPA needs more than one URL. Triggers on "routing", "router", "react-router", "react-router-dom", "createBrowserRouter", "Routes", "Route", "useParams", "useNavigate", "Outlet", "NavLink", "loader", "action", "scroll restoration", "deep link", "SPA navigation", "404 page", "lazy route", "code splitting".
---

# react-routing

Routing is the spine of multi-page SPAs but it's notoriously easy to do poorly. This skill is the senior-engineer cut: which API to use, where to put loaders, how to handle focus/scroll, what to skip.

## First question: do you need routing at all?

For a single-component build or a 2-hour interview prompt, **skip routing**. It's overhead. State-based view switching with `useState<'list' | 'detail'>('list')` plus URL sync via `pushState` is usually wrong, but a single screen with no navigation is fine.

Reach for a router when:
- Multiple distinct screens with distinct URLs
- Deep linking matters (sharing a URL, browser back/forward)
- SEO requires distinct pages (use Next.js then, not React Router)

Skip when:
- Single screen, no navigation
- One modal/drawer that's just open/closed state
- Wizard with `step` as local state and `?step=N` for shareability (use `useSearchParams`, not full routes)

## Pick the right router

For a Vite + React SPA, the answer is `react-router-dom` v6 or v7 with `createBrowserRouter` (the **data router**). This skill assumes that choice.

Alternatives and when:

| Router | When |
|---|---|
| `react-router-dom` (data router) | Default for SPAs. Battle-tested. Loaders, actions, error boundaries built in. |
| TanStack Router | Type-safe params + file-based routes from generators. Newer. Compelling if everyone on the team is fluent. |
| Next.js App Router | If SSR/SSG/RSC matter. Different mental model — use the `react-modern-react` skill. |
| Wouter | Tiny (1.5kb). Marketing site with 3 pages. Skip data features. |
| `useState`-based view switching | "Routing" in scare quotes. Fine for demos; never ship. |

Install:

```bash
npm install react-router-dom
```

## The standard setup — `createBrowserRouter` at the root

```tsx
// App.tsx
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Layout } from "./components/Layout";
import { PostListPage } from "./pages/PostListPage";
import { PostDetailPage } from "./pages/PostDetailPage";
import { NotFoundPage } from "./pages/NotFoundPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true,         element: <PostListPage /> },
      { path: "posts/:id",   element: <PostDetailPage /> },
      { path: "*",           element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
```

Notes:
- **`index: true`** marks the route that renders at the parent's exact path (`/` here).
- **`errorElement`** catches errors thrown by loaders, actions, or render — including 404s if you throw `data(null, { status: 404 })` from a loader. It also catches React errors in the route subtree, replacing a separate `<ErrorBoundary>`.
- **`path: "*"`** is the 404 catch-all when not using `errorElement`.

## Nested routes + `<Outlet />` for shared layouts

The `Layout` component renders the chrome (header, footer, sidebar) and uses `<Outlet />` for the routed content:

```tsx
// components/Layout.tsx
import { Outlet, NavLink } from "react-router-dom";

export function Layout() {
  return (
    <div className="min-h-screen">
      <a href="#main" className="skip-link">Skip to main content</a>

      <header>
        <nav aria-label="Primary">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/posts">Posts</NavLink>
        </nav>
      </header>

      <main id="main">
        <Outlet />   {/* the matched child route renders here */}
      </main>

      <footer>…</footer>
    </div>
  );
}
```

The `<Outlet />` slot is the *only* part of the page that changes between routes. Headers and footers don't re-render on navigation.

## `NavLink` active states — built-in, accessible

`NavLink` automatically adds an `aria-current="page"` attribute when the link matches the current route, and exposes `isActive` for styling:

```tsx
<NavLink
  to="/posts"
  end                  // exact match; without this, /posts/34 also marks /posts active
  className={({ isActive }) =>
    isActive ? "text-fg-strong" : "text-fg hover:text-fg-strong"
  }
>
  Posts
</NavLink>
```

The `aria-current="page"` is what screen readers announce. Don't reinvent this with custom `isActive` logic — let `NavLink` do it.

## Dynamic params — `useParams`

```tsx
import { useParams } from "react-router-dom";

export function PostDetailPage() {
  const { id } = useParams<{ id: string }>();   // always string from the URL
  // ...
}
```

Type the params with a generic so TS doesn't widen them to `string | undefined`. **Params are always strings** — coerce with `Number(id)` or pass directly to your API layer (which usually accepts both).

For full type-safety across routes, use TanStack Router or wrap `useParams` in a per-route hook (`usePostParams()` that asserts `id` is present).

## Loaders vs. TanStack Query — the real decision

React Router's data router includes `loader` functions that run before a route renders. TanStack Query (covered in `react-api-consumer`) does the same job from inside components. Pick one:

| Use loaders when | Use Query when |
|---|---|
| You want data ready before the route paints | You want immediate render with loading states |
| Loaders compose well with SSR (Remix) | You need caching, retries, stale-while-revalidate |
| Single-source-of-truth for that page's data | Data is reused across multiple routes |
| You're already using Remix's full data model | You're already using Query |

**Most SPAs should use Query inside components**, not loaders. Reasons:
- Query handles caching, retries, background revalidation, optimistic updates — re-implementing that in loaders is a lot of code.
- Loaders block the route paint. Query renders the layout immediately and streams in data with a granular loading state — usually better UX.
- Migrating off loaders is painful; migrating off Query inside a component is local.

**The hybrid that works well**: use Query as the data layer, and use loaders only to *prefetch* (so the first render has cached data):

```ts
import { queryClient } from "./queryClient";
import { postQuery } from "./api/queries";

const router = createBrowserRouter([
  {
    path: "posts/:id",
    loader: ({ params }) =>
      queryClient.ensureQueryData(postQuery(params.id!)),
    element: <PostDetailPage />,
  },
]);
```

Inside `PostDetailPage`, just call `useQuery(postQuery(id))` — the cache is already warm, so it renders immediately. No `useLoaderData` needed.

## Scroll restoration

Browser default scroll behavior breaks on SPAs: navigate forward, scroll bottom, navigate back — and you land at the top, not where you were. Fix it once with React Router's `<ScrollRestoration />`:

```tsx
// In Layout (inside RouterProvider's tree)
import { ScrollRestoration } from "react-router-dom";

export function Layout() {
  return (
    <>
      <header>…</header>
      <main><Outlet /></main>
      <ScrollRestoration />
    </>
  );
}
```

That restores scroll positions on back/forward and scrolls to top on new pushes. Don't write your own.

For deep links to anchor (`#section`), this also handles scrolling into view. Test it.

## Focus management on route change

The single biggest a11y move for SPAs. After `<ScrollRestoration />` handles scroll, **move focus to the new page's heading** so screen reader users hear the new title:

```tsx
// Page-level component
function PostDetailPage() {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { data } = useQuery(postQuery(id));

  useEffect(() => {
    if (data && titleRef.current) titleRef.current.focus();
  }, [data]);

  return (
    <h1 ref={titleRef} tabIndex={-1} className="outline-none">
      {data?.title}
    </h1>
  );
}
```

Why `tabIndex={-1}`: makes the heading focusable without putting it in the tab order. See `react-a11y` for the full pattern.

## Programmatic navigation — `useNavigate`

```tsx
import { useNavigate } from "react-router-dom";

function LogoutButton() {
  const navigate = useNavigate();
  return (
    <button onClick={async () => {
      await logout();
      navigate("/login", { replace: true });  // replace = no back-button trap
    }}>
      Log out
    </button>
  );
}
```

`{ replace: true }` swaps the current history entry instead of pushing — use for redirects (login → home after auth, logout → login).

For `<a href>`-equivalent navigation, **use `<Link>` / `<NavLink>` instead of `useNavigate`**. Links are right-clickable, middle-clickable, keyboard-navigable for free. Reach for `useNavigate` only when the navigation is the *result* of an action (after a form submit, after logout).

## Search params — `useSearchParams`

For filters, sort, pagination — anything you want shareable via URL — use `useSearchParams`:

```tsx
import { useSearchParams } from "react-router-dom";

function PostListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1");
  const category = searchParams.get("category") ?? null;

  const setPage = (p: number) => {
    const next = new URLSearchParams(searchParams);
    if (p === 1) next.delete("page"); else next.set("page", String(p));
    setSearchParams(next);
  };
  // ...
}
```

This survives reload, is shareable, integrates with browser history. Don't store filter state in `useState` if it's worth a URL.

## Code splitting with `lazy()`

For larger apps, lazy-load route components so the initial bundle stays small:

```tsx
import { lazy, Suspense } from "react";
const PostDetailPage = lazy(() => import("./pages/PostDetailPage"));

const router = createBrowserRouter([
  {
    path: "posts/:id",
    element: (
      <Suspense fallback={<Spinner />}>
        <PostDetailPage />
      </Suspense>
    ),
  },
]);
```

Or use React Router's built-in `lazy` field (v6.4+) which avoids manual `<Suspense>`:

```tsx
{
  path: "posts/:id",
  lazy: async () => {
    const { PostDetailPage } = await import("./pages/PostDetailPage");
    return { Component: PostDetailPage };
  },
}
```

Lazy-loading isn't free — adds a network hop per first-visit-per-route. Worth it for routes that aren't on the hot path. Skip it for a 3-route app.

## 404s — two layers

**Static 404** (the URL matches no route):

```tsx
{ path: "*", element: <NotFoundPage /> }
```

**Data 404** (the route matches but the record doesn't exist — e.g. `/posts/99999`):

```tsx
// In your fetch wrapper or loader
if (res.status === 404) throw new Response("Not found", { status: 404 });

// Catch in errorElement:
import { useRouteError, isRouteErrorResponse } from "react-router-dom";

function ErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundPage />;
  }
  return <GenericErrorPage error={error} />;
}
```

Or — if you're using Query inside components, handle 404s in the component as it already does. See `react-api-consumer`'s status-aware error handling.

## What NOT to do

| Don't | Why |
|---|---|
| Use `<a href="/posts/34">` for internal links | Causes full page reload. Use `<Link>` / `<NavLink>`. |
| Manage active link state manually | `NavLink` does this with proper `aria-current`. |
| Use `useNavigate` where a `<Link>` would do | Loses right-click/middle-click/keyboard affordances. |
| Re-implement scroll restoration | `<ScrollRestoration />` already exists and works. |
| Put fetch calls in `useEffect` inside route components | Use Query (see `react-api-consumer`) or loaders. |
| Store filter state in `useState` when it should live in the URL | `useSearchParams` makes filters shareable + reload-safe. |
| Add routing when you have one screen | Premature complexity. |
| Lazy-load every route from day one | Per-route network hop. Profile before splitting. |
| Use `BrowserRouter` (legacy `<Routes>` JSX) for new projects | The data router (`createBrowserRouter`) is the current API. |

## Authoritative references

- React Router v7 docs: https://reactrouter.com/
- `createBrowserRouter`: https://reactrouter.com/en/main/routers/create-browser-router
- Data loading guide: https://reactrouter.com/en/main/start/tutorial
- `ScrollRestoration`: https://reactrouter.com/en/main/components/scroll-restoration
- `useSearchParams`: https://reactrouter.com/en/main/hooks/use-search-params
- TanStack Router (alt): https://tanstack.com/router/latest
- MDN History API (background): https://developer.mozilla.org/en-US/docs/Web/API/History_API
