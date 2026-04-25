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

### Step 2 — Lazy load a heavy component

```jsx
import { lazy, Suspense } from 'react';

// Without lazy: imported and bundled immediately
// import HeavyChart from './HeavyChart';

// With lazy: creates a separate bundle chunk, loaded on first render
const HeavyChart = lazy(() => import('./HeavyChart'));

function Dashboard() {
  const [showChart, setShowChart] = useState(false);

  return (
    <div>
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

The first time `showChart` becomes `true`, React fetches `HeavyChart`'s chunk from the server. During the fetch, `<div>Loading chart...</div>` renders. After the chunk loads, `HeavyChart` renders.

### Step 3 — Route-level splitting

```jsx
const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));

function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </Suspense>
  );
}

function PageSkeleton() {
  return (
    <div style={{ padding: 20 }}>
      <div style={{ height: 40, background: '#f0f0f0', marginBottom: 16 }} />
      <div style={{ height: 200, background: '#f0f0f0' }} />
    </div>
  );
}
```

Each route is a separate chunk. Navigate to Dashboard → download `Dashboard.chunk.js`. Navigate to Settings → download `Settings.chunk.js`. The initial page load only downloads `Home` and the app shell.

### Step 4 — Named exports with lazy

`React.lazy` requires a default export. For named exports:

```jsx
// HeavyComponent.jsx
export function HeavyChart() { /* ... */ }
export function HeavyTable() { /* ... */ }

// Usage with named export
const HeavyChart = lazy(() =>
  import('./HeavyComponent').then(module => ({
    default: module.HeavyChart
  }))
);
```

Or restructure your exports:

```jsx
// HeavyChart.jsx — separate file with default export
export default function HeavyChart() { /* ... */ }
```

### Step 5 — Wrap with ErrorBoundary

Network failures and chunk load errors are real. Without an error boundary, a failed chunk load crashes the entire app.

```jsx
class ChunkErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    // Could be a chunk load failure (network error)
    console.error('Chunk failed to load:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <p>Failed to load this section.</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Usage
<ChunkErrorBoundary>
  <Suspense fallback={<Loading />}>
    <HeavyChart />
  </Suspense>
</ChunkErrorBoundary>
```

### Step 6 — Preload for instant navigation

```jsx
// Preload function — start downloading before the user navigates
const preloadDashboard = () => import('./pages/Dashboard');

function NavBar() {
  return (
    <nav>
      {/* Preload on hover — by the time user clicks, chunk is ready */}
      <Link
        to="/dashboard"
        onMouseEnter={preloadDashboard}
        onFocus={preloadDashboard}
      >
        Dashboard
      </Link>
    </nav>
  );
}
```

`import('./pages/Dashboard')` on hover starts the download. By the time the user clicks, the chunk is loaded — the navigation feels instant.

---

## What To Observe

- Network tab: separate `.chunk.js` files downloaded when components are needed
- Initial page load: smaller, faster (only the needed code)
- Suspense fallback: shows while chunk downloads
- After first load: chunk is cached by the browser — navigation instant on subsequent visits
- Bundle analyzer (`npm run build && npx source-map-explorer build/static/js/*.js`): see chunk sizes

---

## Internal React Explanation

### Dynamic import() mechanics

`import('./Component')` is a TC39 proposal built into modern bundlers. When Webpack/Vite sees it, it:

1. Creates a separate output chunk for `./Component` and its dependencies
2. Replaces the `import()` with code that fetches the chunk via XHR/fetch when called
3. Returns a Promise that resolves to the module's exports

The chunk is a separate JS file on the server. The browser downloads and executes it on demand.

### How React.lazy works

`React.lazy(() => import('./Component'))` returns a "lazy component" — a special React component type that:

1. On first render, checks if the chunk has loaded
2. If not loaded: throws a Promise (the pending import)
3. React catches the thrown Promise (this is the Suspense mechanism)
4. Shows the nearest `Suspense` fallback while waiting
5. When the Promise resolves (chunk loaded), React retries the render
6. If the chunk is already loaded: renders normally

### Suspense's "throw a Promise" mechanism

This is the underlying mechanism: React checks if a component's rendering threw a Promise. If yes:

- Mark this render tree as "suspended"
- Walk up to the nearest `<Suspense>` boundary
- Render the `fallback` prop instead of the children
- Subscribe to the Promise
- When Promise resolves, re-render the suspended tree

This pattern is called "algebraic effects" by React team. Components communicate the "loading" state by throwing, not by returning early or having a loading prop.

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

**Challenge 1:** Measure your app's bundle size before and after route-level code splitting. Use `npm run build` and `source-map-explorer` to visualize.

**Challenge 2:** Build a modal component that's only loaded when the user clicks "Open Modal." Use lazy + Suspense. The button renders immediately; the modal's code loads on demand.

**Challenge 3:** Implement prefetching for a navigation menu where hovering any link preloads that route's chunk.

**Challenge 4:** Build a settings page with tabs (General, Security, Billing). Lazy load each tab's content separately. Show a skeleton when loading.

---

## Why This Optimization Works

Initial bundle size directly affects Time to Interactive (TTI) — the metric measuring when the page is usable. Halving the bundle size roughly halves TTI on slow connections.

Code splitting works because:
- Browsers can parallelize chunk downloads
- Chunks are cached after first load (navigation feels instant on revisit)
- Users only download code for features they actually use

---

## Common Mistakes

**Mistake 1: Lazy loading small components**

Lazy loading has overhead: a network request for the chunk + a render cycle for the fallback. For components < 20KB gzipped, the overhead may exceed the benefit. Focus on components > 50KB.

**Mistake 2: No error boundary around Suspense**

A chunk load failure (network error, deploy during session) causes an unhandled error that crashes the app. Always wrap `Suspense` with an `ErrorBoundary`.

**Mistake 3: Lazy loading everything blindly**

Too many lazy chunks create many small network requests. Bundler can create smart chunks (shared vendor chunks, common code), but over-splitting defeats this. Split at logical boundaries (routes, major features).

**Mistake 4: Using lazy inside conditional renders without mounting once**

```jsx
// BAD — lazy component is defined inside a function call, recreated on every render
function Component() {
  const LazyModal = lazy(() => import('./Modal')); // new lazy on every render!
  return <LazyModal />;
}

// GOOD — define at module level, stable reference
const LazyModal = lazy(() => import('./Modal'));
```

Defining lazy inside a component body causes the component to be treated as new on every render — remounts.

**Mistake 5: No fallback that matches component dimensions**

A fallback that's 1px tall and then replaced by a 600px component causes layout shift (CLS). Use skeleton screens that approximately match the expected content size.

---

## Debugging Tools

### Network tab

In DevTools Network tab, filter by "JS". Clicking a lazy-loaded feature shows new chunk downloads with names like `2.chunk.js` or `Dashboard.chunk.js` (with code splitting names configured).

### Bundle analyzer

```bash
npm install --save-dev source-map-explorer
npm run build
npx source-map-explorer 'build/static/js/*.js'
```

Shows a treemap of every module in every bundle. Identify large dependencies.

### React Profiler

Record a navigation to a lazy-loaded page. The Suspense fallback shows as a separate commit in the profiler. The actual component renders in the next commit after the chunk loads.

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
Breaking the JavaScript bundle into multiple smaller files that are downloaded on demand. Reduces initial bundle size → faster Time to Interactive → better user experience, especially on mobile and slow connections. Users don't download code for features they haven't accessed.

**2. React.lazy internally?**
Returns a special component type. On first render, React checks if the Promise (dynamic import) is resolved. If not: throws the Promise. React catches it, shows Suspense fallback, waits for resolution. On resolution: retries render. If resolved: renders the component normally.

**3. How Suspense knows to show fallback?**
React components throw Promises during the render phase. React catches any thrown Promise, finds the nearest Suspense boundary ancestor, renders its fallback instead of the children. When the Promise resolves, the children are re-rendered.

**4. Throw a Promise mechanism?**
An internal React protocol. During render, a component calls `throw somePromise` instead of returning JSX. React's reconciler catches this, marks the subtree as "suspended," and attaches a "retry when resolved" callback to the Promise. When the Promise resolves, React re-renders the suspended subtree.

**5. Chunk load failure?**
The dynamic import's Promise rejects. React's Suspense mechanism doesn't catch rejections — they propagate as errors, caught by the nearest `ErrorBoundary`. Without an error boundary, it crashes the app. Always pair `<Suspense>` with `<ErrorBoundary>`.

**6. Good split points?**
Routes (each page), heavy third-party libraries (charts, video, PDF), user-role-specific features (admin panel), modals/drawers that not all users open, large feature sections (not small UI atoms).

**7. Preloading before navigation?**
Call the dynamic import function directly: `const preload = () => import('./Dashboard')`. Attach to `onMouseEnter` or `onFocus` of the navigation link. The browser downloads the chunk while the user is hovering — by click time, it's ready.

**8. Why default exports?**
`React.lazy(factory)` expects the factory to return a Promise that resolves to `{ default: Component }`. This matches a module's default export. For named exports, use `.then(module => ({ default: module.NamedExport }))` to shape the module correctly.

**9. Cost of code splitting?**
Additional HTTP requests on first navigation to each chunk. Extra latency if chunks aren't preloaded (user sees Suspense fallback briefly). Browser caching mitigates this after first visit. The benefit (smaller initial bundle) typically far outweighs the cost for non-trivial apps.

**10. Name your chunks?**
Use dynamic import magic comments (Webpack): `import(/* webpackChunkName: "dashboard" */ './pages/Dashboard')`. Creates `dashboard.chunk.js` in the build output. Makes debugging and network analysis much easier.

---

## Senior-Level Thinking

**TTI vs bundle size: the real metric.**

Don't optimize bundle size for its own sake — optimize for Time to Interactive (TTI) and Largest Contentful Paint (LCP). These are Core Web Vitals that affect SEO and user experience. Lighthouse measures them. A 100KB reduction in initial bundle size translates to real seconds saved on 3G connections.

**React Server Components as the future.**

React Server Components (Next.js App Router) take code splitting further: components run on the server and send only HTML to the client. No client-side JavaScript download at all for server-only components. This makes `React.lazy` less necessary in Next.js App Router apps — but the concept of "don't send what you don't need" is universal.

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
- Route-level splitting = biggest impact (largest chunks)
- Preload: call `import('./Page')` on hover/focus to warm up the cache
- Define lazy at module level, not inside component functions

---

## Next Day Preview

**Day 24 — Suspense UX Patterns**

Avoiding flash of fallback content. Nested Suspense for progressive loading. Using `startTransition` with Suspense to hold the old UI until new is ready. Skeleton screens vs spinners vs delayed fallbacks.
