# Ship Less JavaScript

**The bottleneck in one sentence:** your app downloads its whole codebase before a single pixel renders. Every page, every admin screen, every heavy third-party widget ships in the same bundle, because nothing was ever split into separate chunks.

AI coding assistants are extremely good at making a new page "just work": add a route, import the component at the top of the file, done. What they don't do by default is think about who downloads what. The result is a single JavaScript bundle that keeps growing every time a feature is added, until an anonymous visitor on the landing page is downloading code for the admin dashboard, the booking calendar, and every authenticated screen they'll never see.

## What it looks like

A router file where every page, public or private, light or heavy, is a plain top-level import:

```tsx
// src/App.tsx (everything loads eagerly, in one bundle)
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import LandingPage from './pages/LandingPage';
import AboutPage from './pages/AboutPage';
import PricingPage from './pages/PricingPage';
import BookingPage from './pages/BookingPage';       // pulls in a full calendar library
import DashboardPage from './pages/DashboardPage';    // the entire authenticated app
import VideoDetailPage from './pages/VideoDetailPage'; // heavy tab tree, player, editor
import SearchResultsPage from './pages/SearchResultsPage';
import AdminPage from './pages/AdminPage';             // charts, tables, rarely visited
import AccountSettingsPage from './pages/AccountSettingsPage';
// ...12 more pages, all imported the same way

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/booking" element={<BookingPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/video/:id" element={<VideoDetailPage />} />
        <Route path="/search" element={<SearchResultsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/account" element={<AccountSettingsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

Every one of those imports gets bundled into (or very close to) the same entry chunk. A visitor who only ever looks at / and /pricing still pays the download cost for the calendar widget, the video editor, and the admin charting library.

There's a sneakier version of this same bug: a codebase that does use lazy() for some routes, usually the obvious, low-traffic ones like legal pages, help docs, and admin, but leaves the actual heaviest routes (the main dashboard, a detail view, search) as static imports because they "already worked" before code-splitting was introduced and nobody circled back. Glance at the file and the problem looks fixed, you can see lazy() calls right there, but the biggest chunks never actually got split out.

**Spotting it in a diff or a review:** search the router file for the ratio of plain `import X from` lines to `lazy(() => import(...))` lines. Then cross-check which routes are which. A codebase that lazy-loads five legal and help pages but statically imports the dashboard, the search results page, and anything with a calendar or chart library has fixed the easy 20% and left the expensive 80% untouched. That pattern is common enough to check for by name, not just by counting lazy() calls.

## Why AI tools generate this

**Static imports are the path of least resistance.** import X from './X' always works, compiles cleanly, and needs no extra scaffolding. React.lazy(() => import('./X')) requires wrapping the route in <Suspense>, choosing a fallback, and ideally an error boundary: more moving parts, more chances for the assistant to generate something that doesn't compile on the first try. Given a choice between guaranteed to work and correct but fiddlier, an assistant optimizing for a single request tends to pick the former.

**Bundle size isn't visible in the editor.** An AI assistant sees that the page renders correctly, not that this added 400KB to the entry chunk. There's no feedback loop telling it that a new import made the app slower, so nothing pushes it toward splitting.

**Assistants patch what they're shown, not what's biggest.** Ask an AI tool to add lazy loading and it typically reaches for the routes that are easy to identify as non-critical: admin, legal, marketing pages, because those are uncontroversial. It rarely audits which routes are actually the heaviest by dependency weight, so the biggest offenders, a page pulling in a calendar library, a rich video or tab-heavy detail view, often get skipped simply because nobody asked specifically about them.

**Error boundaries get forgotten as a separate step.** Lazy loading and error boundaries are two different concerns that happen to live in the same place in the code. It's common to see error boundaries wired only around the routes that were lazy()-ed, leaving the eager, usually core, highest-traffic routes with zero crash recovery. A render-time throw in your main dashboard becomes a blank white screen instead of a friendly fallback.

## What it costs

**Time to Interactive and Largest Contentful Paint suffer directly.** Every KB in the entry chunk delays parse and execute before the page becomes interactive: a direct Core Web Vitals hit (LCP, TBT/INP), which Google uses as a ranking signal and which correlates directly with bounce rate.

**Anonymous visitors pay for authenticated code.** A visitor who has never logged in and never will still downloads your dashboard, admin panel, and settings screens when they're statically imported from the same entry point as the landing page.

**Mobile and slow-connection users disproportionately suffer.** A 1.5 to 2MB bundle that's imperceptible on a fast fiber connection can add several seconds of blank-screen time on 3G/4G or a mid-tier phone, exactly the users most likely to bounce before the page ever paints.

**Every unrelated feature makes every page slower.** Because there are no chunk boundaries, adding a heavy dependency for one rarely-used page (a calendar library, a charting library, a rich text editor) inflates the load time of every page, including the ones that never use it.

**Unguarded eager routes turn one bug into a full outage.** Busiest routes with no error boundary mean a single render-time exception anywhere in that tree takes down the whole screen for every user hitting it, instead of degrading gracefully.

## A representative before and after

These numbers are illustrative rather than one specific audited project, but the shape repeats across almost every unsplit React app we come across: a landing page paying full price for code only the authenticated dashboard needs.

| Metric | Before | After |
| --- | --- | --- |
| Entry chunk, gzipped | ~480KB | ~150–220KB |
| Time to Interactive, throttled 4G | ~4.5s | ~1.8s |
| Routes imported eagerly at the entry point | 12 | 2 (landing + login) |
| Heavy third-party libraries in the entry chunk | 3 (calendar, charts, editor) | 0, loaded on demand |

The exact numbers depend entirely on your dependencies. The pattern doesn't: a small, always-needed core plus on-demand chunks for everything else.

## How to measure it in your app

Run these against your production build, not dev, since the dev server's output isn't representative:

```bash
# 1. Build for production
npm run build

# 2a. Vite projects: visualize what's actually in each chunk
npm install --save-dev rollup-plugin-visualizer
# add to vite.config.ts (see fix below), then:
npm run build
# opens an interactive treemap of your bundle in the browser

# 2b. Or, framework-agnostic, inspect built output sizes directly
npx source-map-explorer 'dist/assets/*.js'

# 3. Next.js projects: official bundle analyzer
npm install --save-dev @next/bundle-analyzer
# wrap next.config.js with withBundleAnalyzer, then:
ANALYZE=true npm run build
```

In Chrome DevTools:

```text
1. Open DevTools → Coverage tab (Cmd/Ctrl+Shift+P → "Show Coverage")
2. Reload the page with recording on
3. Sort by "Unused Bytes" (this tells you exactly how much of what
   loaded was never even executed on this page view)
4. Network tab → filter by JS → sort by size → look at the FIRST
   request (your entry chunk) on an anonymous/logged-out page load
```

Run Lighthouse (npx lighthouse https://your-site.com --view or the Chrome DevTools Lighthouse panel) and look specifically at:

- "Reduce unused JavaScript": lists exact scripts and estimated savings.
- "Reduce initial server response time" and "Minimize main-thread work": often symptomatic of an oversized entry bundle.
- Total Blocking Time (TBT) and Largest Contentful Paint (LCP) scores.

Rough rule of thumb: an entry or main JS chunk (gzipped) over roughly 200 to 300KB on a content-first page like a landing page is a strong signal of unsplit routes worth investigating.

## The fix

Convert route components to React.lazy(), wrap them in <Suspense> with a lightweight fallback, and pair every lazy boundary with an error boundary so a crash in one route doesn't blank the whole app. Keep only the truly universal, always-needed routes (landing page, login) as eager imports.

```tsx
// src/App.tsx (route-level code splitting + error boundaries)
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import LandingPage from './pages/LandingPage'; // small, always needed, keep eager
import LoginPage from './pages/LoginPage';     // small, always needed, keep eager

// Everything else: lazy. Group by "does this route pull in something heavy?"
const BookingPage = lazy(() => import('./pages/BookingPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const VideoDetailPage = lazy(() => import('./pages/VideoDetailPage'));
const SearchResultsPage = lazy(() => import('./pages/SearchResultsPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const AccountSettingsPage = lazy(() => import('./pages/AccountSettingsPage'));

// One helper so every lazy route gets the same Suspense + ErrorBoundary wiring.
// This is the piece that's easy to forget when routes are added ad hoc.
function withSuspense(Component: React.LazyExoticComponent<React.ComponentType>) {
  return (
    <ErrorBoundary fallback={<RouteErrorFallback />}>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/booking" element={withSuspense(BookingPage)} />
        <Route path="/dashboard" element={withSuspense(DashboardPage)} />
        <Route path="/video/:id" element={withSuspense(VideoDetailPage)} />
        <Route path="/search" element={withSuspense(SearchResultsPage)} />
        <Route path="/admin" element={withSuspense(AdminPage)} />
        <Route path="/account" element={withSuspense(AccountSettingsPage)} />
      </Routes>
    </BrowserRouter>
  );
}
```

A minimal ErrorBoundary so a render-time throw shows a recoverable message instead of a blank screen:

```tsx
// src/components/ErrorBoundary.tsx
import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; fallback: ReactNode }
interface State { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Route crashed:', error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
```

Split out large, stable third-party dependencies into their own vendor chunk so they cache independently of your app code (Vite example, Next.js does this automatically):

```ts
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // isolate genuinely heavy, page-specific libraries so they
          // only load when the page that needs them loads
          'vendor-calendar': ['react-big-calendar', 'date-fns'],
          'vendor-charts': ['recharts'],
        },
      },
    },
  },
});
```

For Next.js App Router, the equivalent is next/dynamic:

```tsx
import dynamic from 'next/dynamic';

const AdminDashboard = dynamic(() => import('@/components/AdminDashboard'), {
  loading: () => <RouteLoadingFallback />,
});
```

When auditing which routes to split first, don't just grab the obvious low-traffic ones (legal, docs, admin). Profile actual dependency weight with the bundle visualizer above, and prioritize the routes that are both heavy and not universally needed on first paint, even when one of them happens to be your most-visited authenticated screen.

## Checklist

**Audit**
- Run a bundle analyzer against the production build and identify the entry/main chunk size.
- List every top-level route import in your router file.

**Split and guard**
- Convert every route except the true "always needed on cold load" ones (landing, login) to lazy() / next/dynamic.
- Wrap every lazy route in <Suspense> with a real loading fallback, not a blank screen.
- Wrap every lazy route in an error boundary, and audit whether your eager routes have one too.
- Split large, stable third-party libraries (calendar, charts, editors) into their own vendor chunk.

**Verify**
- Re-run the bundle analyzer and confirm the entry chunk shrank and heavy libraries moved to on-demand chunks.
- Re-run Lighthouse and confirm LCP / TBT improved on an anonymous, logged-out page load.
- Re-check this after every few feature additions, since bundle bloat is incremental and easy to miss one PR at a time.

## Prompt your AI assistant

```
Audit this repository for JavaScript bundle bloat from missing code splitting.

1. Find the main router/entry file (App.tsx, App.jsx, or the Next.js app/ router)
   and list every top-level page/route import that is NOT using React.lazy(),
   next/dynamic, or an equivalent dynamic import.
2. For each one, estimate its relative weight by checking what it imports
   (does it pull in a calendar, charting, rich-text-editor, video, or other
   heavy third-party library?) and flag the heaviest ones first, not just
   the obviously low-traffic ones like legal/admin pages.
3. Propose a converted version of the router file where every route except
   the minimal "always needed on first paint" set (typically just the
   landing/home page and the login page) uses lazy loading, wrapped in
   both a <Suspense> fallback and an error boundary.
4. Check whether an ErrorBoundary component already exists in the codebase.
   If lazy routes are wrapped in Suspense but NOT in an error boundary,
   flag that explicitly: a render-time crash there currently produces a
   blank screen with no recovery UI.
5. If this is a Vite project, propose a manualChunks config in
   vite.config.ts that isolates heavy, page-specific third-party
   dependencies into their own vendor chunks.
6. Run a production build before and after your changes and report the
   entry/main chunk size difference in KB (gzipped if possible).

Do not change any route's behavior or props, this is a bundling/loading
change only. Show me the diff before applying it.
```
