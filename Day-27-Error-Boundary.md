# Day 27 — Error Boundary

## Objective

Learn to catch runtime errors in React component subtrees using `ErrorBoundary` class components. A single unhandled render error crashes the entire React tree — error boundaries contain the damage to a specific subtree and display a graceful fallback instead of a blank screen.

---

## Real World Importance

- A broken widget on a dashboard shouldn't crash the whole app
- A failed lazy-loaded chunk should show a "retry" button, not a white screen
- Third-party components that throw should be caught before they reach the user
- Production apps need to log errors to a monitoring service (Sentry, Datadog) on every crash
- Multi-section pages: one section's data error shouldn't erase the entire page

---

## Concepts Covered

- Why only class components can be error boundaries
- `getDerivedStateFromError` — switches to fallback UI
- `componentDidCatch` — logs the error and component stack
- Where to place error boundaries (granularity)
- Resetting an error boundary after recovery
- Error boundaries do NOT catch: event handlers, async code, SSR errors, errors in the boundary itself
- Pairing error boundaries with `React.lazy` + `Suspense`

---

## Exercise Task

### Step 1 — The crashing child (the problem)

```jsx
function BrokenWidget({ shouldCrash }) {
  if (shouldCrash) {
    throw new Error('Widget failed to render!');
  }
  return <div>Widget is working fine.</div>;
}

function App() {
  const [crash, setCrash] = useState(false);

  return (
    <div>
      <h1>My App</h1>
      <button onClick={() => setCrash(true)}>Crash the widget</button>
      <BrokenWidget shouldCrash={crash} />
    </div>
  );
}
```

Click "Crash the widget." The entire app goes blank — React unmounts the whole tree. In development, an overlay shows the error. In production: white screen, no feedback.

### Step 2 — Build a basic ErrorBoundary

```jsx
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  // Called during render when a descendant throws
  // Return new state to trigger fallback UI
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  // Called after render with error info — use for logging
  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error);
    console.error('Component stack:', info.componentStack);
    // In production: logErrorToSentry(error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 4 }}>
          <h3>Something went wrong</h3>
          <p style={{ color: '#856404' }}>{this.state.error?.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// Wrap the crashing child
function App() {
  const [crash, setCrash] = useState(false);

  return (
    <div>
      <h1>My App</h1>
      <button onClick={() => setCrash(true)}>Crash the widget</button>
      <ErrorBoundary>
        <BrokenWidget shouldCrash={crash} />
      </ErrorBoundary>
    </div>
  );
}
```

Click "Crash the widget." The `<h1>` and button stay visible — only the widget subtree is replaced by the fallback. The app continues working.

### Step 3 — Add a reset mechanism

```jsx
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  reset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 4 }}>
          <h3>Something went wrong</h3>
          <p>{this.state.error?.message}</p>
          <button onClick={this.reset}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

Clicking "Try again" clears `hasError`, re-renders `children`. If the underlying error was transient (network glitch, race condition), the child renders normally on retry.

### Step 4 — Granular placement (multiple boundaries)

```jsx
function Dashboard() {
  return (
    <div>
      <Header /> {/* no boundary — if header crashes, we want to know */}

      <ErrorBoundary fallback={<StatsSkeleton />}>
        <StatsWidget />
      </ErrorBoundary>

      <ErrorBoundary fallback={<p>Chart unavailable.</p>}>
        <RevenueChart />
      </ErrorBoundary>

      <ErrorBoundary fallback={<p>Activity feed unavailable.</p>}>
        <ActivityFeed />
      </ErrorBoundary>
    </div>
  );
}
```

If `RevenueChart` crashes, `StatsWidget` and `ActivityFeed` remain visible. Granular boundaries = minimal blast radius.

### Step 5 — Accepting a custom fallback as a prop

```jsx
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.props.onError?.(error, info);
  }

  reset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div>
          <p>Something went wrong.</p>
          <button onClick={this.reset}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Usage with custom fallback
<ErrorBoundary
  fallback={<ChartErrorState />}
  onError={(err, info) => logToSentry(err, info)}
>
  <RevenueChart />
</ErrorBoundary>
```

### Step 6 — Pair with React.lazy for chunk load failures

```jsx
const HeavyPanel = lazy(() => import('./HeavyPanel'));

// Suspense shows fallback while loading
// ErrorBoundary catches if the chunk fails to load (network error)
<ErrorBoundary fallback={<p>Failed to load panel. <button onClick={() => window.location.reload()}>Reload</button></p>}>
  <Suspense fallback={<PanelSkeleton />}>
    <HeavyPanel />
  </Suspense>
</ErrorBoundary>
```

Two different failure modes, two different tools:
- Chunk loading (pending) → `Suspense` shows skeleton
- Chunk failed (network error) → `ErrorBoundary` shows retry

### Step 7 — What error boundaries do NOT catch

```jsx
function Component() {
  // NOT caught by ErrorBoundary — event handler errors are not render errors
  const handleClick = () => {
    throw new Error('Click error'); // crashes silently or goes to window.onerror
  };

  // NOT caught — async errors escape the render cycle
  useEffect(() => {
    fetch('/api/data').then(r => {
      if (!r.ok) throw new Error('Fetch failed'); // NOT caught
    });
  }, []);

  // IS caught — thrown synchronously during render
  throw new Error('Render error'); // ← ErrorBoundary catches this
}
```

For event handler errors: use try/catch inside the handler. For async errors: catch in the promise chain or use an error state (`setError(err)`).

---

## What To Observe

- Without boundary: crashing child takes down entire app (white screen)
- With boundary: only the wrapped subtree shows fallback, rest of app works
- Granular boundaries: each widget fails independently
- Reset: clicking "Try again" remounts the child — transient errors resolve
- `componentDidCatch` logs: component stack shows exactly which component threw
- `React.lazy` + boundary: chunk load failure shows a "reload" prompt, not a white screen

---

## Internal React Explanation

### Why class components only

Error boundaries require two lifecycle methods that have no hook equivalents:
- `getDerivedStateFromError` — called during the render phase (before commit) to update state synchronously
- `componentDidCatch` — called during the commit phase (after the DOM has been updated) to log

Hooks run after render; there's no way to interrupt the render phase and switch to a fallback mid-render using hooks. The React team has noted a future hook-based equivalent may come, but as of React 18 it requires a class.

### The render-phase catch mechanism

When a component throws during render:
1. React walks up the fiber tree looking for the nearest `ErrorBoundary` fiber
2. Invokes `getDerivedStateFromError(error)` → new state is merged
3. ErrorBoundary re-renders with `hasError: true` → renders fallback
4. After commit, `componentDidCatch(error, info)` is called for logging

This is why errors thrown in event handlers aren't caught — they happen outside the render phase, not in the fiber tree traversal.

### The `componentStack` in `info`

`info.componentStack` is a string showing the component tree from the error to the root:

```
at BrokenWidget (http://localhost:3000/static/js/main.js:42:10)
at ErrorBoundary
at Dashboard
at App
```

This is invaluable in production — it identifies exactly which component threw even when minified source maps aren't available.

---

## Optimization Challenge

**Challenge 1:** Build a `withErrorBoundary` higher-order component:

```jsx
// Usage:
const SafeChart = withErrorBoundary(RevenueChart, {
  fallback: <p>Chart failed.</p>,
  onError: (err) => logToSentry(err),
});

// Implementation:
function withErrorBoundary(Component, options = {}) {
  return function SafeComponent(props) {
    return (
      <ErrorBoundary fallback={options.fallback} onError={options.onError}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
```

**Challenge 2:** Build an `ErrorBoundary` that auto-resets when its `resetKey` prop changes:

```jsx
// When resetKey changes, the boundary clears its error state
<ErrorBoundary resetKey={userId}>
  <UserProfile userId={userId} />
</ErrorBoundary>

// Hint: use componentDidUpdate to detect resetKey change
componentDidUpdate(prevProps) {
  if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
    this.setState({ hasError: false, error: null });
  }
}
```

**Challenge 3:** Integrate with Sentry:

```jsx
componentDidCatch(error, info) {
  Sentry.withScope(scope => {
    scope.setExtras({ componentStack: info.componentStack });
    Sentry.captureException(error);
  });
}
```

---

## Common Mistakes

**Mistake 1: One global error boundary at the app root**

```jsx
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

Any crash in any component shows a full-page "Something went wrong." Finer-grained boundaries limit the blast radius to the specific subtree that failed. Wrap individual widgets, panels, and lazy-loaded sections.

**Mistake 2: Trying to use hooks as error boundaries**

There is no `useErrorBoundary` hook in React 18. Libraries like `react-error-boundary` provide a class-backed hook wrapper (`useErrorBoundary`) but the underlying mechanism is still a class component.

**Mistake 3: Catching event handler errors with ErrorBoundary**

```jsx
// ErrorBoundary will NOT catch this:
<button onClick={() => { throw new Error('oops'); }}>Click</button>
```

Use try/catch inside the handler and set error state manually.

**Mistake 4: No reset on the boundary**

Without a reset mechanism, once an error occurs the boundary shows its fallback forever — even if a user action (navigating away, changing a key prop) would have resolved the underlying issue. Always provide a way to reset.

**Mistake 5: Not logging in componentDidCatch**

A silent error boundary in production hides crashes. Always log `error` and `info.componentStack` to your error monitoring service in `componentDidCatch`.

---

## Debugging Tools

### React DevTools error overlay (development)

In development, React shows a full-screen error overlay with the stack trace when any component throws — even inside an `ErrorBoundary`. This is intentional: you should still see errors during development. Click the X to dismiss and see the boundary's fallback UI.

### componentDidCatch component stack

Log `info.componentStack` in `componentDidCatch`. It shows the exact component path to the error, which is more useful than just the JS stack trace for React-specific issues.

### Testing with `act` and `render`

```jsx
import { render } from '@testing-library/react';

test('renders fallback on error', () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const { getByText } = render(
    <ErrorBoundary>
      <BrokenWidget shouldCrash={true} />
    </ErrorBoundary>
  );
  expect(getByText('Something went wrong')).toBeInTheDocument();
  spy.mockRestore();
});
```

Suppress `console.error` in the test to avoid noisy React error logs.

---

## Interview Questions

1. What is an error boundary and what problem does it solve?
2. Why can't error boundaries be function components?
3. What is `getDerivedStateFromError` and when is it called?
4. What is `componentDidCatch` and when is it called?
5. What errors do error boundaries NOT catch?
6. How do you reset an error boundary after recovery?
7. Where should you place error boundaries in your component tree?
8. How do you pair an error boundary with `React.lazy`?
9. How do you test a component wrapped in an error boundary?
10. What information does `info.componentStack` provide?

---

## Interview Answers

**1. What is an error boundary?**
A class component that uses `getDerivedStateFromError` and/or `componentDidCatch` to catch JavaScript errors thrown anywhere in its child component tree during rendering, lifecycle methods, and constructors. When an error is caught, it renders a fallback UI instead of crashing the whole app.

**2. Why not function components?**
Error boundaries require `getDerivedStateFromError` (called during the render phase to update state synchronously and switch to fallback) and `componentDidCatch` (called after commit for logging). These are class lifecycle methods. React hooks run after render and cannot interrupt the render phase — there's no hook equivalent to intercept a thrown error mid-render.

**3. getDerivedStateFromError?**
A static class method called during the render phase when a descendant throws. It receives the error and returns a state update object (`{ hasError: true, error }`). This state update causes the boundary to re-render with its fallback UI. Called before the DOM is updated.

**4. componentDidCatch?**
An instance method called after the DOM is committed (after the boundary has rendered its fallback). It receives the error and `info.componentStack`. Used for side effects like logging to Sentry or Datadog. Not suitable for state updates — use `getDerivedStateFromError` for that.

**5. What errors are NOT caught?**
Event handler errors (they run outside the render cycle — use try/catch inside), async errors (setTimeout, fetch, promise rejection — errors escape the render cycle), server-side rendering errors, and errors thrown by the error boundary itself.

**6. How to reset?**
Add a `reset()` method that calls `setState({ hasError: false, error: null })`. Bind it in the constructor and pass it to the fallback UI's "Retry" button. Alternatively, change the `key` prop of the boundary from outside — React remounts it, clearing its state.

**7. Where to place?**
Wrap individual widgets, panels, and lazy-loaded sections — not just the app root. The goal: minimize blast radius. A broken chart shouldn't hide the stats widget. A failed settings panel shouldn't crash the navigation. Err on the side of more, finer-grained boundaries.

**8. Pair with React.lazy?**
Place `ErrorBoundary` outside `Suspense`. `Suspense` handles the pending state (chunk downloading). `ErrorBoundary` handles the error state (chunk failed, network error). They handle two distinct failure modes of the same async load.

**9. Testing?**
Render the boundary with a child that throws (`shouldCrash={true}`). Suppress `console.error` (React logs errors even when caught). Assert the fallback UI is rendered. Test the reset by simulating the "Try again" click and asserting the fallback disappears.

**10. componentStack?**
A string listing the React component tree from the throwing component up to the error boundary. Format: each line shows a component name and its source location. In production (with source maps), this identifies the exact component. More useful than the JS stack trace for React-specific debugging.

---

## Senior-Level Thinking

**Error boundaries as SLAs for subtrees.**

Think of each error boundary as a service level agreement: "this subtree is isolated — if it fails, the rest of the app still works." In a dashboard with 8 widgets, each wrapped in its own boundary, you can tolerate 7 widget failures before the user loses all value. Without boundaries, 1 failure = 0 widgets.

**The `react-error-boundary` library.**

The `react-error-boundary` npm package provides:
- A reusable class-backed `ErrorBoundary` component with `fallbackRender` prop
- `useErrorBoundary()` hook — lets function components trigger the boundary imperiously
- `withErrorBoundary()` HOC

For any production app, reach for this package rather than rolling your own. It handles the `resetKey` pattern, `onReset`, and `onError` callbacks in a well-tested way.

**Error boundaries + concurrent features.**

In React 18 with concurrent rendering, errors thrown during concurrent renders are handled by the nearest error boundary — same as synchronous renders. `startTransition` wrapped updates that throw still surface through the boundary.

---

## Revision Notes

- Error boundary = class component with `getDerivedStateFromError` + `componentDidCatch`
- `getDerivedStateFromError`: render phase, returns state to switch to fallback
- `componentDidCatch`: commit phase, for logging only (no setState)
- Does NOT catch: event handlers, async, SSR, boundary's own errors
- Place granularly: per-widget, per-panel, per-lazy-chunk
- Always pair with `Suspense` for lazy-loaded components
- Always provide a reset mechanism — stale fallback = bad UX
- Always log in `componentDidCatch` — silent boundaries hide production crashes

---

## Next Day Preview

**Day 28 — React DevTools Profiler**

How to use the React DevTools Profiler to record renders, identify wasted renders, and read flame charts and ranked charts. Finding exactly which components render too often and why — the diagnostic tool that makes all previous optimizations data-driven.
