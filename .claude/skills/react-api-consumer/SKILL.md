---
name: react-api-consumer
description: Building a React frontend against an external REST API — TanStack Query setup, the standard fetch wrapper with typed errors, loading/error/empty/refetching states, paginated lists with keepPreviousData, optimistic updates, retry policy, query keys, Vite dev proxy for CORS, normalizing third-party API quirks (boxed values, inconsistent envelopes, missing filters), the "verify the response shape with curl before typing it" rule. Use whenever a React app talks to a remote API — public REST, internal microservice, headless CMS, third-party SaaS. Triggers on "API", "REST", "fetch", "TanStack Query", "react-query", "SWR", "CORS", "headless CMS", "data fetching", "loading state", "pagination", "optimistic update", "retry", "error boundary", "stale-while-revalidate", "endpoint".
---

# react-api-consumer

The spine of most React apps is "fetch data from an API and render it." Done badly, this becomes a tangle of `useEffect`, manual loading flags, and silent error swallowing. Done well, it's a thin client + TanStack Query + four UI states + a couple of dev-time workarounds. This skill is the second pattern.

## The opening move (always)

Before typing a single component, do this three-step recon:

1. **Hit the endpoint with curl.** Not WebFetch summaries — curl. You need the literal shape, including quirks the AI summarizer will smooth over.
2. **Check CORS.** A preflight + Origin header tells you whether the browser can call the API directly or whether you need a Vite proxy.
3. **Decide: client-side or server-side filtering.** If the dataset is small (< ~200 records on first page) and filters are simple, client-side is fine. If pagination must work with the filter, you need server-side.

### Verify the shape — never trust a summary

```bash
# Top-level keys, sample record, pagination meta
curl -s https://api.example.com/v1/posts | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('top-level keys:', list(d.keys()))
print('first item keys:', list(d['data'][0].keys()) if d.get('data') else 'no data array')
print('meta:', json.dumps(d.get('meta'), indent=2)[:400])
"
```

Why this matters: AI summaries paraphrase. A real KrateCMS endpoint returned `meta.current_page` as `[1, 1]` (a Laravel resource bug) but the summary reported it as `1` — leading to a broken type definition that "worked" until production. **Look at the bytes.**

### Verify CORS preflight

```bash
curl -sv \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -X OPTIONS \
  https://api.example.com/v1/posts 2>&1 \
  | grep -iE '^< '
```

What you want to see:
- `Access-Control-Allow-Origin: http://localhost:5173` (or `*`)
- `Access-Control-Allow-Methods: GET, ...`

What you might see instead:
- `HTTP/2 204` with no `Access-Control-Allow-*` headers → CORS is **not** configured. Use a Vite proxy (below).

---

## The standard stack

For a typical SPA-against-REST build, install:

```bash
npm install @tanstack/react-query
```

That's it. Don't reach for:
- **Redux/Zustand for server state.** Server state is what Query is built for — never let it bleed into a global store.
- **SWR.** Functionally similar; pick Query unless the codebase already uses SWR. Larger ecosystem, better devtools.
- **Manual `useEffect` + `useState`.** This is the pattern Query exists to replace. You will reinvent caching, deduplication, and retry, badly.

Optional adds, only when actually needed:
- `axios` — only if you need interceptors, upload progress, or browser/Node sharing. Plain `fetch` is fine for most cases.
- `ofetch` / `ky` — nicer DX than `fetch`; worth it on bigger projects.
- `zod` — runtime-validate API responses if the API is flaky or you don't control it.

---

## The four-file API layer

Every API consumer should have these four files in `src/api/`. Don't sprinkle fetch calls through components.

```
src/api/
  types.ts        // Response shapes + helper types
  client.ts       // The fetch wrapper + typed endpoints
  queries.ts      // queryOptions for each endpoint
  index.ts        // Re-exports (optional)
```

### `types.ts` — declare both raw and normalized shapes when the API is buggy

```ts
// Some APIs return values in weird containers. Declare both shapes:
// the raw response (matches the wire), and the normalized shape your
// components consume.

type MaybeBoxed<T> = T | [T, T];

export interface RawPaginationMeta {
  current_page: MaybeBoxed<number>;
  last_page:    MaybeBoxed<number>;
  per_page:     MaybeBoxed<number>;
  total:        MaybeBoxed<number>;
  from: number | null;
  to:   number | null;
}

export interface PaginationMeta {
  current_page: number;
  last_page:    number;
  per_page:     number;
  total:        number;
  from: number | null;
  to:   number | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
  links: { self: string; first: string | null; last: string | null; prev: string | null; next: string | null };
}
```

Keeping both shapes documents the bug ("the API returns these boxed; we unbox in the client") for future readers, and the moment the API is fixed you delete the raw types and the unbox helper.

### `client.ts` — fetch wrapper with a typed error

```ts
const API_BASE = "/api/v1";  // proxied in dev, real in prod

export class ApiError extends Error {
  readonly status: number;
  readonly url: string;
  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.url = url;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    throw new ApiError(`Request to ${url} failed with ${res.status}`, res.status, url);
  }
  return res.json() as Promise<T>;
}

// Normalizer for the boxed-value API bug
function unbox(v: number | [number, number]): number {
  return Array.isArray(v) ? v[0] : v;
}

function normalizeMeta(m: RawPaginationMeta): PaginationMeta {
  return {
    current_page: unbox(m.current_page),
    last_page:    unbox(m.last_page),
    per_page:     unbox(m.per_page),
    total:        unbox(m.total),
    from: m.from,
    to:   m.to,
  };
}

// Endpoints — one function per route
export async function listPosts(params: { page?: number } = {}): Promise<PaginatedResponse<Post>> {
  const query = new URLSearchParams();
  if (params.page && params.page > 1) query.set("page", String(params.page));
  const qs = query.toString();
  const raw = await request<RawPaginatedResponse<Post>>(`/posts${qs ? `?${qs}` : ""}`);
  return { ...raw, meta: normalizeMeta(raw.meta) };
}

export async function getPostById(id: number | string): Promise<Post> {
  const res = await request<{ data: Post }>(`/posts/${id}`);
  return res.data;
}
```

Note: use the **class** form for `ApiError`, with explicit field declarations — `readonly` constructor parameters fail under Vite's `erasableSyntaxOnly` tsconfig (see `react-bootstrap` skill's gotcha section).

### `queries.ts` — `queryOptions` for every endpoint

`queryOptions` is the TanStack Query way to keep query keys and fetchers together — co-located, typed, and easy to call from both `useQuery` and `queryClient.prefetchQuery`.

```ts
import { queryOptions } from "@tanstack/react-query";
import { listPosts, getPostById } from "./client";

export const postsQuery = (params: { page?: number } = {}) =>
  queryOptions({
    queryKey: ["posts", params],
    queryFn: () => listPosts(params),
    staleTime: 60_000,
  });

export const postQuery = (id: number | string) =>
  queryOptions({
    queryKey: ["post", String(id)],
    queryFn: () => getPostById(id),
    staleTime: 60_000,
  });
```

Components then call:

```tsx
const { data } = useQuery(postQuery(id));
```

Or prefetch from a router loader:

```ts
loader: ({ params }) => queryClient.prefetchQuery(postQuery(params.id))
```

### QueryClient at the root

```tsx
// App.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,                    // 1 retry, not 3 (default). Faster failure visibility.
      refetchOnWindowFocus: false, // Turn off for content-heavy apps; on for dashboards/inboxes.
      staleTime: 30_000,           // 30s before background refetch; tune per-app.
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
```

---

## The four UI states (every fetching component renders all of them)

A `useQuery` call has more states than `loading vs. data`. The senior move is handling all four:

```tsx
const { data, isLoading, isError, error, isFetching, refetch } = useQuery(postsQuery({ page }));

if (isLoading) return <Spinner label="Loading posts" />;
if (isError)   return <ErrorState message={...} onRetry={() => refetch()} />;
if (!data || data.data.length === 0) return <EmptyState />;

return (
  <>
    {isFetching && <RefetchIndicator />}  {/* background refresh */}
    <PostList posts={data.data} />
  </>
);
```

| State | Distinct from | Right UI |
|---|---|---|
| `isLoading` | No cache yet, first fetch in flight | Full spinner / skeleton |
| `isFetching && data` | Background revalidation while data is showing | Subtle indicator ("Refreshing…"), don't wipe the UI |
| `isError` | A request failed | Error banner + retry. Suppress retry for 4xx that won't fix on retry (404, 403). |
| `data?.length === 0` | Request succeeded, no records | Empty state with a hint ("Try a different filter") |

### Status-aware error handling

Different errors need different UX:

```tsx
if (isError) {
  const status = error instanceof ApiError ? error.status : undefined;
  return (
    <ErrorState
      title={
        status === 404 ? "Not found"
        : status === 403 ? "You don't have access"
        : "Something went wrong"
      }
      message={error instanceof Error ? error.message : "Unknown error."}
      // Suppress retry for 404/403 — retrying won't help
      onRetry={status && status < 500 && status !== 408 ? undefined : () => refetch()}
    />
  );
}
```

---

## Pagination — `keepPreviousData` is the trick

Without `keepPreviousData`, clicking "page 2" flashes the spinner full-screen for a moment before page 2 renders. Jarring. Fix:

```tsx
import { useQuery, keepPreviousData } from "@tanstack/react-query";

const { data, isFetching } = useQuery({
  ...postsQuery({ page }),
  placeholderData: keepPreviousData,  // show page 1 while page 2 is loading
});
```

Now the previous page stays on screen until the new one arrives. Pair with an `isFetching` indicator so the user knows a refresh is in flight.

**For infinite scroll**, use `useInfiniteQuery` instead. Outside the scope of this skill.

---

## Optimistic updates (when writes are in scope)

For mutations where the success rate is high (favoriting, marking read, voting), update the cache before the server responds, and roll back on error:

```tsx
const queryClient = useQueryClient();

const favoriteMutation = useMutation({
  mutationFn: (postId: number) => favoritePost(postId),

  onMutate: async (postId) => {
    // Cancel any outgoing refetches so they don't overwrite our optimistic update
    await queryClient.cancelQueries({ queryKey: ["posts"] });

    // Snapshot for rollback
    const previous = queryClient.getQueryData<PaginatedResponse<Post>>(["posts"]);

    // Optimistically update
    queryClient.setQueryData<PaginatedResponse<Post>>(["posts"], (old) =>
      old ? { ...old, data: old.data.map(p => p.id === postId ? { ...p, favorited: true } : p) } : old
    );

    return { previous };
  },

  onError: (_err, _vars, ctx) => {
    if (ctx?.previous) queryClient.setQueryData(["posts"], ctx.previous);
  },

  onSettled: () => {
    // Sync with server in either case
    queryClient.invalidateQueries({ queryKey: ["posts"] });
  },
});
```

React 19's `useOptimistic` covers the simple cases; TanStack Query's mutation cache is better when the optimistic state has to survive across components.

---

## CORS in development — Vite proxy

When the API has no CORS configured and you can't (or won't) change the backend, proxy through Vite. The browser sees same-origin requests.

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://api.example.com',
        changeOrigin: true,
        secure: false,  // self-signed dev certs (DDEV, mkcert) — drop in prod
      },
    },
  },
});
```

Then in `client.ts`:

```ts
const API_BASE = '/api/v1';   // dev: proxied. Prod: configure separately.
```

**For production**, you need real CORS. The proxy is a dev convenience, not a deployment strategy. If the API can't add CORS, you'll need a same-origin reverse proxy (Cloudflare Worker, Vercel/Netlify rewrite, Nginx).

---

## Client-side vs. server-side filtering

A constant decision: do you filter the data in the browser or push the filter to the API?

| Server-side filter | Client-side filter |
|---|---|
| Dataset > ~200 records | Dataset < ~200 records on first page |
| Filter must compose with pagination | Filter only changes what's visible from a single fetched page |
| Multiple filter dimensions (search + facets) | Single filter dimension (category chips) |
| Data changes frequently | Data stable for the session |

**Important**: if the API silently ignores filter params (a real bug in some Laravel-style APIs), you'll see the unfiltered response. Always verify with curl:

```bash
# Compare totals — if same, the filter is ignored
curl -s 'https://api.example.com/posts' | jq '.data | length'
curl -s 'https://api.example.com/posts?category=audio' | jq '.data | length'
```

If the filter is ignored and the dataset is small, do it client-side and **file an issue against the API**. Don't ship a "feature" that's a workaround for a server bug without flagging it.

---

## Query key conventions

Keys are arrays. The hierarchy from least-specific to most-specific lets you invalidate widely or narrowly:

```ts
// Good — hierarchical
["posts"]                       // invalidate all posts queries
["posts", "list"]               // invalidate all list variants
["posts", "list", { page: 2 }]  // a specific list page
["posts", "detail", id]         // a single post by id

// Bad — strings, can't be partial-matched
"posts-list-2"
"post:34"
```

`queryClient.invalidateQueries({ queryKey: ["posts"] })` invalidates the entire posts tree. `["posts", "detail", id]` invalidates only the one record.

---

## Suspense + `use()` — when (and when not) to reach for it

React 19's `use(promise)` lets you read a promise inside a component, with `<Suspense>` for loading and an Error Boundary for errors. It's elegant in isolation.

**Use it when:**
- You're rendering on the server (RSC) and want streaming
- The app is small and you genuinely don't need caching, retries, or background refetch
- You're already deep in Suspense for code splitting

**Don't use it when:**
- You need any of: caching, retries, `keepPreviousData`, mutations, devtools, optimistic updates, query invalidation
- You're consuming a third-party REST API in an SPA (i.e. the case this skill is for)

For SPAs against external APIs, **TanStack Query is the senior choice**. `use()` is younger, less battle-tested, and reinventing what Query already gives you is exactly the kind of decision a code reviewer will flag.

---

## What NOT to do

| Don't | Why |
|---|---|
| `useEffect` + `useState` + `setLoading(true)` | Reinventing Query badly. No caching, no dedup, no retry. |
| `axios` + `useEffect` everywhere | Same problem with a heavier dep. |
| Pull server data into Redux/Zustand | Cache invalidation, deduplication, stale-while-revalidate — all things Query solves. |
| Trust an LLM's summary of an API response | Read the bytes. We've been bitten by `[1, 1]` vs. `1`. |
| Hardcode `fetch('https://...')` in components | Components shouldn't know your API host. The four-file layer hides it. |
| Catch `error` and `console.log` | You just hid a bug. Throw so the Error Boundary / Query handles it. |
| Add a global "loading…" overlay for every fetch | Granular per-query state is almost always better UX. |
| `refetchOnWindowFocus: true` on a content site | Refetches on every tab return — annoying. Default on for dashboards, off for content. |

---

## Authoritative references

- TanStack Query docs: https://tanstack.com/query/latest/docs/framework/react/overview
- Query keys: https://tanstack.com/query/latest/docs/framework/react/guides/query-keys
- `queryOptions`: https://tanstack.com/query/latest/docs/framework/react/guides/query-options
- Optimistic updates: https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates
- Mutation invalidation: https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations
- Vite proxy config: https://vite.dev/config/server-options.html#server-proxy
- MDN Fetch: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
- MDN CORS: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
