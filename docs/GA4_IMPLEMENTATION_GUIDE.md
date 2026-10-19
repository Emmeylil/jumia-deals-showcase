# Google Analytics (GA4) Implementation Guide for Next.js 16

**Author:** Andi Ashari | **Published:** Nov 8, 2025 | **Source:** Medium

---

## Overview

This guide provides a complete, production-ready implementation of Google Analytics 4 (GA4) for Next.js 16 applications using the official `@next/third-parties/google` package.

### Why @next/third-parties?

- Official Next.js solution
- Optimized performance (loads after hydration)
- Automatic pageview tracking
- Type-safe with TypeScript
- Built-in Web Vitals support

---

## Quick Start Checklist

1. Install `@next/third-parties`
2. Add `NEXT_PUBLIC_GA_MEASUREMENT_ID` to `.env`
3. Create `GoogleAnalytics.tsx` component
4. Create `WebVitals.tsx` component
5. Create `lib/analytics.ts` utilities
6. Integrate in `app/layout.tsx` (AFTER children)
7. Test in development (should be disabled)
8. Test in production build
9. Verify events in GA4 dashboard

---

## Installation

### 1. Install Package

```bash
npm install @next/third-parties@latest
# or
pnpm add @next/third-parties@latest
# or
bun add @next/third-parties@latest
```

### 2. Environment Variables

Add to `.env.local` (development):

```env
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

Add to `.env.production` or deployment config:

```env
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

Add to `.env.example`:

```env
# Google Analytics 4 Measurement ID
# Get from: https://analytics.google.com/analytics/web/
# Format: G-XXXXXXXXXX
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

**Important:**

- Use `NEXT_PUBLIC_` prefix for client-side access
- Never commit real measurement IDs to git
- Use different IDs for development/staging/production

---

## File Structure

### Standard Structure (src/ directory)

```
project-name/
├── src/
│   ├── components/
│   │   ├── GoogleAnalytics.tsx    # GA4 wrapper component
│   │   └── WebVitals.tsx          # Web Vitals tracker
│   ├── lib/
│   │   └── analytics.ts           # Analytics utilities & event tracking
│   └── app/
│       └── layout.tsx             # Integration point
├── .env.local                     # Development config (gitignored)
├── .env.example                   # Example config (committed)
└── package.json
```

### Alternative Structure (root components/)

```
project-name/
├── components/
│   ├── GoogleAnalytics.tsx
│   └── WebVitals.tsx
├── lib/
│   └── analytics.ts
├── app/
│   └── layout.tsx
└── ...
```

Choose one structure and be consistent across all projects.

---

## Implementation

### 1. GoogleAnalytics Component

**File:** `src/components/GoogleAnalytics.tsx` (or `components/GoogleAnalytics.tsx`)

```tsx
'use client'

import { GoogleAnalytics as NextGoogleAnalytics } from '@next/third-parties/google'
import { GA_MEASUREMENT_ID, isAnalyticsEnabled } from '@/lib/analytics'

// Re-export analytics utilities for convenience
export { reportWebVitals, analytics, trackEvent, trackPageView } from '@/lib/analytics'

/**
 * Google Analytics component using @next/third-parties
 * Optimized for performance with proper environment checking
 */
export default function GoogleAnalytics() {
  // Only render when analytics is enabled (not in development)
  if (!isAnalyticsEnabled()) {
    return null
  }
  return <NextGoogleAnalytics gaId={GA_MEASUREMENT_ID} />
}
```

**Key Points:**

- Client component (`'use client'`)
- Environment check prevents loading in development
- Re-exports utilities for easy imports
- Simple, minimal implementation

---

### 2. WebVitals Component

**File:** `src/components/WebVitals.tsx` (or `components/WebVitals.tsx`)

```tsx
'use client'

import { useReportWebVitals } from 'next/web-vitals'
import { reportWebVitals } from '@/lib/analytics'

/**
 * Web Vitals tracking component
 * Automatically reports Core Web Vitals to Google Analytics
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    reportWebVitals(metric)
  })
  return null
}
```

**Metrics Tracked:**

- **TTFB** - Time to First Byte (server response)
- **FCP** - First Contentful Paint (initial render)
- **LCP** - Largest Contentful Paint (main content)
- **FID** - First Input Delay (legacy, being replaced)
- **INP** - Interaction to Next Paint (new standard)
- **CLS** - Cumulative Layout Shift (visual stability)

**Custom Next.js Metrics:**

- `Next.js-hydration` - Hydration duration
- `Next.js-route-change-to-render` - Navigation timing
- `Next.js-render` - Render completion

---

### 3. Analytics Utilities

**File:** `src/lib/analytics.ts` (or `lib/analytics.ts`)

```typescript
/**
 * Google Analytics 4 utilities for Next.js
 * Standardized implementation using @next/third-parties
 */

import { sendGAEvent } from '@next/third-parties/google'

// Environment variables
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-XXXXXXXXXX'

/**
 * Check if GA should be enabled (not in development)
 */
export const isAnalyticsEnabled = (): boolean => {
  return (
    process.env.NODE_ENV !== 'development' &&
    Boolean(GA_MEASUREMENT_ID) &&
    GA_MEASUREMENT_ID !== 'G-XXXXXXXXXX'
  )
}

/**
 * Web Vitals metric interface
 */
export interface WebVitalsMetric {
  id: string
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  label?: string
  attribution?: Record<string, unknown>
}

/**
 * Custom Google Analytics event interface
 */
export interface GAEvent {
  action: string
  category?: string
  label?: string
  value?: number
  custom_parameters?: Record<string, unknown>
}

/**
 * Reports Web Vitals metrics to Google Analytics
 */
export function reportWebVitals(metric: WebVitalsMetric): void {
  if (!isAnalyticsEnabled()) {
    if (process.env.NODE_ENV === 'development') {
      console.info('Web Vitals (dev):', metric)
    }
    return
  }

  // Only report actual web vitals metrics
  if (metric.label !== 'web-vital') {
    return
  }

  // Prepare metric value based on type
  // CLS needs to be multiplied by 1000 for analytics
  const value = Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value)

  // Send to GA4 using @next/third-parties
  sendGAEvent({
    event_name: 'web_vitals',
    event_category: 'Web Vitals',
    event_label: metric.name,
    value: value,
    metric_id: metric.id,
    metric_rating: metric.rating,
    metric_delta: metric.delta,
    custom_parameters: metric.attribution || {},
  })
}

/**
 * Sends custom events to Google Analytics
 */
export function trackEvent(event: GAEvent): void {
  if (!isAnalyticsEnabled()) {
    return
  }

  sendGAEvent({
    event_name: event.action,
    event_category: event.category || 'engagement',
    event_label: event.label,
    value: event.value,
    custom_parameters: event.custom_parameters,
  })
}

/**
 * Tracks page views (usually handled automatically by GoogleAnalytics component)
 */
export function trackPageView(url: string, title?: string): void {
  if (!isAnalyticsEnabled()) {
    return
  }

  sendGAEvent({
    event_name: 'page_view',
    page_location: url,
    page_title: title || document.title,
  })
}

/**
 * Common event trackers for typical website interactions
 */
export const analytics = {
  // Track external link clicks
  trackExternalLink: (url: string, text?: string) => {
    trackEvent({
      action: 'click_external_link',
      category: 'engagement',
      label: url,
      custom_parameters: {
        link_text: text,
        link_url: url,
      },
    })
  },

  // Track download events
  trackDownload: (filename: string, fileType?: string) => {
    trackEvent({
      action: 'download',
      category: 'engagement',
      label: filename,
      custom_parameters: {
        file_name: filename,
        file_type: fileType,
      },
    })
  },

  // Track form submissions
  trackFormSubmission: (formName: string, success: boolean = true) => {
    trackEvent({
      action: 'form_submission',
      category: 'engagement',
      label: formName,
      value: success ? 1 : 0,
      custom_parameters: {
        form_name: formName,
        submission_success: success,
      },
    })
  },

  // Track search queries
  trackSearch: (query: string, results?: number) => {
    trackEvent({
      action: 'search',
      category: 'engagement',
      label: query,
      value: results,
      custom_parameters: {
        search_term: query,
        search_results: results,
      },
    })
  },

  // Track social media interactions
  trackSocialInteraction: (network: string, action: string, target?: string) => {
    trackEvent({
      action: 'social_interaction',
      category: 'social',
      label: `${network}_${action}`,
      custom_parameters: {
        social_network: network,
        social_action: action,
        social_target: target,
      },
    })
  },
}

/**
 * Type definitions for gtag (for backward compatibility if needed)
 */
declare global {
  interface Window {
    gtag?: (command: string, targetId: string, config?: Record<string, unknown>) => void
  }
}
```

---

### 4. Layout Integration

**File:** `src/app/layout.tsx` (or `app/layout.tsx`)

**CRITICAL:** Place analytics components AFTER `{children}` for optimal performance.

```tsx
import type { Metadata } from 'next'
import './globals.css'
import GoogleAnalytics from '@/components/GoogleAnalytics'
import { WebVitals } from '@/components/WebVitals'

export const metadata: Metadata = {
  title: 'Your App Name',
  description: 'Your app description',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {/* App content first - optimizes hydration */}
        {children}

        {/* Google Analytics - @next/third-parties optimized - loads after hydration */}
        <GoogleAnalytics />

        {/* Core Web Vitals Tracking */}
        <WebVitals />
      </body>
    </html>
  )
}
```

**Why This Order Matters:**

- `{children}` renders first -> faster initial page load
- Analytics loads AFTER hydration -> doesn't block interactivity
- Follows official Next.js documentation pattern
- Optimal Core Web Vitals scores

---

## Cookie Consent: Make "Reject" Actually Mean No Data

By default the setup above starts collecting as soon as a production page loads. In the EU and UK (GDPR, ePrivacy) and a growing list of other regions, you are not allowed to load analytics or set analytics cookies until the visitor has actively agreed. "Reject" has to mean the tracker never runs, not that it runs quietly in the background.

Combine two layers.

### Layer 1 (strongest): don't load GA until consent is granted

While the visitor hasn't agreed, don't mount the `GoogleAnalytics` component at all. No script, no network request, no cookies. This is the most defensible reading of "reject = no data."

Store the decision and gate the component on it:

```tsx
// components/ConsentProvider.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Consent = 'granted' | 'denied' | 'unknown'

const ConsentContext = createContext<{
  consent: Consent
  setConsent: (c: Consent) => void
}>({ consent: 'unknown', setConsent: () => {} })

export function useConsent() {
  return useContext(ConsentContext)
}

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  // Start as 'unknown' so nothing analytics-related runs on the first paint
  const [consent, setConsentState] = useState<Consent>('unknown')

  // Read the saved choice once on mount
  useEffect(() => {
    const saved = localStorage.getItem('analytics-consent')
    if (saved === 'granted' || saved === 'denied') setConsentState(saved)
  }, [])

  const setConsent = (c: Consent) => {
    localStorage.setItem('analytics-consent', c)
    setConsentState(c)
    // Also tell GA about the change for this page load (Consent Mode, Layer 2)
    window.gtag?.('consent', 'update', {
      analytics_storage: c === 'granted' ? 'granted' : 'denied',
    })
  }

  return (
    <ConsentContext.Provider value={{ consent, setConsent }}>
      {children}
    </ConsentContext.Provider>
  )
}
```

```tsx
// components/GoogleAnalytics.tsx — only mounts once consent is granted
'use client'

import { GoogleAnalytics as NextGoogleAnalytics } from '@next/third-parties/google'
import { GA_MEASUREMENT_ID, isAnalyticsEnabled } from '@/lib/analytics'
import { useConsent } from './ConsentProvider'

export default function GoogleAnalytics() {
  const { consent } = useConsent()
  // Not in development, and not until the visitor has explicitly agreed
  if (!isAnalyticsEnabled() || consent !== 'granted') {
    return null
  }
  return <NextGoogleAnalytics gaId={GA_MEASUREMENT_ID} />
}
```

Because the component returns `null` until `consent === 'granted'`, the GA script is never injected and no `google-analytics.com` request is made while the visitor is undecided or has rejected. When they click Accept, `setConsent('granted')` re-renders and GA mounts for the first time. Gate `WebVitals` the same way, since it also sends data to GA.

### Layer 2 (belt and braces): Google Consent Mode v2

Consent Mode is Google's own signal. Set a default of `denied` before GA loads, then `update` to `granted` when the visitor agrees. Even if a tag does load, `analytics_storage: 'denied'` stops it writing cookies. Set the default as early as possible, before any analytics runs:

```tsx
// app/layout.tsx — set consent defaults before anything else
import Script from 'next/script'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Script id="consent-default" strategy="beforeInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = window.gtag || gtag;
            gtag('consent', 'default', {
              ad_storage: 'denied',
              analytics_storage: 'denied',
              ad_user_data: 'denied',
              ad_personalization: 'denied',
              wait_for_update: 500,
            });
          `}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  )
}
```

### The banner and wiring it up

A minimal banner that only shows while the choice is still `unknown`:

```tsx
// components/CookieConsentBanner.tsx
'use client'

import { useConsent } from './ConsentProvider'

export function CookieConsentBanner() {
  const { consent, setConsent } = useConsent()
  if (consent !== 'unknown') return null // already decided, stay hidden

  return (
    <div role="dialog" aria-label="Cookie consent" className="cookie-banner">
      <p>We use analytics cookies to see how the site is used. They stay off until you accept.</p>
      <div>
        <button onClick={() => setConsent('denied')}>Reject</button>
        <button onClick={() => setConsent('granted')}>Accept</button>
      </div>
    </div>
  )
}
```

```tsx
// app/layout.tsx (body excerpt) — wrap the app and render the banner
import { ConsentProvider } from '@/components/ConsentProvider'
import { CookieConsentBanner } from '@/components/CookieConsentBanner'
import GoogleAnalytics from '@/components/GoogleAnalytics'
import { WebVitals } from '@/components/WebVitals'

// ...inside <body>:
<ConsentProvider>
  {children}
  <GoogleAnalytics /> {/* only mounts after Accept */}
  <WebVitals />
  <CookieConsentBanner />
</ConsentProvider>
```

### Checklist for honest consent

- The default state is "no analytics." Nothing loads on a first visit until the visitor chooses.
- Reject writes the choice, hides the banner, and never mounts GA. Confirm in DevTools -> Network that there are zero `google-analytics.com` / `googletagmanager.com` requests after clicking Reject.
- Accept mounts GA and, via Consent Mode, flips `analytics_storage` to `granted`.
- The choice persists across page loads (localStorage) and the banner does not reappear until the visitor clears it.
- Give people a way to change their mind later (a "Cookie settings" link that resets the choice to `unknown`).
- `WebVitals` is gated on consent too, since it also reports to GA.

---

## Domain-Specific Extensions

For specialized applications (e-commerce, POS, DeFi, etc.), extend the analytics object:

### Example: E-commerce Extensions

```typescript
// Add to lib/analytics.ts
export const analytics = {
  // ... standard trackers ...

  // E-commerce: Track product views
  trackProductView: (productId: string, productName: string, price: number) => {
    trackEvent({
      action: 'view_item',
      category: 'ecommerce',
      label: productName,
      value: price,
      custom_parameters: {
        product_id: productId,
        product_name: productName,
        price: price,
      },
    })
  },

  // E-commerce: Track add to cart
  trackAddToCart: (productId: string, productName: string, quantity: number, price: number) => {
    trackEvent({
      action: 'add_to_cart',
      category: 'ecommerce',
      label: productName,
      value: price * quantity,
      custom_parameters: {
        product_id: productId,
        product_name: productName,
        quantity: quantity,
        price: price,
      },
    })
  },

  // E-commerce: Track purchases
  trackPurchase: (orderId: string, total: number, items: number) => {
    trackEvent({
      action: 'purchase',
      category: 'ecommerce',
      label: orderId,
      value: total,
      custom_parameters: {
        order_id: orderId,
        order_total: total,
        item_count: items,
      },
    })
  },
}
```

### Example: POS System Extensions

```typescript
// Specific to point-of-sale systems
export const analytics = {
  // ... standard trackers ...

  // POS: Track order creation
  trackOrderCreated: (orderId: string, total: number, itemCount: number, paymentMethod?: string) => {
    trackEvent({
      action: 'order_created',
      category: 'pos',
      label: orderId,
      value: total,
      custom_parameters: {
        order_id: orderId,
        order_total: total,
        item_count: itemCount,
        payment_method: paymentMethod,
      },
    })
  },

  // POS: Track inventory actions
  trackInventoryAction: (action: 'add' | 'update' | 'delete', productId: string, productName: string) => {
    trackEvent({
      action: `inventory_${action}`,
      category: 'pos',
      label: productName,
      custom_parameters: {
        product_id: productId,
        product_name: productName,
        inventory_action: action,
      },
    })
  },
}
```

---

## Usage Examples

### Basic Event Tracking

```tsx
'use client'

import { analytics } from '@/components/GoogleAnalytics'

export function ContactForm() {
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      // Your form logic
      await submitForm()
      // Track successful submission
      analytics.trackFormSubmission('contact_form', true)
    } catch (error) {
      // Track failed submission
      analytics.trackFormSubmission('contact_form', false)
    }
  }

  return <form onSubmit={handleSubmit}>...</form>
}
```

### External Link Tracking

```tsx
'use client'

import { analytics } from '@/components/GoogleAnalytics'

export function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  const handleClick = () => {
    analytics.trackExternalLink(href, typeof children === 'string' ? children : href)
  }

  return (
    <a href={href} onClick={handleClick} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}
```

### Download Tracking

```tsx
'use client'

import { analytics } from '@/components/GoogleAnalytics'

export function DownloadButton() {
  const handleDownload = () => {
    analytics.trackDownload('product-catalog.pdf', 'pdf')
  }

  return (
    <button onClick={handleDownload}>
      Download Catalog
    </button>
  )
}
```

---

## Configuration & Best Practices

### Environment-Based Configuration

**Development (analytics disabled):**

```env
NODE_ENV=development
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

**Production (analytics enabled):**

```env
NODE_ENV=production
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-REAL123456
```

### Multiple Environments

```typescript
// lib/analytics.ts
export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_ENVIRONMENT === 'production'
    ? process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID_PROD
    : process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID_STAGING
```

### Content Security Policy (CSP)

If using CSP headers, allow Google Analytics domains:

```javascript
// next.config.js
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com;
  connect-src 'self' https://www.google-analytics.com https://analytics.google.com;
  img-src 'self' blob: data: https://www.google-analytics.com;
`
```

---

## Testing & Verification

### 1. Development Testing

**Expected Behavior:**

- Analytics should NOT load in development
- Console logs should show: `Web Vitals (dev): { ... }`
- No network requests to Google Analytics

**Verify:**

```bash
# Start dev server
npm run dev

# Open browser DevTools -> Network tab
# Filter: google-analytics or gtag
# Should see: NO requests
```

### 2. Production Build Testing

```bash
# Build for production
npm run build

# Start production server
npm start

# Or preview build
npm run preview
```

**Verify:**

- Analytics SHOULD load
- Network requests to `google-analytics.com`
- Check: DevTools -> Network -> Filter: `gtag` or `analytics`

### 3. GA4 Dashboard Verification

**Real-time Reports:**

1. Go to: https://analytics.google.com/
2. Navigate to: Reports -> Realtime
3. Open your site in browser
4. Should see: Active users, pageviews, events

**DebugView (recommended):**

1. Install: Google Analytics Debugger Extension
2. Enable extension
3. Open: GA4 -> Configure -> DebugView
4. Navigate your site
5. See: Real-time event stream with details

### 4. Test Events

```tsx
// Create a test page: app/analytics-test/page.tsx
'use client'

import { analytics, trackEvent } from '@/components/GoogleAnalytics'

export default function AnalyticsTest() {
  const testEvents = () => {
    // Test standard events
    analytics.trackExternalLink('https://example.com', 'Test Link')
    analytics.trackDownload('test.pdf', 'pdf')
    analytics.trackFormSubmission('test_form', true)
    analytics.trackSearch('test query', 10)
    analytics.trackSocialInteraction('twitter', 'share', 'test-page')

    // Test custom event
    trackEvent({
      action: 'test_custom_event',
      category: 'testing',
      label: 'manual_test',
      value: 123,
    })
  }

  return (
    <div>
      <h1>Analytics Testing</h1>
      <button onClick={testEvents}>Fire Test Events</button>
      <p>Check GA4 DebugView or Realtime reports</p>
    </div>
  )
}
```
