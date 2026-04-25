# Day 16 — useDeferredValue

## Objective

Understand how `useDeferredValue` enables smooth typing even when the search results are expensive to compute and render. Learn the difference between deferring a value vs deferring computation — and when each is appropriate.

---

## Real World Importance

- Search inputs where results take time to compute but you don't want typing to feel laggy
- Autocomplete dropdowns that must stay responsive
- Filters over large datasets — user sees old results briefly while new ones compute
- Any UI where "show stale, render fresh" is acceptable to prevent jank
- Typing in form fields that drive heavy downstream rendering

---

## Concepts Covered

- What `useDeferredValue` does and when it triggers
- The "stale while computing" rendering pattern
- How `useDeferredValue` differs from debouncing
- Using `useDeferredValue` with `React.memo` to achieve the performance benefit
- `isPending` equivalent for deferred values (using `value !== deferredValue`)
- When to prefer debounce vs `useDeferredValue`

---

## Exercise Task

### Step 1 — Build the laggy version first

```jsx
function SearchWithLag() {
  const [query, setQuery] = useState('');

  // Expensive list that re-renders on every query change
  const results = useMemo(() =>
    ALL_ITEMS.filter(item =>
      item.name.toLowerCase().includes(query.toLowerCase())
    ),
  [query]);

  return (
    <div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search 10k items..."
      />
      <p>{results.length} results</p>
      <HeavyList items={results} />
    </div>
  );
}

// Simulate expensive rendering — renders 200 items with heavy work
function HeavyList({ items }) {
  console.log('HeavyList rendered:', items.length);
  return (
    <ul>
      {items.slice(0, 200).map(item => (
        <HeavyItem key={item.id} item={item} />
      ))}
    </ul>
  );
}

function HeavyItem({ item }) {
  // Simulate expensive render work
  const expensive = slowOperation(item); // or just render a lot of DOM
  return (
    <li>{item.name} — ${item.price} — ⭐{item.rating}</li>
  );
}

// Simulate expensive render
function slowOperation(item) {
  let result = 0;
  for (let i = 0; i < 5000; i++) result += i; // 5k iterations per item
  return result;
}
```

Type in the search box. Observe: the input stutters because React renders `HeavyList` synchronously before the browser can update the input.

### Step 2 — Apply useDeferredValue

```jsx
function SearchOptimized() {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query); // lags behind query

  const isStale = query !== deferredQuery; // true while computing

  const results = useMemo(() =>
    ALL_ITEMS.filter(item =>
      item.name.toLowerCase().includes(deferredQuery.toLowerCase())
    ),
  [deferredQuery]); // depends on DEFERRED value

  return (
    <div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search 10k items..."
      />
      <p style={{ opacity: isStale ? 0.5 : 1 }}>
        {results.length} results
        {isStale && ' (updating...)'}
      </p>
      <div style={{ opacity: isStale ? 0.7 : 1 }}>
        <HeavyList items={results} />
      </div>
    </div>
  );
}
```

Type again. The input updates immediately (smooth). The results list fades slightly and updates after a brief delay.

### Step 3 — The critical memo requirement

`useDeferredValue` alone doesn't give you performance. You MUST wrap the heavy component in `React.memo`:

```jsx
const HeavyList = React.memo(function HeavyList({ items }) {
  return (
    <ul>
      {items.slice(0, 200).map(item => (
        <HeavyItem key={item.id} item={item} />
      ))}
    </ul>
  );
});
```

**Why?** Without `React.memo`, React still renders `HeavyList` on every parent render (every keystroke), defeating the deferral. With `React.memo`, React can skip re-rendering `HeavyList` while the deferred value is computing — because the `items` prop hasn't changed yet (it depends on `deferredQuery`, which is still the old value).

### Step 4 — Observe the rendering behavior

Add logs:

```jsx
function SearchOptimized() {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  console.log(`query="${query}", deferredQuery="${deferredQuery}"`);

  const results = useMemo(() => {
    console.log(`Computing results for: "${deferredQuery}"`);
    return ALL_ITEMS.filter(item =>
      item.name.toLowerCase().includes(deferredQuery.toLowerCase())
    );
  }, [deferredQuery]);

  // ...
}
```

Type "r", "e", "a", "c", "t" quickly:
- You'll see rapid renders where query advances ahead of deferredQuery
- Eventually deferredQuery catches up
- HeavyList only re-renders when deferredQuery changes (due to memo + deferred items prop)

### Step 5 — Compare with debounce

```jsx
// Debounce approach
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function SearchDebounced() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const results = useMemo(() =>
    ALL_ITEMS.filter(item => item.name.includes(debouncedQuery)),
  [debouncedQuery]);

  return (
    <div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search 10k items..."
      />
      <p>{results.length} results</p>
      <ul>
        {results.slice(0, 50).map(item => (
          <li key={item.id}>{item.name} — ${item.price}</li>
        ))}
      </ul>
    </div>
  );
}
```

Key difference:
- **Debounce**: delays triggering the computation by a fixed time (300ms). Input doesn't lag but results wait 300ms even on fast machines.
- **useDeferredValue**: React immediately starts both renders; defers the heavy one. On fast machines, results update with minimal delay. On slow machines, it defers until idle. Adaptive.

---

## What To Observe

- Without useDeferredValue: input stutters, every keystroke waits for HeavyList
- With useDeferredValue + memo: input is always smooth, HeavyList updates asynchronously
- `query !== deferredQuery` is `true` while results are computing
- Without React.memo on HeavyList: useDeferredValue has no benefit
- Debounce: fixed 300ms delay regardless of device speed
- useDeferredValue: adaptive delay based on device/work load

---

## Internal React Explanation

### How useDeferredValue works

`useDeferredValue` tells React: "I have an urgent value (`query`) and a non-urgent one (`deferredQuery`). Keep `deferredQuery` one step behind and use it for the heavy rendering."

Internally:

1. React renders with `query = 'react'` and `deferredQuery = 'reac'` (old value)
2. This render is fast — `HeavyList` has the old `items` prop, `React.memo` bails out
3. React then schedules a low-priority render to update `deferredQuery`
4. If `query` changes again before the low-priority render starts, React cancels the deferred render and starts a new one with the latest value
5. When idle, React commits the deferred render with updated results

The deferred render is **interruptible** — it can be canceled if higher-priority work (like user input) arrives. This is React 18's concurrent rendering in action.

### The "stale while revalidating" pattern

```
User types: 'r' → 're' → 'rea' → 'reac' → 'react'

query:         'r' 're' 'rea' 'reac' 'react'
deferredQuery: ''  'r'  're'  'rea'  'reac'  → 'react' (eventual)

HeavyList sees: old old  old   old    old   → new
```

Users see the old results with a slight opacity reduction (the `isStale` pattern). The UI never blocks. The input is always responsive.

### Why React.memo is required

`useDeferredValue` creates two renders per keystroke:
1. Urgent render: updates `query` (and input display)
2. Deferred render: updates `deferredQuery` (and `results` → `HeavyList`)

Without `React.memo` on `HeavyList`, both renders re-render `HeavyList`. The urgent render (render 1) passes the old `items` — but React still calls `HeavyList()` even though items didn't change. This defeats the purpose.

With `React.memo`, the urgent render's `HeavyList` call bails out (same `items` reference), keeping render 1 fast. Only render 2 (deferred) actually re-renders `HeavyList`.

---

## Optimization Challenge

**Challenge 1:** Build a "search with suggestions" component. The input text updates immediately (controlled). The suggestions dropdown uses `useDeferredValue` + `React.memo` to avoid blocking input.

**Challenge 2:** Add a "computing..." indicator that shows while `deferredQuery !== query`.

**Challenge 3:** Measure the difference: type 10 characters quickly. Compare:
- Without useDeferredValue: measure how long the input is unresponsive
- With useDeferredValue: measure input responsiveness
Use the Performance panel in DevTools.

---

## Why This Optimization Works

`useDeferredValue` separates the UI into two priority tiers:
- **Urgent** (input): must respond in <16ms for smooth typing
- **Deferred** (results): can take as long as needed, shows stale while updating

The user perceives the input as instant (it is). The results update slightly later. For search UIs, this tradeoff is nearly always acceptable.

---

## Common Mistakes

**Mistake 1: Using useDeferredValue without React.memo on the heavy component**

The most common mistake. Without memo, the deferred value has no performance effect — the heavy component renders on both the urgent and deferred passes.

**Mistake 2: Applying useDeferredValue to the wrong value**

The deferred value should be the one driving the expensive render, not the input value itself. Deferring `query` directly means the input shows the deferred value — the input lags! Defer the derived/computed state.

**Mistake 3: Using useDeferredValue for network requests**

`useDeferredValue` is for client-side rendering deferral. It doesn't delay network requests or add debouncing to API calls. Use debounce for API calls (Day 19).

**Mistake 4: Expecting instant updates on all machines**

On fast machines, `deferredValue` updates very quickly — sometimes as fast as the urgent value. On slow machines, it defers more. This adaptive behavior is the feature, not a bug.

---

## Debugging Tools

### Visual stale indicator

```jsx
const isStale = query !== deferredQuery;
<div style={{ opacity: isStale ? 0.6 : 1, transition: 'opacity 0.15s' }}>
  {/* results */}
</div>
```

This gives users visual feedback that results are updating without blocking input.

### Log render timing

```jsx
console.log('Urgent render, query:', query, 'deferred:', deferredQuery);
// If these differ, we're in the urgent render and HeavyList should bail out
```

---

## Interview Questions

1. What does `useDeferredValue` do?
2. Why is `React.memo` required for `useDeferredValue` to work?
3. What is the difference between `useDeferredValue` and `useTransition`?
4. How does `useDeferredValue` differ from debouncing?
5. When would you choose debounce over `useDeferredValue`?
6. What is the "stale while computing" pattern?
7. How do you detect when a deferred value is still computing?
8. Does `useDeferredValue` eliminate the need for `useMemo`?
9. What React feature enables `useDeferredValue` to work?
10. What happens to the deferred render if the user types another character before it completes?

---

## Interview Answers

**1. What does useDeferredValue do?**
It creates a "lagging copy" of a value that React updates at lower priority. The original value updates immediately (urgent). The deferred copy lags behind by one render cycle. This allows components using the deferred value to show old results while computing new ones — keeping the UI that uses the original value (like an input) responsive.

**2. Why is React.memo required?**
Without memo, the heavy component renders on both the urgent render (with old props) and the deferred render (with new props). Memo allows the urgent render to bail out (same props reference), making it fast. Only the deferred render does the heavy work.

**3. useDeferredValue vs useTransition?**
Both defer work. `useTransition` wraps the state setter: `startTransition(() => setState(val))`. You control what's low-priority. `useDeferredValue` wraps the value: `useDeferredValue(val)`. You're saying "this derived value can lag." Use `useTransition` when you control the state update; use `useDeferredValue` when you receive the value from outside (props, third-party).

**4. useDeferredValue vs debounce?**
Debounce delays the state update by a fixed time (e.g., 300ms). `useDeferredValue` is adaptive — React tries to update immediately but defers if there's higher-priority work. On fast machines: deferred updates quickly. On slow machines: defers more. Debounce is always 300ms regardless of device.

**5. When to choose debounce?**
For API calls — you don't want to send a request on every keystroke. Debounce provides explicit control over request frequency. `useDeferredValue` only controls rendering, not network requests.

**6. Stale while computing?**
Show the previous results while the new ones are being computed. The UI uses `isStale = value !== deferredValue` to show a visual indicator (opacity, spinner). Users see something useful immediately and get updated results when ready.

**7. Detect when deferred value is computing?**
`const isStale = originalValue !== deferredValue` is `true` while the deferred render hasn't completed yet.

**8. Does useDeferredValue eliminate useMemo?**
No. They solve different problems. `useMemo` prevents re-running the computation when deps haven't changed (within the same render priority). `useDeferredValue` defers when the computation runs (between render priorities). Both may be needed: memo prevents unnecessary re-computation; deferred value prevents blocking the UI.

**9. What feature enables it?**
React 18 concurrent rendering. The deferred render is an interruptible, low-priority render that can be canceled if higher-priority work (user input) arrives. This requires the concurrent renderer (enabled by `createRoot`).

**10. Deferred render interrupted by new input?**
React cancels the in-progress deferred render and schedules a new one based on the latest value. The old render's work is discarded. This ensures you always eventually render the latest value without wasting compute on intermediate values when the user is typing fast.

---

## Senior-Level Thinking

**useDeferredValue is the "time slicing" answer for consumer-facing search.**

Before React 18, the only options were debouncing (adds latency) or virtualization (limits rendered items). `useDeferredValue` is a new option: render everything but prioritize input responsiveness. For local search over a few thousand items, this is often the cleanest solution.

**The semantic difference from useTransition:**

`useTransition` is "I'm triggering a transition" — you hold the spinner. `useDeferredValue` is "I'm consuming a value that may lag" — the data source is elsewhere. In practice: if you own the state setter, use `useTransition`. If you're receiving a value from props or context that drives expensive rendering, use `useDeferredValue`.

---

## Revision Notes

- `useDeferredValue(value)` = low-priority copy that lags behind
- MUST use `React.memo` on the heavy component consuming the deferred value
- `value !== deferredValue` = still computing (use for stale UI indicator)
- Debounce = fixed delay regardless of speed; useDeferredValue = adaptive
- useDeferredValue is for rendering, not for API calls
- Works only with React 18's concurrent renderer (`createRoot`)
- Urgent render (input) = fast; Deferred render (results) = can be interrupted

---

## Next Day Preview

**Day 17 — useTransition**

The "owner side" of concurrency: marking state updates as non-urgent with `startTransition`. Building a heavy tab switcher that feels instant. The `isPending` flag for loading states. The semantic difference between transition and deferred value.
