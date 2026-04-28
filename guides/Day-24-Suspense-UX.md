# Day 24 — Suspense UX Patterns

## Objective

Move beyond basic Suspense to understand how to design great loading experiences: avoiding layout shift, preventing flash-of-fallback for fast loads, nested Suspense for progressive loading, and using `startTransition` to hold the current UI until new content is ready.

---

## Real World Importance

- Fast connections: user shouldn't see a spinner for 50ms then content — that's worse than instant
- Slow connections: user needs progressive disclosure — header loads first, then content
- Navigation: current page should stay visible while the next page loads
- Multi-part pages: each section can load independently without blocking the whole page
- Forms: submission state with optimistic UI

---

## Concepts Covered

- Flash of fallback content (FOFC) and how to prevent it
- Delayed fallback: only show spinner after N ms
- `startTransition` + Suspense: hold old UI during navigation
- Nested Suspense: progressive loading per section
- Skeleton screens vs spinners
- `useTransition` + Suspense boundary interactions
- Content layout shift (CLS) and how Suspense affects it

---

## Exercise Task

### Setup — Before you start

**1. Add CSS animation to `src/index.css`:**

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

**2. Create `src/components/FastComponent.jsx`** — a simple component to demonstrate the FOFC problem:

```jsx
// src/components/FastComponent.jsx
export default function FastComponent() {
  return (
    <div style={{ padding: 16, background: '#f0fff0', border: '1px solid #0a0', borderRadius: 4 }}>
      <h3>Fast Component</h3>
      <p>This component loaded quickly!</p>
    </div>
  );
}
```

**3. Reuse page files from Day 23.** Steps 3 and 4 use `HomePage` and `DashboardPage`. These were created in Day 23 (`src/pages/`). If you skipped Day 23, create minimal versions now:

```jsx
// src/pages/HomePage.jsx
export default function HomePage() {
  return <div style={{ padding: 20 }}><h2>Home Page</h2></div>;
}

// src/pages/DashboardPage.jsx
export default function DashboardPage() {
  return <div style={{ padding: 20 }}><h2>Dashboard</h2></div>;
}
```

**4. Create `src/components/SuspenseUXDemo.jsx`** with these imports:

```jsx
import React, { lazy, Suspense, useState, useEffect, useTransition } from 'react';
```

**5. Define a `Spinner` component** at the top of `SuspenseUXDemo.jsx` (used throughout):

```jsx
function Spinner() {
  return <div style={{ padding: 8, color: '#888' }}>Loading...</div>;
}
```

**6. Define a `PageLoading` component** (used in Step 3):

```jsx
function PageLoading() {
  return (
    <div style={{ padding: 20 }}>
      <div style={{ height: 40, background: '#f0f0f0', marginBottom: 16, borderRadius: 4 }} />
      <div style={{ height: 200, background: '#f0f0f0', borderRadius: 4 }} />
    </div>
  );
}
```

---

### Step 1 — The FOFC problem

Add this to `SuspenseUXDemo.jsx`. Note: the `setTimeout` wrapper artificially delays the import by 50ms to simulate a fast load. `FastComponent.jsx` itself is not slow — the delay is in the lazy wrapper.

```jsx
const FastComponentLazy = lazy(() =>
  new Promise(resolve => setTimeout(() => resolve(import('./FastComponent')), 50))
);

export function FOFCDemo() {
  const [show, setShow] = useState(false);
  return (
    <div style={{ padding: 16 }}>
      <button onClick={() => setShow(true)}>Show Fast Component</button>
      {show && (
        <Suspense fallback={<Spinner />}>
          <FastComponentLazy />
        </Suspense>
      )}
    </div>
  );
}
```

Click "Show Fast Component." You'll see "Loading..." flash briefly before the component appears. For a 50ms load, this spinner flash is worse than showing nothing — it creates an unnecessary visual pop.

### Step 2 — Delayed fallback

Replace the `FOFCDemo` export (or add a new export) in `SuspenseUXDemo.jsx`:

```jsx
function DelayedFallback({ delay = 300, fallback, children }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <Suspense fallback={show ? fallback : null}>
      {children}
    </Suspense>
  );
}

export function DelayedFallbackDemo() {
  const [show, setShow] = useState(false);
  return (
    <div style={{ padding: 16 }}>
      <button onClick={() => setShow(true)}>Show (with delayed fallback)</button>
      {show && (
        <DelayedFallback delay={300} fallback={<Spinner />}>
          <FastComponentLazy />
        </DelayedFallback>
      )}
    </div>
  );
}
```

Click the button. If the component loads within 300ms: no spinner ever shows. If it takes longer: spinner appears at 300ms.

**Alternative: CSS approach** (no `useState`/`useEffect` needed — add to `SuspenseUXDemo.jsx`):

```jsx
function FadeInFallback({ children }) {
  return (
    <Suspense fallback={
      <div style={{
        animation: 'fadeIn 0.3s ease 0.3s both', // 300ms delay before appearing
      }}>
        <Spinner />
      </div>
    }>
      {children}
    </Suspense>
  );
}
```

The `animation-fill-mode: both` + `animation-delay: 0.3s` means the spinner is invisible for 300ms, then fades in. If the component loads in < 300ms, the spinner never becomes visible.

### Step 3 — startTransition + Suspense (hold old UI)

Add this to `SuspenseUXDemo.jsx`. It uses `HomePage` and `DashboardPage` from Day 23 (import them):

```jsx
import { lazy, Suspense, useState, useTransition } from 'react';

const HomePage = lazy(() => import('../pages/HomePage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));

// Without transition — shows fallback immediately on navigate
export function NavigationWithoutTransition() {
  const [page, setPage] = useState('home');

  return (
    <div>
      <nav style={{ display: 'flex', gap: 8, padding: 8, borderBottom: '1px solid #eee' }}>
        <button onClick={() => setPage('home')}>Home</button>
        <button onClick={() => setPage('dashboard')}>Dashboard</button>
      </nav>
      <Suspense fallback={<PageLoading />}>
        {page === 'home' && <HomePage />}
        {page === 'dashboard' && <DashboardPage />}
      </Suspense>
    </div>
  );
}

// With transition — old page stays visible while new page loads
export function NavigationWithTransition() {
  const [page, setPage] = useState('home');
  const [isPending, startTransition] = useTransition();

  const navigate = (nextPage) => {
    startTransition(() => setPage(nextPage));
  };

  return (
    <div>
      <nav style={{ display: 'flex', gap: 8, padding: 8, borderBottom: '1px solid #eee' }}>
        <button onClick={() => navigate('home')}>Home</button>
        <button onClick={() => navigate('dashboard')} disabled={isPending}>
          Dashboard {isPending && '...'}
        </button>
      </nav>

      {/* Old page stays visible while new page loads */}
      <div style={{ opacity: isPending ? 0.7 : 1, transition: 'opacity 0.2s' }}>
        <Suspense fallback={null}> {/* No fallback needed — old UI shows instead */}
          {page === 'home' && <HomePage />}
          {page === 'dashboard' && <DashboardPage />}
        </Suspense>
      </div>
    </div>
  );
}
```

Compare `NavigationWithoutTransition` vs `NavigationWithTransition`: in the first, clicking Dashboard immediately replaces the Home page with `PageLoading`. In the second, Home stays visible (slightly dimmed) until Dashboard is ready.

### Step 4 — Nested Suspense for progressive loading

This step shows the architectural pattern. Create minimal stub components first, then wrap them in separate Suspense boundaries:

```jsx
// Minimal stubs — add to SuspenseUXDemo.jsx
function DashboardHeader() {
  return <h2 style={{ padding: 16 }}>Dashboard Header (loaded immediately)</h2>;
}

function StatsSkeleton() {
  return <div style={{ height: 80, background: '#f0f0f0', margin: 16, borderRadius: 4 }} />;
}

function ChartSkeleton() {
  return <div style={{ height: 200, background: '#f0f0f0', margin: 16, borderRadius: 4 }} />;
}

function ActivitySkeleton() {
  return <div style={{ height: 120, background: '#f0f0f0', margin: 16, borderRadius: 4 }} />;
}

// Simulate lazy-loaded sections with artificial delays
const DashboardStats = lazy(() =>
  new Promise(resolve => setTimeout(() => resolve({
    default: () => <div style={{ padding: 16, background: '#e8f5e9', margin: 16, borderRadius: 4 }}>Stats loaded!</div>
  }), 800))
);

const DashboardChart = lazy(() =>
  new Promise(resolve => setTimeout(() => resolve({
    default: () => <div style={{ padding: 16, background: '#e3f2fd', margin: 16, borderRadius: 4 }}>Chart loaded!</div>
  }), 1500))
);

const RecentActivity = lazy(() =>
  new Promise(resolve => setTimeout(() => resolve({
    default: () => <div style={{ padding: 16, background: '#fff3e0', margin: 16, borderRadius: 4 }}>Activity loaded!</div>
  }), 600))
);

export function ProgressiveDashboard() {
  return (
    <div>
      {/* Header loads immediately (not lazy) */}
      <DashboardHeader />

      {/* Each section loads independently */}
      <Suspense fallback={<StatsSkeleton />}>
        <DashboardStats />
      </Suspense>

      <Suspense fallback={<ChartSkeleton />}>
        <DashboardChart />
      </Suspense>

      <Suspense fallback={<ActivitySkeleton />}>
        <RecentActivity />
      </Suspense>
    </div>
  );
}
```

Observe: Header appears immediately. Stats, Chart, Activity each show their skeleton while loading, then reveal progressively. The page never shows a blank full-page spinner.

### Step 5 — Skeleton screens

Add to `SuspenseUXDemo.jsx`:

```jsx
function ProductCardSkeleton() {
  return (
    <div style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{
        width: '100%',
        height: 200,
        background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }} />
      <div style={{ padding: 12 }}>
        <div style={{ height: 20, background: '#f0f0f0', marginBottom: 8, width: '80%', borderRadius: 4 }} />
        <div style={{ height: 16, background: '#f0f0f0', width: '60%', borderRadius: 4 }} />
      </div>
    </div>
  );
}
```

Add to `src/index.css`:

```css
@keyframes shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}
```

The skeleton has the same dimensions as the actual content — **no layout shift** when content appears.

---

## What To Observe

- Fast load (<300ms): DelayedFallback shows nothing, content appears directly
- Slow load (>300ms): spinner appears at 300ms mark, disappears when content loads
- startTransition + Suspense: old page stays while new page loads
- Nested Suspense: sections load progressively, no full-page blank state
- Skeleton dimensions matching content: zero layout shift (CLS = 0)

---

## Internal React Explanation

### How startTransition prevents Suspense fallback

When a state update wrapped in `startTransition` causes a Suspense boundary to suspend, React's behavior is:

**Without transition**: Immediately hide children, show fallback
**With transition**: Keep old children visible (they're still committed), render new children in a concurrent "background" pass. When the new children finish loading and rendering, swap atomically.

This is why `startTransition` + Suspense is the correct pattern for navigating between Suspense boundaries — you get "hold-until-ready" behavior instead of flash-of-fallback.

### The Suspense boundary waterfall

A common mistake: nesting Suspense boundaries where each waits for the previous:

```jsx
// Waterfall: Stats must resolve before Chart starts loading
<Suspense fallback={<StatsSkeleton />}>
  <DashboardStats />  {/* When this resolves... */}
  <Suspense fallback={<ChartSkeleton />}>
    <DashboardChart />  {/* ...this starts loading */}
  </Suspense>
</Suspense>
```

Fix: make boundaries siblings, not nested:

```jsx
// Parallel: Stats and Chart load concurrently
<>
  <Suspense fallback={<StatsSkeleton />}>
    <DashboardStats />
  </Suspense>
  <Suspense fallback={<ChartSkeleton />}>
    <DashboardChart />
  </Suspense>
</>
```

Both start loading simultaneously. Total time = max(stats time, chart time), not stats + chart.

### Content Layout Shift (CLS)

CLS is a Core Web Vital measuring how much the page layout shifts during loading. A spinner that's 20px tall replaced by a 400px component causes a 380px layout shift — hurting CLS score.

Skeleton screens that match content dimensions = CLS ≈ 0.

---

## Optimization Challenge

**Challenge 1:** Build a product listing page with:
- Immediate header and search bar
- Suspense for the product grid (skeleton fallback)
- Suspense for filters sidebar (skeleton fallback)
- Measure CLS with Lighthouse — it should be 0

**Challenge 2:** Build a navigation where clicking any link:
- Keeps current page visible with `isPending` opacity effect
- Shows loading indicator in the nav bar (not a full-page spinner)
- New page appears atomically when ready

**Challenge 3:** Build a multi-step wizard form where each step is lazy-loaded. Validate that step 2 starts preloading when step 1 loads.

---

## Common Mistakes

**Mistake 1: Single Suspense at the app root**

```jsx
<Suspense fallback={<FullPageSpinner />}>
  <App />
</Suspense>
```

Any suspending child shows a full-page spinner. Users see a blank page during any load. Use nested Suspense for granular loading states.

**Mistake 2: No Suspense fallback dimensions**

A 0px fallback replaced by 500px content = major layout shift. Match skeleton dimensions to content.

**Mistake 3: Using startTransition for non-Suspense transitions**

`startTransition` + Suspense is specifically valuable because React holds the old UI. For transitions that don't involve Suspense, transitions are useful for render priority but don't prevent fallback display.

**Mistake 4: Waterfall Suspense boundaries**

Nested Suspense boundaries load sequentially. Sibling Suspense boundaries load in parallel. Structure your Suspense hierarchy to maximize parallelism.

**Mistake 5: Showing spinners for fast operations**

Users perceive UI changes <100ms as instant. A spinner that shows for <200ms creates cognitive load without providing information. Use the delayed fallback pattern for everything.

---

## Debugging Tools

### Throttle network in DevTools

Network tab → No throttling → "Slow 3G". Test Suspense fallbacks with realistic loading times. Check:
- Does the fallback show dimensions matching content?
- Does the transition feel smooth?
- Any layout shifts?

### Lighthouse CLS

Run Lighthouse (in DevTools Audits tab) and check "Cumulative Layout Shift" score. Should be < 0.1 for "Good." Suspense fallbacks that don't match content size will hurt this score.

### React DevTools Profiler

Watch the commit timeline during a Suspense load. You'll see:
- Initial render with fallback
- Chunk loads (network request)
- Re-render that commits the actual content

---

## Interview Questions

1. What is FOFC (Flash of Fallback Content) and why is it bad?
2. How do you prevent showing a spinner for fast-loading content?
3. How does `startTransition` interact with Suspense?
4. What is the difference between nested and sibling Suspense boundaries?
5. What is Cumulative Layout Shift and how does Suspense affect it?
6. What should fallback dimensions match and why?
7. When is a full-page spinner appropriate?
8. What is the Suspense waterfall problem?
9. How do you implement progressive loading with nested Suspense?
10. What makes a good skeleton screen?

---

## Interview Answers

**1. FOFC?**
When content loads quickly (< 300ms), showing a spinner/fallback and then immediately replacing it creates a visual flash that's more jarring than if nothing had shown at all. Users perceive it as "something jumped." Only show fallbacks if loading takes long enough to be perceived as a wait.

**2. Prevent spinner for fast content?**
Delayed fallback: only show the fallback after N ms (e.g., 300ms). If content loads in < 300ms, the fallback never renders. CSS approach: `animation-delay: 0.3s` with `animation-fill-mode: both` on the fallback. Or React approach: a wrapper that delays setting the fallback.

**3. startTransition + Suspense?**
Without transition: Suspense immediately replaces old content with fallback when new content suspends. With `startTransition`: React marks the state update as non-urgent, keeps old content visible ("deferred"), renders new content concurrently in the background. Old content shows until new content is ready. New content replaces old atomically. No fallback flash.

**4. Nested vs sibling Suspense boundaries?**
Nested: inner boundary suspends, outer boundary's fallback can show if inner has no fallback. Also: when inner resolves, it may suspend the parent if they share a tree. Sibling: completely independent suspension. Sibling boundaries load in parallel — start downloading at the same time. Prefer sibling for parallel loading of independent sections.

**5. CLS and Suspense?**
Cumulative Layout Shift measures how much page content shifts position during loading. If a Suspense fallback is small (e.g., a 16px spinner) and the actual content is large (e.g., a 400px product grid), the page shifts by ~384px when content loads — high CLS, hurts Core Web Vitals and user experience.

**6. Fallback dimensions?**
Match the approximate dimensions of the content being loaded. Skeleton screens that match shape and size of real content result in CLS ≈ 0. The page doesn't shift when content appears.

**7. When full-page spinner is appropriate?**
Initial app load (before any content can render), full-page route transitions where skeleton content would be meaningless, operations where the user explicitly triggered a blocking action (form submit that navigates). In most other cases, partial/progressive loading is better.

**8. Suspense waterfall?**
When Suspense boundaries are nested, inner boundaries can't start loading until the outer boundary resolves. This creates a sequential waterfall: A loads → A resolves → B starts loading → B resolves → C starts loading. Solution: make boundaries siblings so they load in parallel.

**9. Progressive loading with nested Suspense?**
Wrap independent sections in separate Suspense boundaries at the same level (siblings). Each section shows its own skeleton and resolves independently. Header loads first (not lazy), stats/chart/activity each load with their own fallback. Users see progressive disclosure — something is always visible and improving.

**10. Good skeleton screen?**
Approximate same dimensions as actual content (prevents layout shift). Animated shimmer to indicate "loading" (vs blank content). Structure mirrors the real content (card shape, text line placeholders). Doesn't distract — subtle animation, muted colors. Doesn't persist if content loads quickly (use delayed skeleton).

---

## Senior-Level Thinking

**Suspense + streaming (server side).**

React 18's `renderToPipeableStream` on the server enables HTML streaming with Suspense. The server sends HTML for the first Suspense boundary immediately, then streams HTML for suspended sections as they resolve. The user sees meaningful content before the entire page finishes server-side rendering. This is the Next.js App Router model.

**The "everything above the fold loads synchronously" principle.**

Content visible without scrolling should never be in a Suspense boundary that shows a spinner/skeleton. Critical above-the-fold content (hero, nav, headline) should load as part of the initial render. Put only below-the-fold, non-critical, heavy content in Suspense boundaries.

---

## Revision Notes

- FOFC: spinner flash for fast loads is worse than no spinner — use delayed fallback
- Delayed fallback: only show after 300ms (CSS delay or React timer)
- startTransition + Suspense: hold old UI while new content loads (no fallback flash)
- Nested Suspense: sections load sequentially (waterfall)
- Sibling Suspense: sections load in parallel (correct pattern)
- Skeleton = same dimensions as content = CLS ≈ 0
- Above-the-fold content: never in a Suspense boundary

---

## Next Day Preview

**Day 25 — State Locality**

The single most impactful architectural optimization: keeping state as close to where it's used as possible. Lifting state too high causes cascade rerenders. The "children as prop" pattern. How state locality eliminates the need for many memos.
