# Day 13 — Cleanup & Memory Leaks

## Objective

Understand the memory leaks that `useEffect` can create when effects don't clean up after themselves. Learn the cleanup patterns for every common scenario: event listeners, timers, async operations, subscriptions, and how to use `AbortController` for cancelable fetches.

---

## Real World Importance

- "Can't perform a React state update on an unmounted component" — the classic memory leak warning
- Event listeners accumulating: N navigations → N scroll handlers → browser slows to a crawl
- WebSocket connections that never close after leaving a chat room
- setTimeout/setInterval that fire after a component unmounts and try to update dead state
- Fetch requests completing after a user navigated away, causing state updates on wrong screen

---

## Concepts Covered

- The cleanup function: the return value of `useEffect`
- When cleanup runs
- Cleaning up: event listeners, timers, intervals, ResizeObserver, subscriptions
- AbortController for cancelable fetch requests
- React 18 Strict Mode double-invocation and what it tests
- The "unmounted component" anti-pattern

---

## Exercise Task

### Step 1 — Event listener that doesn't clean up

```jsx
function ScrollTracker() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    // NO CLEANUP — listener accumulates on every render!
  }, []);

  return <div>Scroll Y: {scrollY}</div>;
}
```

In development (StrictMode), React mounts, unmounts, and remounts components. Without cleanup, you'll have two scroll listeners after initial mount. Navigate to this component multiple times in a SPA — each navigation adds another listener.

**Fix:**

```jsx
useEffect(() => {
  const handleScroll = () => setScrollY(window.scrollY);
  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll); // cleanup!
}, []);
```

### Step 2 — Timer that keeps running after unmount

```jsx
function CountdownTimer({ seconds }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(r => {
        if (r <= 0) {
          clearInterval(interval);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    // NO CLEANUP — interval keeps running after unmount!
  }, []);

  return <div>{remaining}s remaining</div>;
}
```

If the parent unmounts this component (e.g., user navigates away), the interval continues running and tries to call `setRemaining` on an unmounted component.

**Fix:**

```jsx
useEffect(() => {
  const interval = setInterval(() => {
    setRemaining(r => (r > 0 ? r - 1 : 0));
  }, 1000);

  return () => clearInterval(interval); // cleanup on unmount
}, []);
```

### Step 3 — Fetch that completes after unmount

```jsx
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(r => r.json())
      .then(data => setUser(data)); // may run after unmount!
  }, [userId]);

  return <div>{user?.name}</div>;
}
```

User navigates away before fetch completes → component unmounts → fetch resolves → `setUser` called on unmounted component.

**Fix with AbortController:**

```jsx
useEffect(() => {
  const controller = new AbortController();

  fetch(`/api/users/${userId}`, { signal: controller.signal })
    .then(r => r.json())
    .then(data => setUser(data))
    .catch(err => {
      if (err.name === 'AbortError') return; // expected — don't log
      console.error(err);
    });

  return () => controller.abort(); // cancel fetch on unmount or dep change
}, [userId]);
```

When cleanup runs, `controller.abort()` cancels the in-flight request. The fetch throws an `AbortError` (not a real error) which we handle silently.

### Step 4 — ResizeObserver cleanup

```jsx
function ResponsiveChart({ data }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect(); // cleanup!
  }, []);

  return (
    <div ref={containerRef}>
      <Chart data={data} width={dimensions.width} height={dimensions.height} />
    </div>
  );
}
```

### Step 5 — Subscription cleanup (custom event emitter)

```jsx
useEffect(() => {
  const subscription = store.subscribe(newState => {
    setLocalState(newState);
  });

  return () => subscription.unsubscribe(); // cleanup!
}, [store]);
```

### Step 6 — Using isMounted flag (older pattern, understand it)

```jsx
useEffect(() => {
  let isMounted = true;

  fetchUser(userId).then(data => {
    if (isMounted) { // only update if still mounted
      setUser(data);
    }
  });

  return () => {
    isMounted = false; // cleanup: mark as unmounted
  };
}, [userId]);
```

This works but `AbortController` is preferred for fetch because it actually cancels the request — not just ignores the result.

---

## What To Observe

- Without cleanup: multiple event listeners accumulate (scroll fires multiple handlers)
- Timer without cleanup: interval continues after component removed from DOM
- Fetch without cleanup: state update on unmounted component (React warning)
- With cleanup: each effect instance is properly torn down before the next one starts
- StrictMode: React calls cleanup + re-setup on mount to verify cleanup works

---

## Internal React Explanation

### When does cleanup run?

The cleanup function (returned from `useEffect`) runs in two scenarios:

1. **Before the effect re-runs** (when deps change): cleanup the previous effect, then run the new one
2. **On component unmount**: cleanup the current effect

```
Mount:
  effect setup runs

Dep changes (rerender):
  cleanup of previous effect runs
  new effect setup runs

Unmount:
  cleanup of last effect runs
```

### React 18 Strict Mode double-invocation

In development + StrictMode, React intentionally:
1. Mounts the component
2. Runs effects
3. Unmounts the component (runs cleanups)
4. Remounts the component
5. Runs effects again

This is React's way of checking that your cleanup is correct. If your cleanup properly removes event listeners, cancels fetches, and clears timers — the double-mount is harmless. If your cleanup is missing — bugs surface in development before they reach production.

This is why you might see effects run twice in development but not in production.

### The "unmounted component" warning (React 17)

In React 17, calling `setState` on an unmounted component logs:

> "Warning: Can't perform a React state update on an unmounted component. This is a no-op, but it indicates a memory leak in your application."

In React 18, this warning was removed because React itself handles this scenario better with concurrent features. But the underlying problem (fetch resolving after unmount) still exists and can cause bugs — the warning's removal doesn't mean the problem is gone.

### What "memory leak" means in React context

A JavaScript memory leak = an object that can never be garbage collected because something still holds a reference to it.

In React:
- An event listener holds a reference to the handler function
- The handler holds a reference to the component's closure (state, props, refs)
- If the listener is never removed, the closure can never be GC'd
- The component's memory can never be freed even after unmount

Over time, repeated mounting/unmounting without cleanup = growing memory usage.

---

## Optimization Challenge

**Challenge 1:** Build a component that polls an API every 5 seconds and properly cancels:
- The in-flight request on unmount
- The timer on unmount
- The ongoing poll when the component unmounts mid-request

**Challenge 2:** Build a component that listens to a WebSocket and properly disconnects on unmount.

**Challenge 3:** Write a `useFetch(url)` custom hook that handles:
- Fetch state: `loading`, `data`, `error`
- Cancellation via `AbortController`
- Re-fetching when URL changes
- Clean cleanup when unmounted

```jsx
function useFetch(url) {
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    setState({ loading: true, data: null, error: null });
    const controller = new AbortController();

    fetch(url, { signal: controller.signal })
      .then(r => r.json())
      .then(data => setState({ loading: false, data, error: null }))
      .catch(err => {
        if (err.name === 'AbortError') return;
        setState({ loading: false, data: null, error: err });
      });

    return () => controller.abort();
  }, [url]);

  return state;
}
```

---

## Why This Works

Cleanup functions are React's mechanism for making effects reversible. An effect that creates something (listener, timer, subscription, connection) should destroy that thing in its cleanup. This ensures:

- No resource accumulation over time
- No state updates on unmounted components
- Each effect's lifetime is bounded: setup when active, teardown when inactive
- Safe concurrent-mode behavior (React may set up and tear down effects during rendering)

---

## Common Mistakes

**Mistake 1: Returning something other than a function from useEffect**

```jsx
useEffect(() => {
  return 'cleanup'; // ignored! must be a function or nothing
}, []);
```

Only a function (or nothing) is valid. Returning a non-function is silently ignored — no error thrown.

**Mistake 2: Using async function directly as effect**

```jsx
useEffect(async () => {
  const data = await fetchData();
  setData(data);
  // This returns a Promise — which React ignores
  // Your returned cleanup function is inside the Promise, never called!
}, []);
```

Async functions return Promises. React expects `void` or a cleanup function. Fix: define the async operation inside the effect and call it.

```jsx
useEffect(() => {
  const controller = new AbortController();

  async function loadData() {
    const data = await fetchData({ signal: controller.signal });
    setData(data);
  }

  loadData();
  return () => controller.abort(); // this cleanup IS returned correctly
}, []);
```

**Mistake 3: Ignoring AbortError in catch**

Always check `err.name === 'AbortError'` and return early. Treating a deliberate abort as an error causes false error states.

**Mistake 4: Cleanup that references stale variables**

```jsx
useEffect(() => {
  const id = setTimeout(callback, delay);
  return () => clearTimeout(id); // 'id' from closure — correct, same render
}, [callback, delay]);
```

This is fine because `id` is captured from the same render's scope. The cleanup always references the timeout set up by this particular effect run.

**Mistake 5: Adding cleanup to the wrong scope**

```jsx
useEffect(() => {
  // wrong — runs on every render
  return () => window.removeEventListener('scroll', handler);
  // without adding the listener first in this effect!
}, []);
```

The listener was added in a previous effect instance. Each cleanup should undo exactly what its corresponding setup did.

---

## Debugging Tools

### Detect missing cleanup with StrictMode

React 18 StrictMode in development double-invokes effects. If your event listener fires twice, you're missing cleanup. If your fetch runs twice, check cleanup.

### Monitor event listener count

```js
// Chrome DevTools console
getEventListeners(window).scroll // see all scroll listeners
```

Or use the Performance panel to detect memory growth over repeated mount/unmount cycles.

### Log effect lifecycle

```jsx
useEffect(() => {
  console.log(`Effect setup: ${userId}`);
  return () => console.log(`Effect cleanup: ${userId}`);
}, [userId]);
```

---

## Interview Questions

1. What is the cleanup function in `useEffect`?
2. When does the cleanup function run?
3. Why can missing cleanup cause memory leaks?
4. How do you cancel an in-flight fetch request in React?
5. What is `AbortController` and how does it work?
6. Why should you never make the `useEffect` callback itself async?
7. What does React 18 Strict Mode's double-invocation test?
8. What is the `isMounted` pattern and when is it appropriate?
9. What happens if you return a non-function from `useEffect`?
10. How do you clean up a `ResizeObserver`?

---

## Interview Answers

**1. Cleanup function?**
The function returned from `useEffect`. It's called before the effect re-runs (when deps change) and when the component unmounts. It should undo or cancel whatever the effect set up.

**2. When does cleanup run?**
Before the effect re-runs (between renders when deps changed), and when the component unmounts. The cleanup of the last effect always runs on unmount.

**3. Missing cleanup → memory leaks?**
Effect-created objects (event listeners, timers, subscriptions) hold references to the component's closure. Without removing them, those references keep the closure in memory even after the component unmounts. Repeated mount/unmount cycles accumulate uncollectable closures.

**4. Cancel in-flight fetch?**
Use `AbortController`. Create a controller, pass `{ signal: controller.signal }` to `fetch`. In the cleanup function, call `controller.abort()`. Catch `AbortError` in the catch handler and return early.

**5. AbortController?**
A Web API for canceling `fetch` requests (and other operations). `new AbortController()` gives you a `controller.signal` to pass to `fetch`. Calling `controller.abort()` sends a cancellation signal — the pending `fetch` rejects with an `AbortError`.

**6. No async effect callback?**
Async functions return Promises. React expects the effect callback to return either nothing or a cleanup function. A Promise is neither — React ignores it and the cleanup inside the Promise is never called. Define an async inner function and call it from the synchronous callback.

**7. Strict Mode double-invocation?**
It verifies that effects can be cleanly set up and torn down. If your app works correctly with double-invocation (setup → cleanup → setup), it proves your cleanup is correct and concurrent mode features won't cause issues.

**8. isMounted pattern?**
A boolean flag set to `true` in the effect and `false` in the cleanup. Check it before calling `setState` in async callbacks to prevent updates on unmounted components. Older pattern — prefer `AbortController` for fetch (actually cancels request vs. just ignoring result).

**9. Returning non-function from useEffect?**
Silently ignored. React checks if the return value is a function. If not, it's treated as no cleanup. No error, no warning. Common mistake with async effects returning Promises.

**10. Cleanup ResizeObserver?**
Call `observer.disconnect()` in the cleanup function. This removes all observations and stops the observer. The observer will be garbage collected.

---

## Senior-Level Thinking

**Every effect has a lifecycle pair: setup and teardown.**

Think of effects as resource lifecycle managers. Every resource created (listener, timer, connection, observer) is a liability that must be cleaned up. A well-written effect is self-contained: its cleanup fully reverses its setup.

**AbortController is the modern standard for cancellation.**

Beyond fetch, `AbortController` signals can be used with other Web APIs (like `addEventListener`) that support them. Libraries like TanStack Query (React Query) handle all of this internally — one reason to prefer a data fetching library over manual `useEffect` fetches in production.

**React Query / SWR as the alternative.**

For data fetching specifically, libraries like TanStack Query handle: caching, deduplication, background refetching, request cancellation, loading/error states, and cleanup — all correctly. Before writing complex fetch effects, evaluate whether a library solves it better.

---

## Revision Notes

- Cleanup function: returned from useEffect, runs before re-run and on unmount
- Event listener: always add removeEventListener in cleanup
- Interval/timeout: always clearInterval/clearTimeout in cleanup
- Fetch: AbortController + controller.abort() in cleanup
- Async effect: define async function inside, call it, return sync cleanup
- StrictMode double-invokes effects in dev — tests that cleanup works
- `isMounted` flag: valid but AbortController is preferred for fetch

---

## Next Day Preview

**Day 14 — Weekly Project: Stopwatch App**

Apply all Week 2 concepts in a single project. Build a stopwatch with start, stop, lap, and reset functionality using refs, effects, cleanup, and correct batching.
