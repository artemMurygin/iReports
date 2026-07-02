---
name: react-embeds
description: Provider-specific patterns for embedding third-party media in React — YouTube (incl. nocookie), SoundCloud (share URL vs. w.soundcloud.com player), Vimeo, Spotify, Bandcamp, Apple Podcasts, Twitter/X, Mastodon, Bluesky, CodePen, Figma, GitHub Gist. Each provider's iframable URL pattern, X-Frame-Options caveats, sandbox flags, aspect ratio, lazy loading, a11y (title attribute), responsive containers, and privacy-respecting variants (youtube-nocookie, dnt params). Use whenever rendering an iframe to a third-party platform — blog content, CMS embed URLs, social posts, media players. Triggers on "embed", "iframe", "YouTube", "SoundCloud", "Vimeo", "Spotify", "Bandcamp", "oEmbed", "X-Frame-Options", "player URL", "youtube-nocookie", "Twitter embed", "Mastodon", "CodePen", "Figma embed", "GitHub gist".
---

# react-embeds

Every CMS-fed React app eventually has to render `<iframe src={embed_url}>`. Half the time it works; half the time the host blocks framing or strips features. This skill maps each major provider to the URL shape that actually embeds, plus the iframe attributes that matter.

## The general pattern

```tsx
function Embed({ src, title, aspect = "video" }: EmbedProps) {
  return (
    <div
      className={
        aspect === "video"
          ? "aspect-video w-full overflow-hidden rounded-lg border border-border bg-black"
          : "w-full overflow-hidden rounded-lg border border-border"
      }
    >
      <iframe
        src={src}
        title={title}                    // a11y: REQUIRED, describes the embed
        loading="lazy"                   // perf: don't load until in viewport
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="h-full w-full border-0"
      />
    </div>
  );
}
```

**Always** include a `title`. Screen readers read it; without one, the embed announces as "frame" with no context.

**Always** `loading="lazy"`. Embeds are heavy and often below the fold.

**`allow=`** is provider-specific — see the table below.

## Provider matrix — what URL actually iframes

| Provider | What CMSes often store | What you must iframe | Aspect |
|---|---|---|---|
| YouTube | `https://youtube.com/watch?v=ID` or `https://youtu.be/ID` | `https://www.youtube-nocookie.com/embed/{ID}` | video |
| Vimeo | `https://vimeo.com/ID` | `https://player.vimeo.com/video/{ID}` | video |
| **SoundCloud** | `https://soundcloud.com/user/track` (share URL — **blocked from iframes**) | `https://w.soundcloud.com/player/?url={URL_ENCODED_SHARE}&color=...` | audio (160px) |
| Spotify | `https://open.spotify.com/track/ID` | `https://open.spotify.com/embed/track/{ID}` (also `/album/`, `/playlist/`, `/episode/`) | audio (152px) or square |
| Bandcamp | Album/track page URL | Bandcamp's site provides the full `<iframe>` HTML; no derivable transform — store `embed_html` | square |
| Apple Podcasts | `https://podcasts.apple.com/.../id{ID}` | `https://embed.podcasts.apple.com/.../id{ID}` | audio (175px) |
| Twitter/X | `https://twitter.com/user/status/ID` | No reliable cross-origin iframe — use `react-tweet` (static SSR) | n/a |
| Mastodon | Status URL | `{instance}/embed/{ID}` works on most instances | dynamic |
| Bluesky | Post URL | `https://embed.bsky.app/static/post.html?uri={AT_URI}` | dynamic |
| CodePen | `https://codepen.io/user/pen/ID` | `https://codepen.io/{user}/embed/{ID}?default-tab=result` | video-ish |
| Figma | Figma file URL | `https://www.figma.com/embed?embed_host=share&url={URL_ENCODED}` | video |
| GitHub Gist | `https://gist.github.com/user/ID` | Use a `<script>` tag, not iframe (Gist embed is JS-based) | dynamic |

### Key rule: never iframe a share URL

The most common bug, hit on KrateCMS: a CMS stores the user-friendly share URL (e.g. `https://soundcloud.com/user/track`) in `embed_url`. That URL serves an HTML page with `X-Frame-Options: sameorigin`, which blocks iframe embedding. The fix is **always provider-specific URL transformation**.

## YouTube

```tsx
function youtubeIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const match = u.pathname.match(/\/embed\/([^/?#]+)/);
    return match ? match[1] : null;
  } catch { return null; }
}

function YouTubeEmbed({ url, title }: { url: string; title: string }) {
  const id = youtubeIdFromUrl(url);
  if (!id) return null;
  return (
    <div className="aspect-video overflow-hidden rounded-lg bg-black">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="h-full w-full border-0"
      />
    </div>
  );
}
```

Why `youtube-nocookie.com`: same player, but doesn't set tracking cookies until the user interacts. Default for any privacy-respecting site. Drop-in replacement for `youtube.com/embed/`.

Useful query params on the embed URL:
- `?rel=0` — don't show related videos at end
- `?modestbranding=1` — minimize YouTube branding (limited effect)
- `?start={seconds}` — start at a timestamp
- `?cc_load_policy=1` — captions on by default

## SoundCloud

The biggest gotcha. SoundCloud's public share URL is **not iframable**. Use the player URL:

```ts
function soundcloudPlayerUrl(shareUrl: string): string {
  const params = new URLSearchParams({
    url: shareUrl,                      // the original share URL goes here, encoded
    color: "#aa3bff",                   // accent color (matches your brand)
    auto_play: "false",
    hide_related: "true",
    show_comments: "false",
    show_user: "true",
    show_reposts: "false",
    show_teaser: "false",
    visual: "false",                    // false = compact waveform; true = full art
  });
  return `https://w.soundcloud.com/player/?${params.toString()}`;
}
```

Iframe height matters:
- `visual: "false"` (waveform): 160px height
- `visual: "true"` (full art): 300–450px height (square-ish)

```tsx
<iframe
  src={soundcloudPlayerUrl(shareUrl)}
  title={`SoundCloud player for ${trackTitle}`}
  loading="lazy"
  allow="autoplay"
  className="block h-40 w-full border-0"
/>
```

**Detection** — when the CMS stores `embed_provider` separately:

```ts
const isSoundCloud =
  post.embed_provider?.toLowerCase() === "soundcloud" ||
  post.embed_url?.includes("soundcloud.com");
```

## Vimeo

```ts
function vimeoIdFromUrl(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match ? match[1] : null;
}
```

```tsx
<iframe
  src={`https://player.vimeo.com/video/${id}?dnt=1`}  // dnt=1 disables tracking
  title={title}
  loading="lazy"
  allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
  allowFullScreen
  className="h-full w-full border-0"
/>
```

`?dnt=1` (do-not-track) is Vimeo's privacy flag — disables analytics. Pair with no-cookie YouTube for a consistent privacy stance.

## Spotify

Spotify has multiple embed types (track / album / playlist / episode / show). The pattern is the same — insert `/embed` after the host:

```ts
function spotifyEmbedUrl(url: string): string | null {
  // https://open.spotify.com/track/ID  ->  https://open.spotify.com/embed/track/ID
  try {
    const u = new URL(url);
    if (u.hostname !== "open.spotify.com") return null;
    u.pathname = u.pathname.replace(/^\/(track|album|playlist|episode|show|artist)\//, "/embed/$1/");
    return u.toString();
  } catch { return null; }
}
```

Heights:
- Track: 80px (compact) or 152px (full)
- Album/playlist: 352px (compact) or 380–680px depending on content
- Podcast episode: 232px

```tsx
<iframe
  src={spotifyEmbedUrl(url)!}
  title={title}
  loading="lazy"
  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
  className="h-[152px] w-full rounded-lg border-0"
/>
```

## Twitter / X — don't iframe, use `react-tweet`

Twitter's `platform.twitter.com/widgets.js` script-based embeds are heavy, slow, and require third-party JS. The modern alternative is `react-tweet` (by Vercel) — SSR a static-rendered tweet that looks identical:

```bash
npm install react-tweet
```

```tsx
import { Tweet } from "react-tweet";

<Tweet id="1234567890" />
```

Zero third-party JS at runtime. Works in RSC. Pulls tweet data via API at render time. For Mastodon/Bluesky, the official embed iframes work fine (see matrix above).

## Unknown providers — fallback with a link

For providers you don't have a transform for, try the iframe but always provide an "Open in new tab" fallback in case the host blocks framing:

```tsx
<figure>
  <div className="overflow-hidden rounded-lg border border-border">
    <iframe
      src={embed_url}
      title={`${provider} content for ${title}`}
      loading="lazy"
      allow="autoplay; clipboard-write; encrypted-media"
      className="h-40 w-full border-0"
    />
  </div>
  <figcaption className="mt-2 text-xs text-fg">
    Can't see the embed?{" "}
    <a href={embed_url} target="_blank" rel="noopener noreferrer" className="underline">
      Open on {provider}
    </a>
    .
  </figcaption>
</figure>
```

## Responsive aspect ratios

Modern Tailwind has `aspect-video` (16:9) and `aspect-square`. For audio embeds (fixed pixel height), use a wrapper that lets the iframe overflow on small screens:

```tsx
// Video — 16:9 responsive
<div className="aspect-video w-full">
  <iframe className="h-full w-full" ... />
</div>

// Audio — fixed pixel height, full width
<iframe className="h-40 w-full" ... />

// Custom ratio — Tailwind v4 supports arbitrary aspect values
<div className="aspect-[4/5]"> ... </div>
```

## Sandbox flag — when to add it

`sandbox` is a security tightening for iframes from less-trusted sources:

```tsx
<iframe
  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
  ...
/>
```

Use it for:
- Unknown / dynamic embed URLs from user-submitted content
- CodePen-style code execution embeds

**Don't** use it for major media providers (YouTube, Vimeo, Spotify) — the player needs many permissions you'd have to enumerate anyway, and the providers' players are well-vetted.

## Performance — defer below-the-fold embeds

`loading="lazy"` is good. Even better for heavy embeds (multiple per page) — render a placeholder until the user scrolls or clicks:

```tsx
function YouTubeFacade({ id, title }: { id: string; title: string }) {
  const [load, setLoad] = useState(false);

  if (load) return <YouTubeEmbed url={`https://youtu.be/${id}`} title={title} />;

  return (
    <button
      type="button"
      onClick={() => setLoad(true)}
      className="relative aspect-video w-full overflow-hidden rounded-lg"
      aria-label={`Play ${title}`}
    >
      <img
        src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover"
      />
      <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
        <span className="rounded-full bg-black/70 px-4 py-3 text-white">▶</span>
      </span>
    </button>
  );
}
```

This pattern (the "facade") cuts initial bundle weight by ~500KB per YouTube embed. The trick: render an `<img>` with the thumbnail, swap in the real iframe on click. Lighthouse score loves it.

`@lite-youtube/lite-youtube` is the same idea as a web component.

## A11y checklist

- [ ] `title` attribute is present and describes the content
- [ ] Aspect ratio container prevents CLS
- [ ] If the embed is decorative, surround with `<figure>` + `<figcaption>` describing what it is
- [ ] If autoplay is enabled, audio is muted by default (provider param: YouTube `mute=1`, Vimeo `muted=1`)
- [ ] If the embed fails to load (X-Frame-Options blocked), a fallback link is shown
- [ ] Embed loads after critical content (lazy attribute, or facade pattern)

## What NOT to do

| Don't | Why |
|---|---|
| `<iframe src={post.embed_url}>` with no transformation | Half the providers' share URLs aren't iframable. |
| Render embeds eagerly above the fold | Embeds are heavy. Lazy-load or use a facade. |
| Skip `title` because "the embed has its own UI" | Screen readers can't see the embed UI. |
| Set `sandbox` on major providers | Their players need more permissions than you want to enumerate. |
| Inject Twitter's `widgets.js` | Use `react-tweet` instead. |
| Iframe Bandcamp by deriving the URL | Bandcamp's embed code is unique per release. Store the full `<iframe>` HTML (or `embed_html`) in the CMS. |
| Forget `referrerPolicy="strict-origin-when-cross-origin"` | Default leaks the full referring URL to the embed host. |

## Authoritative references

- HTML `iframe` element (MDN): https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe
- `iframe` sandbox attribute: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#sandbox
- YouTube IFrame Player API: https://developers.google.com/youtube/iframe_api_reference
- YouTube Player Parameters: https://developers.google.com/youtube/player_parameters
- Vimeo embed parameters: https://developer.vimeo.com/player/sdk/embed
- SoundCloud Widget API: https://developers.soundcloud.com/docs/api/html5-widget
- Spotify embed widgets: https://developer.spotify.com/documentation/embeds
- react-tweet: https://react-tweet.vercel.app/
- web.dev iframe perf: https://web.dev/articles/iframe-lazy-loading
