# Optimizing Assets

**The bottleneck in one sentence:** AI coding tools drop videos, PDFs and images straight into public/ and point at them directly, so every visitor downloads multi-megabyte files from your app's own server with no compression, no CDN, and often the wrong cache policy.

## What it looks like

A typical AI-built marketing site or portfolio ends up with something like this:

```
public/
├── about-hero-video.mp4        # 12 MB, autoplays on page load
├── brochure-2026.pdf           # 8.1 MB
├── prospectus.pdf              # 8.4 MB
├── team-photo.jpg              # 3.2 MB, straight off a phone camera
└── logo.png                    # 400 KB (should be an SVG)
```

Referenced like this:

```tsx
// AboutPage.tsx
<video autoPlay loop muted playsInline src="/about-hero-video.mp4" />
```

Nothing has been compressed and there's no poster image. The browser starts pulling 12 MB the moment the page mounts, from the same server that's also sending your JavaScript and answering your API calls.

The caching config is usually one blanket rule for everything:

```json
// vercel.json (the bad version)
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

That one rule hides two separate problems: the files are too big to begin with, and once they're cached, they're cached wrong.

## Why AI tools generate this

Dropping a file in public/ and pointing an img, video or link at it is the simplest thing that works on localhost. It builds, it renders, the demo looks great. AI assistants aim for "the page loads and shows the video". File size, the visitor's bandwidth and how production caches the file never come up unless you ask.

The cache-header bug makes it worse. Cache-Control: immutable is a good pattern, but only for build output that gets a new filename whenever its content changes, like the assets/index-a1b2c3.js files Vite produces. Assistants copy an "immutable caching" snippet from a best-practice example without noticing that it also matches /about-hero-video.mp4, a filename that stays the same when you swap the file. Spotting that means understanding how your bundler names files, not just reading the file in front of you, and that kind of cross-cutting reasoning is exactly what gets skipped.

## What it costs

- **Core Web Vitals.** A 12 MB video at the top of the page drags down Largest Contentful Paint and competes with your JavaScript for bandwidth, which delays the moment the page responds on slower connections.
- **Your visitors pay for it in data.** Anyone on mobile data pays for that video and those PDFs out of their own allowance, and in much of the world prepaid data is expensive. At real traffic it's also bandwidth you pay for, unless the files sit on a CDN with cheap or free egress.
- **People leave before the page paints.** On slow 3G/4G or weak hotel wifi, plenty of visitors give up before a multi-megabyte hero finishes loading. They never see the page at all.
- **The caching bug is wrong, not just slow.** Replace about-hero-video.mp4 with a new cut and anyone whose browser cached the old one as immutable keeps seeing the old file at that URL for up to a year, however often they refresh. That's a correctness bug that happens to live in your headers config.

## A representative before and after

Illustrative numbers for the About page above, not one specific audited project:

| What loads | Before | After |
| --- | --- | --- |
| Hero video | 12 MB, downloading from the first moment | ~60 KB poster first; a ~1.5 MB video after the page has loaded, and none on Save-Data |
| Team photo | 3.2 MB JPEG straight off a phone | ~180 KB WebP at 1600px wide |
| Logo | 400 KB PNG | ~4 KB SVG |
| PDFs (only when clicked) | 16.5 MB from your app's server | ~3-4 MB, compressed, from a CDN |
| Downloaded before the page finishes loading | ~15.6 MB | ~250 KB |

## How to measure it in your app

```bash
# 1. Anything over 500 KB in your static folder
#    (public/ in Vite and Next.js, static/ in SvelteKit)
find public -size +500k -exec ls -lh {} \;

# 2. Total size of the folder: megabytes, or hundreds of them?
du -sh public

# 3. The Cache-Control header production actually sends.
#    Use your real domain, one unhashed file and one hashed one
#    (copy a hashed filename from the DevTools Network tab).
curl -sI https://your-site.com/about-hero-video.mp4 | grep -i cache-control
curl -sI https://your-site.com/assets/index-a1b2c3.js | grep -i cache-control
# The first should NOT say immutable with a year-long max-age.
# The second should: it's a hashed file, safe to cache for good.
```

Then in Chrome DevTools:

- **Network tab:** tick Disable cache, reload, and sort by Size. Anything in the multi-megabyte range on a page that isn't a video product is a candidate. Set throttling to Slow 4G to feel what a mobile visitor feels.
- **Lighthouse** (the DevTools Lighthouse panel, or npx unlighthouse --site https://your-site.com for the whole site): look at "Improve image delivery" (older versions split it into "Properly size images", "Efficiently encode images" and "Serve images in next-gen formats"), "Use efficient cache lifetimes" and "Avoid enormous network payloads". They name the exact files.
- **The Coverage tab won't help here.** It measures JavaScript and CSS, which is the Ship Less JavaScript guide's territory.

## The fix

### 1. Compress before anything reaches public/

```bash
# Video: re-encode at a web bitrate and size (ffmpeg).
# -an strips the audio track, right for a muted background video;
# leave it out if the video has sound.
ffmpeg -i about-hero-video.mp4 -vcodec libx264 -crf 28 -preset slow \
  -vf "scale=1280:-2" -movflags +faststart -an about-hero-video-web.mp4
# A 12 MB source often comes out at 1-2 MB with no visible loss at web sizes.

# PDFs: compress with Ghostscript
gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook \
  -dNOPAUSE -dQUIET -dBATCH -sOutputFile=brochure-compressed.pdf brochure-2026.pdf

# Images: resize and convert to WebP (cwebp: brew install webp, apt install webp)
cwebp -q 80 -resize 1600 0 team-photo.jpg -o team-photo.webp
```

Logos and icons should be SVG: a few kilobytes, sharp at any size. An image CDN (Cloudinary, imgix, Cloudflare Images, or next/image on Next.js) can do the resizing and format conversion for you on the fly.

### 2. Don't let the hero video hold up the page

The usual advice is to add preload="none", but that does nothing on a video with autoPlay: the browser has to download a video to autoplay it, so autoplay wins. Instead, show a poster image first and only attach the video once the page has loaded. Skip the video entirely for visitors who have asked for less data or less motion.

```tsx
// HeroVideo.tsx: poster first, video after load, none on Save-Data or reduced motion
import { useEffect, useState } from 'react';

export function HeroVideo() {
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (connection?.saveData || reducedMotion) return; // the poster is the whole experience

    const start = () => setShowVideo(true);
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    return () => window.removeEventListener('load', start);
  }, []);

  return showVideo ? (
    <video autoPlay loop muted playsInline poster="/about-hero-poster.webp" src="/about-hero-video-web.mp4" />
  ) : (
    <img src="/about-hero-poster.webp" alt="" width={1280} height={720} />
  );
}
```

For a video further down the page that people choose to play, drop autoPlay and add controls: there, preload="none" is honoured and nothing downloads until someone presses play. For purely decorative motion, ask whether a short WebM loop, a CSS animation or a still image would do the same job.

### 3. Size images properly and lazy-load the ones below the fold

```html
<img src="/team-photo.webp" alt="The team at work"
     width="1600" height="1067" loading="lazy" decoding="async" />
```

The width and height stop the layout jumping as the image arrives. loading="lazy" means images further down only download when someone scrolls near them. Never lazy-load the main image at the top of the page, since that delays Largest Contentful Paint.

In Vite, import images from src/ instead of putting them in public/: import teamPhoto from './assets/team-photo.webp' builds to a hashed name like /assets/team-photo-3f9a1c.webp, which is safe to cache forever.

### 4. Get large media off your app's server

Big files served from your app's own origin compete with your JavaScript and API traffic, and usually aren't behind a proper CDN edge cache. Move them to object storage with a CDN in front:

- **PDFs and downloads:** Cloudflare R2, AWS S3 with CloudFront, or Supabase Storage if you're already on Supabase (public buckets are served through its CDN).
- **Video:** Cloudinary, Mux or Cloudflare Stream. They transcode for you and serve adaptive bitrates, so a visitor on a slow connection gets a smaller stream. For a marketing video, a YouTube or Vimeo embed behind a click-to-load facade (lite-youtube-embed) keeps the heavy player off the page until someone presses play.
- Link to the CDN URL directly (https://cdn.example.com/brochure.pdf) instead of /brochure.pdf.

### 5. Fix the cache headers: immutable only on hashed build output

```json
// vercel.json (the correct version)
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(.*)\\.(mp4|webm|pdf|jpg|jpeg|png|webp|avif)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=86400, must-revalidate" }
      ]
    }
  ]
}
```

With no headers rule at all, Vercel already serves files from public/ with max-age=0, must-revalidate, which is safe. The bug comes from adding a blanket rule like the bad version above.

Next.js sets the immutable header on its own hashed output in /_next/static and won't let you override it, and it serves public/ files with max-age=0 by default. Never add an immutable rule for /:path*. If you want unhashed media cached for a day:

```ts
// next.config.ts
async headers() {
  return [
    {
      // Unhashed files in public/: cache for a day, then check for a new version
      source: '/:all*(mp4|webm|pdf|jpg|jpeg|png|webp|avif)',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, must-revalidate' }],
    },
  ];
},
```

The rule: **immutable is only safe on a URL whose content can never change without the URL changing too**, which in practice means filename-hashed build output. Everything else (unhashed media in public/, PDFs, uploaded images) gets a short max-age with must-revalidate, so a swapped file is picked up within a day, not a year. When you replace an important file, give it a new name as well (brochure-2026-10.pdf) so nobody can be served the old one.

## Checklist

**Audit**
- find public -size +500k comes back empty, or every hit is justified
- The whole static folder is in the low tens of MB, not hundreds
- curl -I on a real unhashed file in production shows no immutable header

**Fix**
- Videos, PDFs and images are compressed, and images are WebP or AVIF at sensible dimensions
- Logos and icons are SVG
- The hero video shows a poster first and loads after the page, never on Save-Data
- Images below the fold have width, height and loading="lazy"; the top image doesn't
- Large media and downloads come from object storage plus a CDN, not the app's server
- Cache-Control: immutable appears only on content-hashed build paths

**Verify**
- Lighthouse no longer flags image delivery, cache lifetimes or enormous payloads
- The Network tab on Slow 4G shows the page usable before any large file downloads
- Re-check whenever someone adds media, since every new file dropped in public/ starts the problem again

## Prompt your AI assistant

```
Audit this repo for oversized, uncompressed, or mis-cached static assets.

1. List every file in the static folder (public/ for Vite and Next.js,
   static/ for SvelteKit) larger than 500KB. For each one, say what it
   is (video, PDF, or image) and where it's referenced.

2. For every <video> and <img> referencing one of those files, check:
   - autoplaying videos: is there a poster, and does the video start
     downloading on page load? (preload="none" does not stop an autoPlay
     video from downloading, so don't propose it as the fix)
   - images: legacy format (JPEG/PNG instead of WebP/AVIF), no width
     and height, no loading="lazy" below the fold, or lazy loading on
     the main image at the top of the page.

3. Find the cache-headers configuration (vercel.json "headers",
   next.config.ts headers(), netlify.toml, or equivalent). Tell me
   whether a long-lived "immutable" Cache-Control policy applies to any
   UNHASHED path, meaning a file whose name doesn't change when its
   content changes (anything in public/ referenced by a literal
   filename). That's a correctness bug: immutable caching must be
   scoped to the hashed build-output directory only (assets/,
   _next/static/, etc).

4. Propose a fix for each issue: the compression command, a poster-first
   loading pattern for autoplaying video, image attributes to add, which
   large files should move to object storage plus a CDN, and a corrected
   headers config with hashed and unhashed paths in separate rules.
   Don't apply anything yet. List the findings and the proposed diffs
   first.
```
