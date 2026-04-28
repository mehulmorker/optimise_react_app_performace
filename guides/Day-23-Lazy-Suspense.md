# Day 23 — React.lazy + Suspense

## Objective

Understand how `React.lazy` and `Suspense` enable code splitting — loading components only when they're needed rather than bundling everything upfront. This directly impacts initial load time, which is the most important performance metric for user acquisition.

---

## Real World Importance

- Login page shouldn't load the entire dashboard JavaScript bundle
- Admin panel code shouldn't be sent to regular users
- Chart libraries (heavy) shouldn't load until the user navigates to analytics
- Video player, PDF viewer, rich text editor — load on demand
- Route-level splitting: each page is its own chunk

---

## Concepts Covered

- What code splitting is and why it matters for performance
- Dynamic `import()` and how bundlers create separate chunks
- `React.lazy()` — wraps a lazy-loaded component
- `Suspense` — shows fallback during loading
- Named vs default exports with lazy
- Error boundaries for load failures
- Route-level splitting with React Router
- Preloading components before the user navigates

---

## Exercise Task

### Setup — Before you start

```jsx
import React, { lazy, Suspense, useState } from 'react';
```

You also need to **create the lazy-loaded component files** that `React.lazy` will import. Create these two files now — they need to exist before the lazy imports will work:

**`src/components/HeavyChart.jsx`** — the component that will be lazily loaded:
```jsx
// src/components/HeavyChart.jsx
export default function HeavyChart() {
  return (
    <div style={{ padding: 16, background: '#f0f8ff', border: '1px solid #0070f3', borderRadius: 8 }}>
      <h3>📊 Heavy Chart</h3>
      <p>This component was lazily loaded — it wasn't in the initial bundle.</p>
      <div style={{ height: 200, background: 'linear-gradient(to right, #0070f3, #00a0ff)', borderRadius: 4 }} />
    </div>
  );
}
```

**`src/pages/`** — for route-level splitting in Step 3. Create these minimal page files:
```jsx
// src/pages/HomePage.jsx
export default function HomePage() {
  return <div style={{ padding: 20 }}><h2>Home Page</h2><p>Loaded as part of the initial bundle.</p></div>;
}

// src/pages/DashboardPage.jsx
export default function DashboardPage() {
  return <div style={{ padding: 20 }}><h2>Dashboard</h2><p>This page was lazily loaded — check the Network tab for a new .chunk.js file.</p></div>;
}

// src/pages/SettingsPage.jsx
export default function SettingsPage() {
  return <div style={{ padding: 20 }}><h2>Settings</h2><p>Lazily loaded on first navigation.</p></div>;
}
```

---

### Step 1 — Understand the problem: large initial bundle

Without code splitting, `npm run build` creates one large JavaScript file containing every component in your app. A user who visits the login page downloads code for the dashboard, the settings page, the admin panel — none of which they need yet.

Imagine:
```
bundle.js = Login + Dashboard + Charts + VideoPlayer + AdminPanel + Settings
           = 2.5MB gzipped
```

With code splitting:
```
main.js = Login + common utils = 200KB
dashboard.chunk.js = Dashboard = 400KB (only downloaded after login)
charts.chunk.js = Charts = 600KB (only downloaded on analytics page)
```

---

### Step 2 — Lazy load a heavy component

Create `src/components/LazyDemo.jsx`:

```jsx
import React, { lazy, Suspense, useState } from 'react';

// Without lazy: imported and bundled immediately
// import HeavyChart from './HeavyChart';

// With lazy: creates a separate bundle chunk, loaded on first render
const HeavyChart = lazy(() => import('./HeavyChart'));

export function Dashboard() {
  const [showChart, setShowChart] = useState(false);

  return (
    <div style={{ padding: 16 }}>
      <button onClick={() => setShowChart(true)}>Show Chart</button>

      {showChart && (
        <Suspense fallback={<div>Loading chart...</div>}>
          <HeavyChart />
        </Suspense>
      )}
    </div>
  );
}
```

Open the Network tab in DevTools **before** clicking the button. Click **Show Chart**. You should see a new `.js` file downloaded (the chunk containing `HeavyChart`). During the download, "Loading chart..." renders. After the chunk loads, `HeavyChart` renders.

> **Vite note:** Vite creates chunks with hashed names like `HeavyChart-abc123.js`. You may need to filter by "JS" in the Network tab to find it.

---

### Step 3 — Route-level splitting

Install React Router if you haven't already:

```bash
npm install react-router-dom
```

Create `src/components/AppWithRoutes.jsx`:

```jsx
import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

const HomePage = lazy(() => import('../pages/HomePage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));

function PageSkeleton() {
  return (
    <div style={{ padding: 20 }}>
      <div style={{ height: 40, background: '#f0f0f0', marginBottom: 16, borderRadius: 4 }} />
      <div style={{ height: 200, background: '#f0f0f0', borderRadius: 4 }} />
    </div>
  );
}

export function AppWithRoutes() {
  return (
    <BrowserRouter>
      <nav style={{ padding: '8px 16px', borderBottom: '1px solid #eee', display: 'flex', gap: 16 }}>
        <Link to="/">Home</Link>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/settings">Settings</Link>
      </nav>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
```

Navigate to Dashboard. Watch the Network tab — `DashboardPage`'s chunk downloads. Navigate to Settings — another chunk downloads. Navigate back to Dashboard — no new download (browser cached it).

---

### Step 4 — Named exports with lazy

`React.lazy` requires a **default export**. For components that use named exports:

```jsx
// If HeavyChart used a named export:
// export function HeavyChart() { ... }

// Wrap it to provide a default:
const HeavyChartFromNamed = lazy(() =>
  import('./HeavyChart').then(module => ({
    default: module.HeavyChart  // rename named export to default
  }))
);
```

Or restructure: give each lazily-loaded component its own file with a default export (the pattern used in Step 2). This is cleaner and the recommended approach.

---

### Step 5 — Wrap with ErrorBoundary

Network failures and chunk load errors are real. Without an error boundary, a failed chunk load crashes the entire app.

Add this to `src/components/LazyDemo.jsx`:

```jsx
class ChunkErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('Chunk failed to load:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, border: '1px solid #f00', borderRadius: 4 }}>
          <p>Failed to load this section.</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Usage — always wrap Suspense with ErrorBoundary
export function DashboardSafe() {
  const [showChart, setShowChart] = useState(false);
  return (
    <div style={{ padding: 16 }}>
      <button onClick={() => setShowChart(true)}>Show Chart (with error handling)</button>
      {showChart && (
        <ChunkErrorBoundary>
          <Suspense fallback={<div>Loading chart...</div>}>
            <HeavyChart />
          </Suspense>
        </ChunkErrorBoundary>
      )}
    </div>
  );
}
```

---

### Step 6 — Preload for instant navigation

```jsx
// Preload function — start downloading before the user navigates
const preloadDashboard = () => import('../pages/DashboardPage');

export function NavBarWithPreload() {
  return (
    <nav style={{ display: 'flex', gap: 16, padding: 8 }}>
      {/* Preload on hover — by the time user clicks, chunk is ready */}
      <a
        href="/dashboard"
        onMouseEnter={preloadDashboard}
        onFocus={preloadDashboard}
      >
        Dashboard
      </a>
    </nav>
  );
}
```

Hover over the Dashboard link. Check the Network tab — the chunk starts downloading immediately. By the time you click, the chunk is cached and navigation feels instant.

---

## What To Observe

- Network tab: separate `.js` chunk files downloaded when components are needed
- Initial page load: smaller (only the needed code)
- Suspense fallback: shows while chunk downloads
- After first load: chunk is cached by the browser — navigation instant on subsequent visits
- ErrorBoundary: needed if you throttle network to "Offline" to simulate a chunk failure

---

## Internal React Explanation

### Dynamic import() mechanics

`import('./Component')` is built into modern bundlers. When Vite/Webpack sees it:

1. Creates a separate output chunk for `./Component` and its dependencies
2. Replaces the `import()` with code that fetches the chunk via fetch when called
3. Returns a Promise that resolves to the module's exports

### How React.lazy works

`React.lazy(() => import('./Component'))` returns a "lazy component" that:

1. On first render, checks if the chunk has loaded
2. If not loaded: throws a Promise (the pending import)
3. React catches the thrown Promise (this is the Suspense mechanism)
4. Shows the nearest `Suspense` fallback while waiting
5. When the Promise resolves (chunk loaded), React retries the render
6. If the chunk is already loaded: renders normally

### Suspense's "throw a Promise" mechanism

React checks if a component's rendering threw a Promise. If yes:
- Mark this render tree as "suspended"
- Walk up to the nearest `<Suspense>` boundary
- Render the `fallback` prop instead of the children
- Subscribe to the Promise
- When Promise resolves, re-render the suspended tree

### Bundle splitting strategy

Optimal split points:
1. **Routes**: each page is a chunk (most common)
2. **Heavy libraries**: chart libraries, PDF renderers, video players
3. **User-role-specific**: admin panel, power user features
4. **Below-the-fold content**: tabs, modals, drawer content

Don't split:
- Common UI components (buttons, inputs) — too small, overhead exceeds benefit
- Utilities used everywhere — would be in every chunk anyway

---

## Optimization Challenge

**Challenge 1:** Measure your app's bundle size before and after route-level code splitting. Use `npm run build` and `npx source-map-explorer 'dist/assets/*.js'` (Vite) to visualize.

**Challenge 2:** Build a modal component that's only loaded when the user clicks "Open Modal." Use lazy + Suspense. The button renders immediately; the modal's code loads on demand.

**Challenge 3:** Implement prefetching for a navigation menu where hovering any link preloads that route's chunk.

**Challenge 4:** Build a settings page with tabs (General, Security, Billing). Lazy load each tab's content separately. Show a skeleton when loading.

---

## Common Mistakes

**Mistake 1: Lazy loading small components**

Lazy loading has overhead: a network request for the chunk + a render cycle for the fallback. For components < 20KB gzipped, the overhead may exceed the benefit. Focus on components > 50KB.

**Mistake 2: No error boundary around Suspense**

A chunk load failure (network error, deploy during session) causes an unhandled error that crashes the app. Always wrap `Suspense` with an `ErrorBoundary`.

**Mistake 3: Lazy loading everything blindly**

Too many lazy chunks create many small network requests. Split at logical boundaries (routes, major features).

**Mistake 4: Using lazy inside component functions**

```jsx
// BAD — lazy component is recreated on every render
function Component() {
  const LazyModal = lazy(() => import('./Modal')); // new lazy on every render!
  return <LazyModal />;
}

// GOOD — define at module level, stable reference
const LazyModal = lazy(() => import('./Modal'));
```

**Mistake 5: No fallback that matches component dimensions**

A fallback that's 1px tall replaced by a 600px component causes layout shift (CLS). Use skeleton screens that match the expected content size.

---

## Interview Questions

1. What is code splitting and why does it matter?
2. How does `React.lazy` work internally?
3. How does `Suspense` know to show the fallback?
4. What is the "throw a Promise" mechanism?
5. What happens if a lazy-loaded chunk fails to load?
6. What are good split points for code splitting?
7. How do you preload a lazy component before the user navigates?
8. Why must `React.lazy` use default exports?
9. What is the performance cost of code splitting itself?
10. How do you name your chunks for better debugging?

---

## Interview Answers

**1. Code splitting and why it matters?**
Breaking the JavaScript bundle into multiple smaller files that are downloaded on demand. Reduces initial bundle size → faster Time to Interactive → better user experience, especially on mobile and slow connections.

**2. React.lazy internally?**
Returns a special component type. On first render, React checks if the Promise (dynamic import) is resolved. If not: throws the Promise. React catches it, shows Suspense fallback, waits for resolution. On resolution: retries render.

**3. How Suspense knows to show fallback?**
React components throw Promises during the render phase. React catches any thrown Promise, finds the nearest Suspense boundary ancestor, renders its fallback instead of the children.

**4. Throw a Promise mechanism?**
An internal React protocol. During render, a component calls `throw somePromise` instead of returning JSX. React's reconciler catches this, marks the subtree as "suspended," and attaches a "retry when resolved" callback to the Promise.

**5. Chunk load failure?**
The dynamic import's Promise rejects. Suspense doesn't catch rejections — they propagate as errors, caught by the nearest `ErrorBoundary`. Without an error boundary, it crashes the app.

**6. Good split points?**
Routes (each page), heavy third-party libraries (charts, video, PDF), user-role-specific features (admin panel), modals/drawers that not all users open.

**7. Preloading before navigation?**
Call the dynamic import function directly: `const preload = () => import('./Dashboard')`. Attach to `onMouseEnter` or `onFocus` of the navigation link.

**8. Why default exports?**
`React.lazy(factory)` expects the factory to return a Promise that resolves to `{ default: Component }`. For named exports, use `.then(module => ({ default: module.NamedExport }))`.

**9. Cost of code splitting?**
Additional HTTP requests on first navigation to each chunk. Extra latency if chunks aren't preloaded (user sees Suspense fallback briefly). Browser caching mitigates this after first visit.

**10. Name your chunks?**
Use dynamic import comments (Webpack): `import(/* webpackChunkName: "dashboard" */ './pages/Dashboard')`. For Vite, component names are used automatically in the output filename.

---

## Senior-Level Thinking

**TTI vs bundle size: the real metric.**

Don't optimize bundle size for its own sake — optimize for Time to Interactive (TTI) and Largest Contentful Paint (LCP). These are Core Web Vitals that affect SEO and user experience.

**Granular splitting strategy:**

1. Start with route-level splitting (biggest gains)
2. Profile the initial bundle — find the largest modules
3. Lazy load any module > 50KB that isn't needed immediately
4. Add preloading to navigation hover
5. Measure TTI improvement with Lighthouse

---

## Revision Notes

- `React.lazy(() => import('./Component'))` = creates a lazy component + separate chunk
- `Suspense fallback={<Loading />}` = shows while chunk downloads
- Requires default export (or `.then(m => ({ default: m.Named }))` for named)
- Always wrap with ErrorBoundary for chunk load failures
- Create the lazily-loaded component files before writing the lazy import
- Route-level splitting = biggest impact (largest chunks)
- Preload: call `import('./Page')` on hover/focus to warm up the cache
- Define lazy at module level, not inside component functions

---

## Next Day Preview

**Day 24 — Suspense UX Patterns**

Avoiding flash of fallback content. Nested Suspense for progressive loading. Using `startTransition` with Suspense to hold the old UI until new is ready. Skeleton screens vs spinners vs delayed fallbacks.
