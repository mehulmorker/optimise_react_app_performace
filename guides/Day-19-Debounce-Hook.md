# Day 19 — Debounce Search Hook

## Objective

Build a `useDebounce` custom hook from scratch, understand why debouncing exists (hint: it's for network calls and expensive side effects, not rendering), and know when to choose debounce vs `useDeferredValue`.

---

## Real World Importance

- Search-as-you-type that queries an API without hammering the server
- Address autocomplete that calls a geocoding API
- Username availability check on registration forms
- "Save as you type" features (autosave drafts)
- Any input-driven API call where you want to wait for the user to pause

---

## Concepts Covered

- What debouncing means (delay until quiet)
- Building `useDebounce` with `useEffect` + `setTimeout` + cleanup
- Why you need the cleanup function (cancel pending debounce on new input)
- `useDebounce` for API calls vs `useDeferredValue` for rendering
- Building a `useSearchQuery` hook that combines debounce + fetch + AbortController
- Race conditions and how AbortController solves them

---

## Exercise Task

Create a new file: `src/components/DebounceSearch.jsx`

### Setup — Before you start

Since this exercise focuses on debouncing, not backend setup, use this **mock fetch function** instead of a real API. It simulates network delay and returns filtered local data.

```jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';

// Local dataset — simulates what an API would return
const MOCK_DATA = Array.from({ length: 1000 }, (_, i) => ({
  id: i + 1,
  name: `Product ${i + 1}`,
  category: ['Electronics', 'Books', 'Sports', 'Clothing', 'Food'][i % 5],
}));

// Simulated API: returns matching items after a 400ms "network delay"
function mockFetch(query, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const results = MOCK_DATA.filter(item =>
        item.name.toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase())
      );
      resolve(results);
    }, 400);

    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}
```

---

### Step 1 — Show the problem without debounce

```jsx
export function SearchWithoutDebounce() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const callCount = useRef(0);

  useEffect(() => {
    if (!query) { setResults([]); return; }

    callCount.current++;
    console.log(`API call #${callCount.current} for: "${query}"`);

    mockFetch(query).then(setResults);
  }, [query]);

  return (
    <div>
      <h3>Without Debounce</h3>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search..."
      />
      <p>{results.length} results (check console for API call count)</p>
    </div>
  );
}
```

Type "react" (5 characters). Watch the console — 5 "API call" logs appear: for "r", "re", "rea", "reac", "react". Only the last one matters. The first 4 are wasted requests.

---

### Step 2 — Build useDebounce from scratch

Add this hook to the same file, above the components:

```jsx
function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Schedule an update to debouncedValue after 'delay' ms
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup: cancel the scheduled update if value changes before delay
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

How it works:
- User types "r": timer scheduled for 300ms
- User types "re" (50ms later): previous timer **cancelled**, new timer scheduled
- User types "rea" (50ms later): timer cancelled again
- User pauses for 300ms: timer fires, `debouncedValue` updates to "rea"
- User resumes with "reac", "react": same pattern
- User pauses: `debouncedValue` updates to "react"

---

### Step 3 — Use useDebounce in search

```jsx
export function SearchWithDebounce() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = useState([]);
  const callCount = useRef(0);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      return;
    }

    callCount.current++;
    console.log(`API call #${callCount.current} for: "${debouncedQuery}"`);
    mockFetch(debouncedQuery).then(setResults);
  }, [debouncedQuery]); // only fires after user pauses 300ms

  return (
    <div>
      <h3>With Debounce (300ms)</h3>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search..."
      />
      <p>{results.length} results (should see only 1 API call for "react")</p>
    </div>
  );
}
```

Type "react" quickly. Only **one API call** fires — after the user stops typing for 300ms.

---

### Step 4 — Add AbortController for correctness

What if the user types fast, pauses, types more, pauses again? Two API calls fire. The second one might resolve before the first (network timing). You'd show results from the first (stale) query.

```jsx
export function SearchComplete() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    mockFetch(debouncedQuery, controller.signal)
      .then(data => {
        setResults(data);
        setLoading(false);
      })
      .catch(err => {
        if (err.name === 'AbortError') return; // cancelled — ignore silently
        setLoading(false);
      });

    return () => controller.abort(); // cancel if debouncedQuery changes before fetch completes
  }, [debouncedQuery]);

  return (
    <div>
      <h3>With Debounce + AbortController</h3>
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search..." />
      {loading && <span> Searching...</span>}
      <p>{results.length} results</p>
      <ul>
        {results.slice(0, 10).map(r => <li key={r.id}>{r.name} — {r.category}</li>)}
      </ul>
    </div>
  );
}
```

To observe the race condition fix: type something, pause briefly (first fetch starts), then type more and pause again (second fetch starts). Without `controller.abort()`, the first fetch could overwrite the second's results. With it, the first fetch is cancelled when `debouncedQuery` changes.

---

### Step 5 — Extract useSearchQuery custom hook

```jsx
function useSearchQuery(query, delay = 300) {
  const debouncedQuery = useDebounce(query, delay);
  const [state, setState] = useState({ data: [], loading: false, error: null });

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setState({ data: [], loading: false, error: null });
      return;
    }

    const controller = new AbortController();
    setState(s => ({ ...s, loading: true, error: null }));

    mockFetch(debouncedQuery, controller.signal)
      .then(data => setState({ data, loading: false, error: null }))
      .catch(err => {
        if (err.name === 'AbortError') return;
        setState({ data: [], loading: false, error: err.message });
      });

    return () => controller.abort();
  }, [debouncedQuery]);

  return state;
}

export function SearchWithHook() {
  const [query, setQuery] = useState('');
  const { data, loading, error } = useSearchQuery(query, 300);

  return (
    <div>
      <h3>useSearchQuery hook</h3>
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search..." />
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      <ul>{data.slice(0, 10).map(p => <li key={p.id}>{p.name}</li>)}</ul>
    </div>
  );
}
```

---

### Final file structure

```
imports (React, useState, useEffect, useCallback, useRef)

MOCK_DATA (module-level data)
mockFetch (simulation helper)

useDebounce (hook — Step 2)
useSearchQuery (hook — Step 5)

SearchWithoutDebounce  (export — Step 1)
SearchWithDebounce     (export — Step 3)
SearchComplete         (export — Step 4)
SearchWithHook         (export — Step 5)
```

---

## What To Observe

- Without debounce: API call on every keystroke (5 calls for "react")
- With debounce: API call only after user pauses (1 call for "react")
- Cleanup in useDebounce: each new value cancels the previous timer (check console)
- AbortController: racing responses from multiple pauses are cancelled correctly
- useSearchQuery: clean composable abstraction — clean component code

---

## Internal React Explanation

### How useDebounce works internally

```
User types 'r':
  Effect runs with value='r'
  setTimeout(setDebounced('r'), 300) scheduled
  Returns cleanup: clearTimeout

User types 're' (50ms later):
  value changed → effect cleanup runs → clearTimeout (timer for 'r' cancelled!)
  Effect runs with value='re'
  setTimeout(setDebounced('re'), 300) scheduled
  Returns new cleanup: clearTimeout

User pauses 300ms:
  Timer fires: setDebouncedValue('re')
  debouncedValue state updates → rerender
```

The key insight: `useEffect`'s cleanup function runs before the next effect invocation. Every new value cancels the previous timer before starting a new one. Only the timer for the final value survives the full 300ms.

### The dependency chain

```
query → (debounce 300ms) → debouncedQuery → (useEffect) → fetch
```

`query` updates immediately on every keystroke (state). `debouncedQuery` updates 300ms after typing stops. The fetch effect depends on `debouncedQuery`, so it only runs when debouncedQuery changes.

### Race condition and AbortController

Two debounce triggers: user types, pauses (fetch A), types more, pauses (fetch B). Network: A resolves after B. Without abort: A's result overwrites B's result, showing stale data.

The effect's cleanup aborts the in-flight request when `debouncedQuery` changes:

```
debouncedQuery='re' → fetch A starts
debouncedQuery='react' → cleanup runs (fetch A aborted!) → fetch B starts
fetch A: AbortError caught, silently ignored
fetch B: resolves with correct results
```

---

## Optimization Challenge

**Challenge 1:** Add a minimum query length check — only search when 2+ characters are typed.

**Challenge 2:** Add caching — if the same query is searched again within 5 minutes, return cached results without a new API call.

**Challenge 3:** Build a `useThrottledSearch` variant that makes API calls at most once per 500ms but always makes the final call.

**Challenge 4:** Implement optimistic results — show local filtered results immediately while the debounced API call is in-flight.

---

## Why This Optimization Works

Without debouncing: N keystrokes → N API requests → N renders for loading states → N renders for results → unnecessary server load + possible race conditions.

With debouncing: N keystrokes → 1 API request (after pause) → 1 loading state → 1 result render. A dramatic reduction in network requests, server load, and state update frequency.

---

## Common Mistakes

**Mistake 1: Debouncing the event handler instead of the value**

```jsx
// Wrong — event.target.value becomes stale inside debounced callback
const debouncedSearch = debounce((e) => setQuery(e.target.value), 300);
<input onChange={debouncedSearch} />
```

Read the value immediately, debounce the side effect:

```jsx
const [query, setQuery] = useState('');
const debouncedQuery = useDebounce(query, 300);
<input onChange={e => setQuery(e.target.value)} />
// Then use debouncedQuery for the API call
```

**Mistake 2: Using debounce for rendering (use useDeferredValue instead)**

Debounce delays state updates by a fixed time. For client-side rendering (no API call), this adds unnecessary latency. `useDeferredValue` is adaptive and doesn't add artificial delay on fast machines.

**Mistake 3: Missing cleanup in useDebounce**

Without `return () => clearTimeout(timer)`, previous timers accumulate. Multiple timers fire per input, calling `setDebouncedValue` multiple times. All 5 keystrokes eventually update `debouncedValue` — 5 API calls still.

**Mistake 4: Not aborting in-flight requests**

Without AbortController, race conditions can show stale results. Always abort the previous request when the query changes.

**Mistake 5: Debouncing too aggressively**

300ms is a common default. For instant feedback UIs (currency conversion, form validation), 100ms feels more natural. For expensive server queries, 500ms or more reduces server load. Choose based on the perceived responsiveness needed.

---

## Debugging Tools

### API call counter

```jsx
const apiCallCount = useRef(0);

useEffect(() => {
  if (!debouncedQuery) return;
  apiCallCount.current++;
  console.log(`API call #${apiCallCount.current} for: "${debouncedQuery}"`);
}, [debouncedQuery]);
```

### Timer ID tracking

```jsx
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    console.log(`Timer ${timer} scheduled for "${value}"`);
    return () => {
      console.log(`Timer ${timer} cancelled`);
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

---

## Interview Questions

1. What is debouncing and why is it needed?
2. How do you implement `useDebounce` in React?
3. Why is the cleanup function critical in `useDebounce`?
4. What is the difference between debouncing and throttling?
5. When should you use debounce vs `useDeferredValue`?
6. What race condition can occur with debounced API calls?
7. How do you prevent stale results from debounced search?
8. What is a good debounce delay for search-as-you-type?
9. Why should you debounce the value, not the event handler?
10. What problem does `useSearchQuery` solve that `useDebounce` alone doesn't?

---

## Interview Answers

**1. What is debouncing?**
Debouncing delays execution of a function until a specified time has passed since the last invocation. For search: the API call waits 300ms after the last keystroke. If the user types again before 300ms, the timer resets. The call only fires after the user pauses.

**2. Implement useDebounce?**
`useState` for the debounced value. `useEffect([value, delay])` that sets a `setTimeout` to update `debouncedValue` after `delay`. Returns a cleanup function that `clearTimeout` cancels the pending timer. Returns `debouncedValue`.

**3. Why is cleanup critical?**
Without cleanup, every keystroke schedules a timer that eventually fires. After typing 5 characters, all 5 timers fire in succession — 5 API calls. With cleanup, each new value cancels the previous timer, ensuring only the last value's timer survives the full delay.

**4. Debouncing vs throttling?**
Debounce: fires after X ms of inactivity (waits for quiet). Throttle: fires at most once per X ms (limits rate). Debounce for "fire when done typing." Throttle for "fire at regular intervals during continuous activity" (scroll, resize, drag).

**5. Debounce vs useDeferredValue?**
Debounce for network requests — prevents excessive API calls. `useDeferredValue` for client-side rendering — prevents heavy renders from blocking input. Debounce adds fixed latency. `useDeferredValue` is adaptive. For search with both an API call AND expensive rendering, use both.

**6. Race condition?**
User pauses → fetch A starts. User types more, pauses → fetch B starts. A resolves after B (slow network). Without protection: A's results overwrite B's correct results. Fix: `AbortController` cancels A when B starts.

**7. Prevent stale results?**
`AbortController` in `useEffect`: pass `controller.signal` to fetch. Return `() => controller.abort()` as cleanup. When `debouncedQuery` changes, cleanup runs, aborting the previous request. The new effect starts a fresh request.

**8. Good debounce delay?**
Typically 200-400ms for search. 300ms is a common default — allows fast typists to continue without lag while still catching "pause" points. For expensive backend queries, 500ms. For instant validation (username check), 200ms. Test with real users.

**9. Debounce value not handler?**
Event handlers receive synthetic events. Reading `event.target.value` inside a debounced callback (300ms later) may return unexpected data. More fundamentally, the value should be captured immediately (state), and the effect (API call) should be debounced.

**10. useSearchQuery value?**
`useDebounce` only delays state updates. `useSearchQuery` adds: AbortController for cancellation, loading state, error handling, fetch lifecycle management. It's a complete "search with network" abstraction, not just a timing utility.

---

## Senior-Level Thinking

**React Query / SWR as the production alternative.**

`useSearchQuery` works but you're reinventing what React Query provides: caching, deduplication, background refetching, error retry, loading states, and cancellation. For production search, consider:

```jsx
const { data, isLoading } = useQuery({
  queryKey: ['search', debouncedQuery],
  queryFn: () => searchAPI(debouncedQuery),
  enabled: debouncedQuery.length > 0,
});
```

React Query handles caching, deduplication (same query won't fire twice), background refetching, and stale-while-revalidate — all the patterns you'd otherwise build manually.

**Debounce + useDeferredValue together.**

For a search that queries an API AND renders many results locally:
- `useDebounce`: controls API call frequency
- `useDeferredValue`: keeps input responsive while rendering the results

These are complementary tools solving different problems.

---

## Revision Notes

- Debounce: delay function call until N ms after last invocation
- useDebounce: useState(value) + useEffect(setTimeout(update, delay) + cleanup)
- Cleanup = clearTimeout — cancels pending timer when value changes
- Use for API calls (network rate control), not for rendering (use useDeferredValue)
- AbortController: cancel in-flight fetch when debounced value changes
- Race condition: slow responses from earlier queries can overwrite fresh results
- 300ms default delay — adjust based on feel and server cost

---

## Next Day Preview

**Day 20 — Throttle Scroll Events**

Scroll events fire up to 60+ times per second. Without throttling, scroll handlers can block the main thread. Build a `useThrottle` hook and apply it to infinite scroll and sticky header detection.
