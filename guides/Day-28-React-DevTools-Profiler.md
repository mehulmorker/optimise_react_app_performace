# Day 28 — React DevTools Profiler

## Objective

Learn to use the React DevTools Profiler to record renders, read flame charts and ranked charts, identify wasted renders, and turn observations into targeted optimizations. The Profiler is what separates guessing from knowing — every optimization from this bootcamp becomes data-driven.

---

## Real World Importance

- A component rerenders 47 times on a single button click — you'd never find this by reading code
- The ranked chart shows which components take the most combined time — the real bottleneck
- "Why did this render?" tells you exactly which prop or state change triggered the rerender
- Profiler recordings in CI: detect performance regressions before they ship
- Before any optimization: record a baseline; after: record again and compare

---

## Concepts Covered

- Installing and opening React DevTools Profiler
- Recording a profiling session
- Reading the flame chart (commit-by-commit timeline)
- Reading the ranked chart (most expensive components first)
- "Why did this render?" panel
- Identifying wasted renders (same output, different cause)
- Profiling in production mode
- Using `<Profiler>` API for programmatic measurements

---

## Exercise Task

### Step 1 — Install React DevTools

React DevTools is a browser extension:
- Chrome: [React Developer Tools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)
- Firefox: [React Developer Tools](https://addons.mozilla.org/en-US/firefox/addon/react-devtools/)

After installing, open DevTools (F12) → you'll see a **Components** tab and a **Profiler** tab.

### Step 2 — Build a deliberately slow component tree

```jsx
// A component that does expensive work on every render
function SlowItem({ item, onSelect, selectedId }) {
  // Simulated expensive computation
  let sum = 0;
  for (let i = 0; i < 100_000; i++) sum += i;

  const isSelected = item.id === selectedId;

  return (
    <div
      onClick={() => onSelect(item.id)}
      style={{ background: isSelected ? '#e0f0ff' : 'white', padding: 8, cursor: 'pointer' }}
    >
      {item.name} — ${item.price}
    </div>
  );
}

function ProductList() {
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('');
  const products = Array.from({ length: 100 }, (_, i) => ({
    id: i,
    name: `Product ${i}`,
    price: (Math.random() * 100).toFixed(2),
  }));

  return (
    <div>
      <input
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder="Filter..."
      />
      {products
        .filter(p => p.name.toLowerCase().includes(filter.toLowerCase()))
        .map(p => (
          <SlowItem
            key={p.id}
            item={p}
            onSelect={setSelectedId}
            selectedId={selectedId}
          />
        ))}
    </div>
  );
}
```

### Step 3 — Record a profiling session

1. Open DevTools → **Profiler** tab
2. Click the **Record** button (circle icon)
3. Type a character in the filter input
4. Click a product
5. Type another character
6. Click **Stop** (square icon)

You now have a recording.

### Step 4 — Read the flame chart

The flame chart shows one bar per component per commit:
- **Width**: time spent rendering that component (including children)
- **Color**: yellow/orange = slow; green/gray = fast; no bar = didn't render

Click a commit (the bar at the top timeline) to see which components rendered in that commit.

What you'll see:
- `ProductList` renders on every keystroke (filter state change — expected)
- ALL 100 `SlowItem` components render on every keystroke (even when only the filter changed, not `selectedId`)
- Each `SlowItem` has a wide yellow bar — the tight loop is visible

### Step 5 — Read the ranked chart

Switch to **Ranked** tab. Components are sorted by total render time (slowest first). You'll see:
- `SlowItem` × 100 at the top with combined render time
- `ProductList` below
- Small utility components at the bottom

The ranked chart answers: "where is the most time being spent?" Focus optimization efforts on the top items.

### Step 6 — "Why did this render?"

Enable it: Profiler settings (gear icon) → **Record why each component rendered while profiling**.

Record again and click any `SlowItem` in the flame chart. The right panel shows:
- **"Props changed"** → which specific prop changed
- **"State changed"** → which state hook index changed
- **"Parent rendered"** → no prop/state change, just parent rerender

Clicking a `SlowItem` that wasn't selected will show **"Props changed: selectedId"** — even though the item isn't selected and its visual output didn't change. This is a wasted render.

### Step 7 — Optimize and re-profile

```jsx
// Fix 1: Move products array outside component (stable reference)
const ALL_PRODUCTS = Array.from({ length: 100 }, (_, i) => ({
  id: i,
  name: `Product ${i}`,
  price: (i * 1.5).toFixed(2),
}));

// Fix 2: Memoize SlowItem — bail out when item + selectedId unchanged
const SlowItem = React.memo(function SlowItem({ item, onSelect, selectedId }) {
  let sum = 0;
  for (let i = 0; i < 100_000; i++) sum += i;
  const isSelected = item.id === selectedId;
  return (
    <div onClick={() => onSelect(item.id)} style={{ background: isSelected ? '#e0f0ff' : 'white', padding: 8 }}>
      {item.name} — ${item.price}
    </div>
  );
});

// Fix 3: Stabilize onSelect with useCallback
function ProductList() {
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('');

  const handleSelect = useCallback((id) => setSelectedId(id), []);

  const filtered = useMemo(
    () => ALL_PRODUCTS.filter(p => p.name.toLowerCase().includes(filter.toLowerCase())),
    [filter]
  );

  return (
    <div>
      <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter..." />
      {filtered.map(p => (
        <SlowItem key={p.id} item={p} onSelect={handleSelect} selectedId={selectedId} />
      ))}
    </div>
  );
}
```

Record again. Now:
- Typing a character: only `ProductList` and newly-filtered items render
- Clicking a product: only the previously selected and newly selected `SlowItem` render (selectedId changed for only 2 items)
- The ranked chart: `SlowItem` total time collapses dramatically

### Step 8 — The `<Profiler>` API for programmatic measurements

```jsx
import { Profiler } from 'react';

function onRenderCallback(
  id,          // the "id" prop of the Profiler
  phase,       // "mount" or "update"
  actualDuration,   // time spent rendering (ms)
  baseDuration,     // estimated time without memoization
  startTime,
  commitTime,
) {
  console.log(`[${id}] ${phase}: ${actualDuration.toFixed(2)}ms`);
  // In production, send to your analytics:
  // analytics.track('react_render', { id, phase, actualDuration });
}

function App() {
  return (
    <Profiler id="ProductList" onRender={onRenderCallback}>
      <ProductList />
    </Profiler>
  );
}
```

`<Profiler>` works in production builds (unlike DevTools, which requires the development build). Use it to track real-user render performance and detect regressions in monitoring dashboards.

---

## What To Observe

| Action | Before optimization | After optimization |
|--------|---------------------|--------------------|
| Type one character | 100 SlowItems render | 0–few SlowItems render |
| Click a product | 100 SlowItems render | 2 SlowItems render (old + new selected) |
| Ranked chart top item | SlowItem (100× combined) | ProductList only |
| "Why did this render?" on non-selected SlowItem | "Props changed: selectedId" | Not rendered (bailed out) |
| Total commit time | ~500ms | ~5ms |

---

## Internal React Explanation

### What the Profiler measures

`actualDuration`: time React spent in the render phase for this component and its subtree in this commit. If `React.memo` bails out, this component shows 0 and its children don't appear in that commit.

`baseDuration`: estimated time if no memoization existed (React times the last full render). If `baseDuration` >> `actualDuration`, memoization is working well. If they're equal, memoization isn't helping.

### Flame chart anatomy

```
[   ProductList (20ms total)                            ]
  [SlowItem 0 (0.5ms)] [SlowItem 1 (0.5ms)] ... × 100
```

Width = time. Nesting = component hierarchy. Gray = didn't render (bailed out with memo). The parent bar always equals or exceeds the sum of child bars (parent's own work + children's work).

### What "wasted render" means

A render is "wasted" if:
1. The component re-executed its render function
2. The output (JSX) was identical to the previous render
3. React diffed the output and made no DOM changes

It's wasted because CPU was spent running the function and diffing the result, with zero visible effect. `React.memo` prevents step 1 entirely — no re-execution, no diff needed.

---

## Optimization Challenge

**Challenge 1:** Build this component, profile it, then optimize until the ranked chart shows no component rendering more than once per interaction:

```jsx
function NotificationCenter() {
  const [notifications, setNotifications] = useState(
    Array.from({ length: 50 }, (_, i) => ({ id: i, message: `Notification ${i}`, read: false }))
  );
  const [filter, setFilter] = useState('all');

  const markRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'read') return n.read;
    return true;
  });

  return (
    <div>
      <select value={filter} onChange={e => setFilter(e.target.value)}>
        <option value="all">All</option>
        <option value="unread">Unread</option>
        <option value="read">Read</option>
      </select>
      {filtered.map(n => (
        <NotificationItem key={n.id} notification={n} onMarkRead={markRead} />
      ))}
    </div>
  );
}
```

Profile → optimize → profile again. Compare before/after screenshots.

**Challenge 2:** Use the `<Profiler>` API to log render times to the console. Find the interaction that causes the highest `actualDuration` and fix it.

---

## Common Mistakes

**Mistake 1: Profiling in development mode**

React development builds include extra checks and warnings that make renders significantly slower than production. Always profile in production mode for realistic numbers:

```bash
npm run build && npx serve -s build
```

Then profile on the served production build. Development profiles are useful for identifying *which* components render; production profiles are needed for accurate timing.

**Mistake 2: Optimizing before profiling**

Adding `React.memo`, `useCallback`, and `useMemo` everywhere without profiling first. These tools add overhead. If a component renders once and is fast, wrapping it in `memo` adds comparison cost with no benefit. Profile first — identify actual bottlenecks — optimize only those.

**Mistake 3: Not enabling "Why did this render?"**

The default profiler recording doesn't capture render reasons — it costs extra overhead. Enable it in Profiler settings before recording when you need to diagnose *why* a component rendered. Without it, you know *that* it rendered, not why.

**Mistake 4: Reading only flame chart, ignoring ranked chart**

The flame chart shows one commit at a time. A component that renders in every commit appears once per commit. The ranked chart aggregates across all commits — it shows total time per component across the entire recording. This is where you find the real performance bottlenecks.

**Mistake 5: Ignoring `baseDuration` vs `actualDuration`**

`baseDuration` ≈ `actualDuration` means memo isn't helping (the component still re-executes). A large gap means memo is working well. If you see no gap after adding `React.memo`, the component's deps are unstable — find the unstable prop with "Why did this render?"

---

## Debugging Tools

### Profiler settings

Gear icon in the Profiler tab:
- **Record why each component rendered** — enables "why" panel (slight overhead)
- **Hide commits below N ms** — filters out fast commits to focus on slow ones

### Highlight updates in Components tab

Components tab → settings → **Highlight updates when components render** — a visual border flashes around every component that renders. Great for a quick sanity check during development without formally profiling.

### `console.count` as a lightweight profiler

```jsx
function ExpensiveComponent({ data }) {
  console.count('ExpensiveComponent render');
  // ...
}
```

Cheaper than opening DevTools. `console.count` increments a named counter — you see exactly how many times it rendered without any setup.

---

## Interview Questions

1. What does the React DevTools Profiler measure?
2. What is `actualDuration` vs `baseDuration`?
3. How do you identify wasted renders in the Profiler?
4. What does "Why did this render?" tell you and how do you enable it?
5. What is the difference between the flame chart and the ranked chart?
6. Why should you profile in production mode?
7. What is the `<Profiler>` component and when do you use it?
8. How do you use the Profiler to verify an optimization worked?
9. What does it mean if `actualDuration` equals `baseDuration`?
10. What's the first thing you should do before adding `React.memo` to a component?

---

## Interview Answers

**1. What does the Profiler measure?**
Time React spends in the render phase for each component and its subtree in each commit. It shows which components rendered, how long they took, and (optionally) why they rendered. It does not measure time in the commit phase (DOM mutations) or paint time.

**2. actualDuration vs baseDuration?**
`actualDuration`: how long this component's subtree actually took to render in this commit. `baseDuration`: estimated time to render the subtree without any memoization (based on the last full render). If memo is working, `actualDuration` is much smaller than `baseDuration` — the subtree was bailed out.

**3. Identifying wasted renders?**
In the flame chart: a component that renders in commits where you'd expect it to be static (it's unrelated to the state that changed). In "Why did this render?": the panel shows "Props changed" on a component whose output didn't actually change — the memo comparison failed but the render was redundant.

**4. "Why did this render?"?**
Tells you the reason a specific component rendered in a specific commit: "State changed," "Props changed" (with the specific prop name), or "Parent rendered." Enable it in Profiler settings (gear icon → "Record why each component rendered while profiling") before starting the recording.

**5. Flame chart vs ranked chart?**
Flame chart: per-commit view, shows the component hierarchy for one commit at a time. Ranked: aggregated view across the entire recording, sorted by total render time. Flame chart = where in the tree did the slowness come from in this commit. Ranked = which component is the most expensive overall.

**6. Profile in production mode?**
Development builds include extra invariant checks, detailed warnings, and propType validation that add significant overhead. Production builds strip all of that. A component that takes 50ms in development may take 5ms in production. Always measure production-mode timing when deciding whether an optimization is necessary.

**7. `<Profiler>` component?**
A built-in React component that calls an `onRender` callback after every render of its subtree. Works in production builds (unlike DevTools, which needs a development build or special profiling build). Used for real-user monitoring — track render times in production, alert when `actualDuration` exceeds a threshold.

**8. Verify an optimization worked?**
Record a baseline before optimizing. Record again after. Compare: did the number of commits for the relevant interaction decrease? Did the ranked chart show shorter times for the target component? Did "Why did this render?" for that component stop appearing in commits where it's unrelated?

**9. actualDuration equals baseDuration?**
Memoization isn't helping. The component re-executed its render function every time. Either `React.memo` isn't applied, or its props contain unstable references (new function/object on every parent render). Use "Why did this render?" to find the unstable prop.

**10. Before adding React.memo?**
Profile. Confirm the component actually renders more than it should. Identify which prop is unstable using "Why did this render?". Stabilize that prop first (with `useCallback`/`useMemo`). Then add `React.memo`. Skipping profiling means adding memo everywhere — which adds comparison overhead to components that don't need it.

---

## Senior-Level Thinking

**The Profiler changes how you think about optimization.**

Without it, optimization is intuition-based: "I think this component rerenders too much." With it, you have evidence: "this component rendered 87 times in 1 second, contributing 340ms of total render time." Decisions become quantitative. You can set a budget ("no component should take > 16ms on a mid-range phone") and measure against it.

**profiling = a conversation with React.**

Every rerender React makes is an answer to the question "what changed?" The Profiler lets you read React's answers. When you see 100 items rendering because their parent's `onSelect` prop is a new function reference, React is telling you: "I made 100 comparisons, all failed, I re-ran 100 functions — none were necessary." The fix (useCallback) is obvious once you see the answer.

**`<Profiler>` for regressions in CI.**

Add `<Profiler>` around critical UI sections. In your performance test suite, assert that `actualDuration` stays below a threshold for key interactions:

```jsx
test('ProductList renders <50ms on large dataset', () => {
  let renderTime;
  render(
    <Profiler id="test" onRender={(_, __, actual) => { renderTime = actual; }}>
      <ProductList products={largeDataset} />
    </Profiler>
  );
  expect(renderTime).toBeLessThan(50);
});
```

This catches performance regressions automatically — no manual profiling required.

---

## Revision Notes

- Profiler tab: record → interact → stop → read commits
- Flame chart: hierarchy per commit, width = time, gray = bailed out
- Ranked chart: total time per component across all commits — find the bottleneck
- "Why did this render?": enable in settings; shows State/Props changed or Parent rendered
- `actualDuration` < `baseDuration`: memo is working
- `actualDuration` ≈ `baseDuration`: memo is NOT working (unstable deps)
- Profile in production mode for real numbers
- `<Profiler>` API: programmatic, works in production, use for RUM and CI assertions
- Always: profile first → find the bottleneck → optimize → profile again

---

## Next Day Preview

**Day 29 — Why Did You Render**

The `@welldone-software/why-did-you-render` library: automatically detects and logs wasted renders with the exact prop or state values that changed. More detailed than DevTools for high-frequency render bugs in development.
