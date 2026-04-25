# Day 15 — Expensive Filtering

## Objective

Build a deliberately laggy search experience with 10,000 items, measure the performance problem, and fix it with `useMemo`. Understand when computation is "expensive enough" to memoize and how to measure the actual impact.

---

## Real World Importance

- Product catalog search (thousands of SKUs)
- Admin dashboards with large datasets filtered by multiple criteria
- Log viewers / analytics tables
- Code search, file explorer filtering
- Any search-as-you-type over a large local dataset

---

## Concepts Covered

- When computation inside render becomes the bottleneck
- How to generate large test datasets
- Measuring render time with `console.time` and React DevTools
- `useMemo` for expensive derived values
- The threshold: when is "expensive enough" to memoize
- Combining memoized filter with other memoized operations (sort, group)

---

## Exercise Task

### Step 1 — Generate 10,000 items

```jsx
// Generate once, outside component (stable reference)
const generateItems = (count) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Product ${i + 1}`,
    category: ['Electronics', 'Clothing', 'Food', 'Books', 'Sports'][i % 5],
    price: Math.round(Math.random() * 10000) / 100,
    rating: Math.round(Math.random() * 50) / 10,
    inStock: Math.random() > 0.3,
  }));
};

const ALL_ITEMS = generateItems(10000); // stable, generated once
```

### Step 2 — Build the laggy version

```jsx
// Presentational card — renders one product item
function ProductCard({ item }) {
  return (
    <div style={{ border: '1px solid #eee', padding: '8px 12px', marginBottom: 4, borderRadius: 4 }}>
      <strong>{item.name}</strong> — {item.category}
      <span style={{ marginLeft: 12 }}>${item.price.toFixed(2)}</span>
      <span style={{ marginLeft: 12 }}>⭐ {item.rating}</span>
      <span style={{ marginLeft: 12, color: item.inStock ? 'green' : 'red' }}>
        {item.inStock ? 'In stock' : 'Out of stock'}
      </span>
    </div>
  );
}

function ProductSearch() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState('name');
  const [unrelated, setUnrelated] = useState(0); // to trigger rerenders

  console.time('filter+sort');

  // Expensive: runs on EVERY render, including unrelated state changes
  const filtered = ALL_ITEMS
    .filter(item => {
      if (category !== 'All' && item.category !== category) return false;
      if (item.rating < minRating) return false;
      if (query && !item.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'price') return a.price - b.price;
      if (sortBy === 'rating') return b.rating - a.rating;
      return a.name.localeCompare(b.name);
    });

  console.timeEnd('filter+sort');

  return (
    <div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search products..."
      />
      <select value={category} onChange={e => setCategory(e.target.value)}>
        <option>All</option>
        <option>Electronics</option>
        <option>Clothing</option>
        <option>Food</option>
        <option>Books</option>
        <option>Sports</option>
      </select>
      <input
        type="range" min={0} max={5} step={0.5}
        value={minRating}
        onChange={e => setMinRating(Number(e.target.value))}
      />
      <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
        <option value="name">Name</option>
        <option value="price">Price</option>
        <option value="rating">Rating</option>
      </select>
      <button onClick={() => setUnrelated(n => n + 1)}>
        Unrelated update: {unrelated}
      </button>

      <p>{filtered.length} products found</p>
      <div>
        {filtered.slice(0, 50).map(item => ( // only render first 50
          <ProductCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
```

### Step 3 — Measure the problem

1. Open DevTools console
2. Click "Unrelated update" button
3. Watch `console.timeEnd` — filter+sort runs even for unrelated state changes
4. Type in the search box — notice input lag as filtering runs synchronously

### Step 4 — Fix with useMemo

```jsx
const filtered = useMemo(() => {
  console.time('filter+sort (memoized)');
  const result = ALL_ITEMS
    .filter(item => {
      if (category !== 'All' && item.category !== category) return false;
      if (item.rating < minRating) return false;
      if (query && !item.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'price') return a.price - b.price;
      if (sortBy === 'rating') return b.rating - a.rating;
      return a.name.localeCompare(b.name);
    });
  console.timeEnd('filter+sort (memoized)');
  return result;
}, [query, category, minRating, sortBy]);
```

Now click "Unrelated update". The filter+sort does NOT run — `console.time` doesn't appear. The result is cached.

### Step 5 — Measure the improvement

```jsx
const renderCount = useRef(0);
const computeCount = useRef(0);

const filtered = useMemo(() => {
  computeCount.current++;
  console.log(`Compute #${computeCount.current} (render #${renderCount.current})`);
  return ALL_ITEMS.filter(/* ... */).sort(/* ... */);
}, [query, category, minRating, sortBy]);

renderCount.current++;
```

Observe: computeCount only increments when filter/sort deps change. renderCount increments every render (including unrelated button clicks).

---

## What To Observe

- Without useMemo: filter+sort runs on EVERY render (console.time appears each time)
- Without useMemo: clicking "Unrelated update" triggers full 10k filter+sort
- With useMemo: filter+sort only runs when query, category, minRating, or sortBy change
- Render count vs compute count diverge after unrelated state changes
- Input may feel laggier without memoization (especially on slower devices)

---

## Internal React Explanation

### When does rendering become expensive?

React rendering has two costs:
1. **Component function call cost**: running the function body (including any inline computation)
2. **Reconciliation cost**: comparing old and new virtual DOM trees

For most components, both are fast. But `ALL_ITEMS.filter(...).sort(...)` over 10,000 objects is O(n log n) work — on slower hardware or complex filter functions, this can take 50-200ms per render. That's above the 16ms frame budget and causes visible jank.

### Why unrelated state triggers recompute

Without `useMemo`, the filter/sort logic is just code in the function body. React doesn't know it's expensive. It runs on every render regardless of whether the relevant inputs changed.

With `useMemo`, React skips the function body if deps haven't changed, returning the cached result in O(deps.length) time instead of O(n log n).

### The 16ms frame budget

Browser UI updates run at 60fps = 16.7ms per frame. If JavaScript runs for >16ms, the browser can't repaint during that frame. The user sees a visual stutter.

For a 10k item filter taking 20ms per render, every keystroke causes a visible stutter. With memoization, the filter only runs when the query changes — but that's unavoidable. The goal isn't to eliminate the compute, just to eliminate unnecessary repetitions of it.

---

## Optimization Challenge

**Challenge 1:** Add a "show in-stock only" toggle. Measure whether it needs memoization (hint: yes, it's another filter dep).

**Challenge 2:** Add pagination — show 20 items per page. Memoize the paginated slice separately from the filter (so changing pages doesn't trigger re-filtering).

**Challenge 3:** Implement multi-sort (sort by category, then by price within category). Measure the time difference before/after memoization for this more expensive sort.

**Challenge 4:** Move the "expensive filter" to a Web Worker for non-blocking UI during large dataset processing (advanced).

---

## Why This Optimization Works

`useMemo` short-circuits computation when inputs haven't changed. For a 10ms filter:

- Without memo: 10ms × N-renders-per-session = significant wasted time
- With memo: 10ms × N-filter-dep-changes-per-session (much less frequent)

The multiplier is the number of unrelated rerenders between actual filter changes. In a complex UI, this can be 10x or more.

---

## Common Mistakes

**Mistake 1: Memoizing cheap operations**

```jsx
const doubled = useMemo(() => count * 2, [count]);
```

Multiplication is nanoseconds. The memoization overhead is greater than the computation. Don't memoize arithmetic, string interpolation, or simple transformations.

**Mistake 2: Wrong deps → stale filter results**

```jsx
const filtered = useMemo(() => items.filter(i => i.category === category), [items]);
// Missing 'category' dep! Changing category won't update filtered.
```

**Mistake 3: Memoizing the list rendering too**

Some developers try to memoize the JSX list itself:

```jsx
const listJsx = useMemo(() =>
  filtered.map(item => <ProductCard key={item.id} item={item} />),
[filtered]);
```

JSX isn't expensive to create (it's just object creation). The expensive part is rendering component functions. Use `React.memo` on components to skip renders; don't memoize JSX creation.

**Mistake 4: Forgetting that filter creates a new array**

Even with `useMemo`, the filtered array is a new reference each time the deps change. If `ProductList` is a memoized child receiving `filtered` as a prop, it will rerender whenever filtering runs — because the array reference changed. This is correct behavior — the data changed.

---

## Debugging Tools

### console.time

```jsx
const filtered = useMemo(() => {
  console.time('filter');
  const result = heavyFilter(items);
  console.timeEnd('filter'); // shows time in ms
  return result;
}, [items, ...otherDeps]);
```

### React DevTools Profiler — "Why did this render?"

Enable "Record why each component rendered" in Profiler settings. After filtering, check if ProductCard shows "parent component rendered" unnecessarily.

### performance.measure

```jsx
const filtered = useMemo(() => {
  performance.mark('filter-start');
  const result = heavyFilter(items);
  performance.mark('filter-end');
  performance.measure('filter', 'filter-start', 'filter-end');
  return result;
}, [items]);
// View in DevTools Performance panel → User Timing
```

---

## Interview Questions

1. When is a computation "expensive enough" to warrant `useMemo`?
2. Why does `useMemo` not help if the deps change on every render?
3. What is the relationship between 16ms frame budget and computation cost?
4. Why does filter/sort run on every render without `useMemo`?
5. Should you memoize JSX (`<Component />` creation)?
6. What is the cost of `useMemo` itself?
7. How would you measure whether `useMemo` is actually helping?
8. If your dataset is 100 items instead of 10,000, should you still use `useMemo`?
9. What's the difference between memoizing the computation vs memoizing the component?
10. How do you handle filtering that's so expensive even `useMemo` doesn't help?

---

## Interview Answers

**1. When is computation expensive enough?**
A practical threshold: if the computation consistently takes >1ms and runs on renders where its deps haven't changed, memoization is likely worth it. More precisely: measure with `console.time`. If the difference between memo and no-memo is perceptible (input latency, frame drops), use memo.

**2. useMemo doesn't help if deps always change?**
If `useMemo(() => compute(), [x])` and `x` changes on every render, `useMemo` runs the factory every render anyway. You've added: dep array allocation, `Object.is` comparison, fiber state access — pure overhead. First stabilize the deps (fix the reference instability), then consider memo.

**3. 16ms frame budget?**
At 60fps, the browser has 16.7ms per frame for all JavaScript, layout, paint. If your computation takes 20ms, the frame is missed — users see a stutter. `useMemo` helps by ensuring the expensive computation only runs when its inputs actually changed, not on every frame.

**4. Filter/sort without useMemo?**
The filter/sort is just code in the component function body. It runs every time the component function runs — which is every render. React has no mechanism to skip inline computation; only `useMemo` provides that.

**5. Memoize JSX creation?**
No. JSX creation (e.g., `<ProductCard />`) is just creating a plain JavaScript object — essentially free. The expense is in rendering the component function and reconciling the tree. Use `React.memo` on the component itself to prevent unnecessary renders.

**6. Cost of useMemo itself?**
Reading from fiber state (linked list traversal), comparing each dep with `Object.is`, and on cache miss, running the factory + storing result. Small but non-zero. For a two-dep `useMemo`, the overhead is ~100ns — negligible compared to any computation taking >1ms.

**7. Measuring useMemo impact?**
Use `console.time` inside the factory to measure when it runs. Track render count (render ref) vs compute count (compute ref inside factory). Click unrelated controls and verify compute count doesn't change. Use the Performance panel to confirm the frame budget is met.

**8. 100 items — use useMemo?**
Probably not for filtering alone — 100-item filter is sub-millisecond. But if the result is passed to a memo'd child, `useMemo` is still useful for reference stability (prevents child from seeing a "new" array when nothing changed).

**9. Memoizing computation vs memoizing component?**
`useMemo` prevents re-running the computation. `React.memo` prevents re-running the component's render function. They address different costs: `useMemo` is for expensive derivations inside a component; `React.memo` is for expensive component renders in the tree.

**10. Computation too expensive even with memo?**
Options: (a) Web Worker — move computation off the main thread entirely; (b) chunked processing — split the computation across multiple frames using `requestIdleCallback`; (c) server-side filtering — send query to backend, return pre-filtered results; (d) indexing — pre-process data into a structure optimized for fast lookup.

---

## Senior-Level Thinking

**useMemo is not a crutch — it's the last resort for in-component computation.**

Before reaching for `useMemo`, ask:
1. Can this data come pre-filtered from the server? (Yes → don't filter client-side)
2. Can this computation move to a selector/store layer? (Redux selectors, Zustand computed)
3. Is the dataset small enough that filtering is imperceptible? (100 items → maybe no memo needed)

`useMemo` for client-side computation is correct when the dataset is large, the computation is genuinely local, and server-side filtering isn't feasible.

**The combination of useMemo + useDeferredValue is powerful.**

`useMemo` makes filtering efficient when deps change. `useDeferredValue` (Day 16) makes the UI responsive even while filtering is running — by letting the previous results show until the new ones are ready.

---

## Revision Notes

- Filter/sort on 10k items: O(n log n) — measurably expensive
- Without useMemo: runs on every render (including unrelated state changes)
- With useMemo: runs only when query, category, sort, rating change
- Threshold: > ~1ms computation that runs unnecessarily → memoize
- Don't memoize cheap math, don't memoize JSX creation
- Measure with console.time before and after
- useMemo deps must include everything the computation reads

---

## Next Day Preview

**Day 16 — useDeferredValue**

Even with memoized filtering, typing in a search box can feel sluggish because React prioritizes every keystroke as high-priority work. `useDeferredValue` tells React: "it's okay to show the old results while computing the new ones." Smooth input, deferred results.
