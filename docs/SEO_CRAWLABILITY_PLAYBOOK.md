# SEO Crawlability Playbook: Fix Client-Rendered SPAs for Google

**Purpose:** A self-contained task list for a single Claude Code session to diagnose and fix the
"empty shell" crawlability problem in a client-rendered React SPA. Run **one project per session** so
context stays focused. The reference implementation is inlined below. Copy it into the project you
are fixing; you do not need any other file to complete this playbook.

**The core problem:** A pure client-side-rendered (CSR) React + Vite SPA serves an empty
`<div id="root"></div>` shell for *every* URL. All content and per-route meta tags (`<title>`,
description, canonical, Open Graph, JSON-LD) are injected by JavaScript *after* load. Google can
render JS in a deferred second wave, but:
- Indexing is slower and less reliable; failed renders get indexed as the generic shell → duplicate
  titles/snippets across pages.
- Non-JS crawlers (Bing is weak; social/link-preview bots such as WhatsApp, LinkedIn, Facebook, X, and
  Slack run **no** JS) see only the generic shell, so every shared link shows the same title/description/image.

**Next.js projects are usually fine** (they SSR/SSG by default). For those, this is a *hygiene check*,
not a rebuild. See the Next.js branch below.

**Approach:** This playbook inlines a proven build-time prerendering mechanism (Vite +
react-helmet-async). Replicate it: do **not** invent a new mechanism.

---

## How to use this file

1. Note whether the project is **Vite** or **Next.js** (check `package.json` /
   `vite.config.*` vs `next.config.*`).
2. Work through **Phase 0 (Diagnose)**. If the project already serves real per-route HTML, mark it
   DONE and stop: no work needed.
3. If it has the empty-shell problem, follow the **Vite branch** or **Next.js branch**.
4. Finish with **Phase 3 (Verify)**: evidence before claiming done.

---

## Phase 0: Diagnose

Run these checks. They take ~2 minutes and tell you definitively whether the project has the problem.

```bash
# Replace with the project's live URL. Use a course/inner page, not just the homepage.
SITE="https://www.example.com"
INNER="$SITE/some-inner-page"

# 1. What does Googlebot get on FIRST fetch (pre-JS)?
curl -s -A "Googlebot/2.1 (+http://www.google.com/bot.html)" "$SITE"  > /tmp/home.html
curl -s -A "Googlebot/2.1 (+http://www.google.com/bot.html)" "$INNER" > /tmp/inner.html

# 2. Is the root div empty? (empty == problem)
grep -o '<div id="root">[^<]*</div>' /tmp/home.html

# 3. Do two different routes return IDENTICAL html? (identical == problem)
[ "$(md5 -q /tmp/home.html)" = "$(md5 -q /tmp/inner.html)" ] \
  && echo "IDENTICAL SHELL — needs prerendering" || echo "Distinct HTML — likely OK"

# 4. Compare titles across routes (same generic title == problem)
grep -o '<title>[^<]*</title>' /tmp/home.html /tmp/inner.html

# 5. Visible word count in raw HTML (tiny == problem)
for f in /tmp/home.html /tmp/inner.html; do
  echo "$f: $(sed 's/<[^>]*>//g' "$f" | tr -s ' \n' ' ' | wc -w) words"; done

# 6. Is there already a prerender/SSG step?
grep -iE 'prerender|react-snap|vite-react-ssg|vike|vite-plugin-ssr|renderToString' \
  package.json client/package.json 2>/dev/null
```

**Verdict:**
- Empty `<div id="root">` **and** identical HTML across routes **and** same generic `<title>` →
  **HAS THE PROBLEM**. Proceed to the relevant branch.
- Distinct per-route HTML with real content/titles → already fixed (or it's Next.js SSR). Mark DONE.

Also note the current SEO hygiene (covered in Phase 2): `public/robots.txt`, `public/sitemap.xml`,
`public/llms.txt`, and a per-route SEO component (react-helmet-async or Next metadata).

---

## Phase 1A: Vite branch (add build-time prerendering)

Goal: after `vite build`, render every public route to `dist/<route>/index.html` with real content +
correct head tags baked in. Replicate the reference implementation inlined below.

### The reference implementation

Four small files plus one build-script change. Genericise the placeholders (provider stack, route
list, dynamic-data fetch) to match the project.

**`src/prerender/routes.tsx`**: the route manifest and single source of truth. Use **eager** imports
(NOT `React.lazy`, since `renderToString` cannot resolve Suspense synchronously). Share `staticRoutes.json`
with the sitemap generator so the two cannot drift. Exclude private/no-index routes (admin, account,
booking, auth) to match `robots.txt`.

```tsx
// src/prerender/routes.tsx
import React from 'react';
// Eager imports of public page components (NOT React.lazy).
import { LandingPage } from '../pages/LandingPage';
import { AboutPage } from '../pages/AboutPage';
import { CoursePage } from '../pages/CoursePage';
import staticRoutes from './staticRoutes.json'; // shared with the sitemap generator

export interface PrerenderRoute {
  /** Route path. ':slug' marks a dynamic template expanded by the build script. */
  path: string;
  Component: React.ComponentType<any>;
  /** Props passed to Component during SSR (e.g. a slug). */
  props?: Record<string, unknown>;
  /**
   * Optional build-time data fetch. For a dynamic template (e.g. '/courses/:slug'),
   * return an array of { slug, preloaded } so the script expands one file per item.
   */
  getData?: () => Promise<Array<{ slug: string; preloaded?: Record<string, unknown> }>>;
}

// Map each static path from staticRoutes.json to its component.
const COMPONENT_BY_PATH: Record<string, React.ComponentType<any>> = {
  '/': LandingPage,
  '/about': AboutPage,
};

const staticPrerenderRoutes: PrerenderRoute[] = (staticRoutes as Array<{ path: string }>).map((r) => ({
  path: r.path,
  Component: COMPONENT_BY_PATH[r.path],
}));

// Dynamic template: fetch the list of items so the script can write one file per item.
// Give the fetch a timeout so a slow/unreachable API can never hang the build.
async function getCourses(): Promise<Array<{ slug: string; preloaded: Record<string, unknown> }>> {
  const res = await fetch('https://api.yoursite.com/courses', {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`courses API ${res.status}`);
  const items = await res.json();
  return items.map((c: any) => ({ slug: c.slug, preloaded: { course: c } }));
}

export const prerenderRoutes: PrerenderRoute[] = [
  ...staticPrerenderRoutes,
  { path: '/courses/:slug', Component: CoursePage, getData: getCourses },
];
```

**`src/prerender/render.tsx`**: `renderRoute()` (renderToString + helmet) and the pure
`injectIntoTemplate()`. The `canUseDOM = false` flip is what forces react-helmet-async into SSR mode
so head tags land in `helmetContext` instead of a (non-existent) `document.head`.

```tsx
// src/prerender/render.tsx
import React from 'react';
import { renderToString } from 'react-dom/server';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Add whatever providers your PUBLIC chrome needs (Theme, Auth, etc.). Every provider's
// network/localStorage access must live in useEffect/callbacks so it never runs during SSR.
import { ThemeProvider } from '../lib/theme';
import { AuthProvider } from '../lib/auth';

export interface RenderInput {
  path: string;                              // concrete URL, e.g. '/courses/intro'
  Component: React.ComponentType<any>;
  props?: Record<string, unknown>;
  preloaded?: Record<string, unknown>;       // server-side data injected as window.__PRELOADED__
  routePattern?: string;                     // React Router pattern, e.g. '/courses/:slug'
}

export interface RenderOutput { bodyHtml: string; headHtml: string; }

export async function renderRoute(input: RenderInput): Promise<RenderOutput> {
  const routePattern = input.routePattern ?? input.path;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const helmetContext: { helmet?: any } = {};

  // Force THIS HelmetProvider into SSR mode so it writes to helmetContext rather than
  // mutating document.head (which is undefined / jsdom during a Node render). Restore after.
  const prevCanUseDOM = (HelmetProvider as any).canUseDOM;
  (HelmetProvider as any).canUseDOM = false;

  // react-router's <Link> uses useLayoutEffect, which warns on the server. Across dozens of
  // routes this floods the build log; filter just this one known-harmless message.
  const prevConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const first = typeof args[0] === 'string' ? args[0] : '';
    if (first.includes('useLayoutEffect does nothing on the server')) return;
    prevConsoleError(...(args as []));
  };

  try {
    const bodyHtml = renderToString(
      <HelmetProvider context={helmetContext}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <MemoryRouter initialEntries={[input.path]}>
                <Routes>
                  <Route path={routePattern} element={<input.Component {...(input.props ?? {})} />} />
                </Routes>
              </MemoryRouter>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </HelmetProvider>
    );

    const h = helmetContext.helmet;
    const headHtml = h
      ? [h.title.toString(), h.meta.toString(), h.link.toString(), h.script.toString()].join('\n')
      : '';
    return { bodyHtml, headHtml };
  } finally {
    (HelmetProvider as any).canUseDOM = prevCanUseDOM;
    console.error = prevConsoleError;
  }
}

// Strip the shell's default head tags before injecting per-route ones, so the final HTML
// never has duplicate <title>/description/og/twitter/JSON-LD.
const DEFAULT_HEAD_PATTERNS: RegExp[] = [
  /<title>[^<]*<\/title>/i,
  /<meta\s+name="description"[^>]*>/i,
  /<meta\s+property="og:[^"]*"[^>]*>/gi,
  /<meta\s+name="twitter:[^"]*"[^>]*>/gi,
  /<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi,
];

/** Pure function: inject rendered head/body/preloaded into the built index.html template. */
export function injectIntoTemplate(
  template: string,
  parts: { headHtml: string; bodyHtml: string; preloaded?: Record<string, unknown> }
): string {
  let html = template;
  for (const re of DEFAULT_HEAD_PATTERNS) html = html.replace(re, '');
  html = html.replace('</head>', `${parts.headHtml}\n</head>`);
  html = html.replace('<div id="root"></div>', `<div id="root">${parts.bodyHtml}</div>`);
  if (parts.preloaded) {
    const json = JSON.stringify(parts.preloaded).replace(/</g, '\\u003c'); // avoid premature tag close
    html = html.replace(
      '<script type="module"',
      `<script>window.__PRELOADED__=${json}</script>\n<script type="module"`
    );
  }
  return html;
}
```

**`scripts/prerender.mjs`**: the post-build renderer. Boots Vite in `middlewareMode` purely to
SSR-load the two TS modules (so the `@` alias, CSS imports, and `import.meta.env` resolve), loops the
manifest, and writes each route. Wrap each route in try/catch: **never fail the whole build for one
route** (the SPA fallback still serves it). End with `process.exit(0)` so lingering esbuild handles
can't hang the build.

```js
#!/usr/bin/env node
// scripts/prerender.mjs — run AFTER `vite build` (dist/index.html is the template).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '../dist');
const TEMPLATE_PATH = path.join(DIST, 'index.html');

async function main() {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error('✖ dist/index.html not found — run `vite build` first.');
    process.exit(1);
  }
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  // Middleware-mode server only to transform + SSR-load our TS modules.
  // hmr:false + watch:null kill the file watcher / HMR socket so no handle keeps Node alive.
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true },
    appType: 'custom',
    logLevel: 'warn',
  });

  try {
    const { prerenderRoutes } = await vite.ssrLoadModule('/src/prerender/routes.tsx');
    const { renderRoute, injectIntoTemplate } = await vite.ssrLoadModule('/src/prerender/render.tsx');

    let written = 0;
    for (const route of prerenderRoutes) {
      try {
        if (route.path.includes(':')) {
          const items = route.getData ? await route.getData() : [];
          for (const item of items) {
            const routePath = route.path.replace(':slug', item.slug);
            const { bodyHtml, headHtml } = await renderRoute({
              path: routePath, Component: route.Component,
              routePattern: route.path, preloaded: item.preloaded,
            });
            writeRoute(injectIntoTemplate(template, { headHtml, bodyHtml, preloaded: item.preloaded }), routePath);
            written++;
          }
        } else {
          const { bodyHtml, headHtml } = await renderRoute({
            path: route.path, Component: route.Component, props: route.props,
          });
          writeRoute(injectIntoTemplate(template, { headHtml, bodyHtml }), route.path);
          written++;
        }
      } catch (err) {
        // Log and continue — the SPA fallback still serves this route client-side.
        console.warn(`⚠ prerender skipped ${route.path}: ${err.message}`);
      }
    }
    console.log(`✔ prerendered ${written} routes`);
  } finally {
    await vite.close();
  }
}

function writeRoute(html, routePath) {
  const rel = routePath === '/' ? 'index.html' : path.join(routePath.replace(/^\//, ''), 'index.html');
  const outPath = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, 'utf8');
}

main()
  .then(() => process.exit(0)) // force clean exit; esbuild/worker handles can otherwise hang the build
  .catch((err) => { console.error('✖ prerender failed:', err); process.exit(1); });
```

**`src/prerender/staticRoutes.json`**: the shared source of truth consumed by BOTH the manifest above
and the sitemap generator, so the route list cannot drift:

```json
[
  { "path": "/" },
  { "path": "/about" }
]
```

### Task list
- [ ] Confirm `react-dom/server` is available (it ships with `react-dom`) and add `jsdom` as a
      devDependency if the render path needs a DOM shim.
- [ ] Create `src/prerender/routes.tsx`, the manifest with **eager** component imports. Exclude
      private/no-index routes (admin, account, booking, auth) so they match `robots.txt`.
- [ ] Create `src/prerender/staticRoutes.json` as the **single source of truth** for the static route
      list, consumed by both the prerender manifest and the sitemap generator.
- [ ] Create `src/prerender/render.tsx` with `renderRoute()` and `injectIntoTemplate()` (above). Wrap
      the render in the app's real provider stack so any public chrome that calls hooks
      (`useAuth()` etc.) doesn't throw during SSR.
- [ ] Create `scripts/prerender.mjs` (above, near-verbatim).
- [ ] Wire the build script (order matters):
      `"build": "node scripts/copy-robots.js && node scripts/generate-sitemap.js && tsc && vite build && node scripts/prerender.mjs"`
- [ ] Leave `main.tsx` using `createRoot(...).render(...)`. The reference implementation does NOT use
      `hydrateRoot`: the client simply re-renders over the prerendered HTML. Crawlers get the static
      HTML; users get a normal client render. This avoids hydration-mismatch fragility. Only switch to
      `hydrateRoot` if you specifically need hydration and have verified no mismatch.
- [ ] Ensure the per-route SEO component (react-helmet-async) sets a UNIQUE title, description,
      canonical, OG, and JSON-LD for every prerendered route. That is what makes the static HTML
      distinct.
- [ ] Add tests (`routes.test.tsx`, `render.test.tsx`): assert each route renders a non-empty body +
      a unique title, and assert sitemap/manifest parity.

### Vercel config
- [ ] Output dir stays `dist`. Prerendered `dist/<route>/index.html` files are served as static HTML.
- [ ] Keep the SPA rewrite as a FALLBACK only (`/((?!api/|.*\..*|assets/).*)` → `/index.html`). Static
      prerendered files take precedence over the rewrite, so inner routes serve their baked HTML.
- [ ] Consider `"cleanUrls": true` / `"trailingSlash"` consistency so `/courses/x` and
      `/courses/x/` don't split signals. Match canonical tags to whichever you pick.

### Gotcha: env-dependent module-load throws fail the build on Vercel (Supabase, etc.)

**Symptom:** the build passes locally but fails on Vercel during the prerender step with something
like `Supabase URL is not defined ...` thrown from a client/config module
(`src/lib/supabaseClient.ts` or similar), with a stack through `ssrLoadModule` /
`SSRCompatModuleRunner`. Expect this on any Vite + Supabase site.

**Why it happens (two compounding causes):**
1. **Mode.** `prerender.mjs` uses Vite `createServer`, which defaults to **development** mode, so
   `import.meta.env.PROD` is `false`. Code that picks an instance by that flag
   (`isProduction ? VITE_SUPABASE_URL_PROD : VITE_SUPABASE_URL_DEV`) selects the DEV var, which
   often isn't set on Vercel (only PROD is). Fix: pass `mode: 'production'` to `createServer`.
2. **Env exposure.** Vite's **SSR module runner does not expose custom `VITE_*` vars** to
   `import.meta.env` the way `vite build` statically inlines them. On Vercel the vars live in
   `process.env` (no committed `.env`), so they read back `undefined` during SSR even when set. If a
   module **throws at import** on a missing value (a common Supabase client pattern), the whole
   prerender, and thus the deploy, fails. (It passes locally only because Vite reads your `.env`
   file.)

**Fix:** inject the needed vars explicitly via Vite `define` (static replacement reliably reaches SSR
transforms), sourced from `loadEnv`/`process.env`, with a harmless placeholder fallback so a missing
value never throws. Placeholders are safe because `renderToString` runs no effects, so no client
(Supabase/etc.) ever makes a network call during prerender. Pattern:

```js
import { createServer, loadEnv } from 'vite';
const fileEnv = loadEnv('production', ROOT, 'VITE_');
const pick = (k, fb) => fileEnv[k] || process.env[k] || fb;
const define = {
  'import.meta.env.VITE_SUPABASE_URL_PROD': JSON.stringify(pick('VITE_SUPABASE_URL_PROD', 'https://placeholder.supabase.co')),
  'import.meta.env.VITE_SUPABASE_ANON_KEY_PROD': JSON.stringify(pick('VITE_SUPABASE_ANON_KEY_PROD', 'placeholder')),
  // ...repeat for the _DEV pair and any other VITE_* a module reads at import
};
await createServer({ mode: 'production', define, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
```

**Verify the fix locally** by simulating the Vercel case: move `.env` aside and unset the vars, then
run `npm run build`. It must still prerender all routes. Always restore `.env` afterward (use a
`trap ... EXIT` so it restores even if the build fails). Add every `VITE_*` var that any
import-time-throwing module reads to the `define` map, not just Supabase.

---

## Phase 1B: Next.js branch, hygiene check (usually no rebuild)

Next.js App Router SSR/SSGs by default, so the empty-shell problem normally does NOT exist. Verify and
fix only what's missing:
- [ ] Phase 0 curl should already show distinct per-route HTML with real content. If so, no
      rendering work needed.
- [ ] Each page/route exports `metadata` or `generateMetadata()` with a UNIQUE title + description +
      canonical (`alternates.canonical`) + `openGraph`. Fix any page using only the root layout's
      generic metadata.
- [ ] Dynamic routes use `generateStaticParams()` where the set is known (courses, blog) for SSG.
- [ ] `app/sitemap.ts` (or a static `public/sitemap.xml`) exists and is current.
- [ ] `app/robots.ts` (or `public/robots.txt`) exists, references the sitemap, and blocks private
      paths.
- [ ] Watch for accidental `"use client"` at the top of a page that should be a server component.
      It pushes rendering client-side and can strip SSR'd metadata. Keep pages server components;
      isolate interactivity in child client components.
- [ ] Structured data (JSON-LD) rendered server-side via a `<script type="application/ld+json">` in
      the server component.

---

## Phase 2: Shared SEO hygiene (both stacks)

- [ ] `public/robots.txt` (Vite) or `app/robots.ts` (Next): allow public pages, block
      `/admin`, `/account`, `/booking*`, `/api`, dev paths; reference the absolute sitemap URL.
- [ ] `sitemap.xml`: lists all public canonical URLs, generated from the same route source as the
      prerender manifest so they cannot drift. Absolute `https://` URLs, sensible `lastmod`.
- [ ] `public/llms.txt`: state your AI-crawler policy and give AI/LLM crawlers a concise, accurate
      summary of the organisation and its offerings. Mirror the allow/disallow intent of `robots.txt`
      so the two don't contradict. See the llms.txt section of `SEO-how-to.md` for a template. This is
      emerging-convention hygiene ([llmstxt.org](https://llmstxt.org/)), not a ranking factor.
- [ ] Canonical tag on every page (absolute URL, self-referencing).
- [ ] Open Graph + Twitter card per page (title, description, `og:image`). Verify a shared link
      preview now differs per page.
- [ ] One `<h1>` per page; meaningful heading hierarchy.
- [ ] JSON-LD structured data appropriate to the page type (Organization/WebSite on home; Course on
      course pages; Person for instructors; BreadcrumbList on inner pages).

---

## Phase 3: Verify (evidence before claiming done)

- [ ] `npm run build` succeeds; confirm `dist/<route>/index.html` files exist for inner routes (Vite).
- [ ] Re-run the Phase 0 curls against the built output (or a preview deploy). Confirm:
      - `<div id="root">` now contains real markup.
      - Two different routes return DIFFERENT html with DIFFERENT `<title>`/description.
      - Visible word count is substantial, not ~20.
- [ ] Paste an inner URL into a link-preview tool (or WhatsApp/LinkedIn) → preview shows the page's
      own title/description/image.
- [ ] (If access) Google Search Console → URL Inspection → "View Crawled Page" shows real content;
      Coverage has no unexpected "Discovered – not indexed".
- [ ] No `<title>`/canonical duplicated across distinct pages.

---

## Reference file layout

| Concern | File |
|---|---|
| Post-build renderer | `scripts/prerender.mjs` |
| Route manifest (source of truth) | `src/prerender/routes.tsx` + `src/prerender/staticRoutes.json` |
| Render + template injection | `src/prerender/render.tsx` |
| Sitemap generator | `scripts/generate-sitemap.js` |
| Env-aware robots.txt copy | `scripts/copy-robots.js` |
| Build wiring | `package.json` → `"build"` script |
| Tests | `src/prerender/{routes,render}.test.tsx` |

---

## Version History

- **v1.1**: Made the playbook self-contained. Inlined the reference prerender implementation
  (routes/render/prerender scripts) so it no longer points at a specific project; added `llms.txt` to
  the shared SEO hygiene checklist and Phase 0 diagnosis.
- **v1.0**: Initial playbook. Phase 0 diagnosis, Vite prerendering branch, Next.js hygiene branch,
  shared hygiene, and verification.
