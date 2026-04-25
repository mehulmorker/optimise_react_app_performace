# Day 4 — useMemo & Object References

## Objective

Understand the **two distinct use cases** of `useMemo`: (1) stabilizing object/array references to prevent memo failures, and (2) caching expensive computed values to avoid re-computation. Most developers conflate these — knowing which problem you're solving determines whether `useMemo` is justified.

---

## Real World Importance

- Passing config objects to memoized components without breaking memo
- Filtering/sorting large datasets without re-running on every unrelated rerender
- Memoizing derived state from Redux/Zustand selectors
- Preventing context value recreation from triggering all consumers (Day 22)
- Avoiding recalculation of aggregated data (totals, statistics) on every render

---

## Concepts Covered

- Object and array reference identity (why `[]` !== `[]`)
- The two use cases of `useMemo`: reference stability vs expensive computation
- How `useMemo` stores values in fiber state
- Dependency array rules (same as `useCallback`)
- Measuring whether a computation is "expensive enough" to memoize
- When `useMemo` is definitely NOT worth it

---

## Exercise Task

### Step 1 — Object prop breaking memo

```jsx
function Dashboard() {
  const [theme, setTheme] = useState('light');
  const [unrelated, setUnrelated] = useState(0);

  const config = { theme, maxItems: 10 }; // new object every render

  return (
    <div>
      <button onClick={() => setUnrelated(n => n + 1)}>
        Unrelated update: {unrelated}
      </button>
      <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
        Toggle theme
      </button>
      <ProductGrid config={config} />
    </div>
  );
}

const ProductGrid = React.memo(function ProductGrid({ config }) {
  console.log('ProductGrid rendered, theme:', config.theme);
  return <div>Grid: {config.theme}</div>;
});
```

Click **Unrelated update**. `ProductGrid` rerenders even though `theme` didn't change.

### Step 2 — Stabilize with useMemo

```jsx
const config = useMemo(() => ({
  theme,
  maxItems: 10,
}), [theme]); // only recreate when theme changes
```

Click **Unrelated update** — `ProductGrid` no longer rerenders.
Click **Toggle theme** — `ProductGrid` rerenders because `config` reference changed (correctly).

### Step 3 — Array reference instability

```jsx
function TagFilter() {
  const [search, setSearch] = useState('');
  const allTags = ['React', 'Vue', 'Angular', 'Svelte', 'Next', 'Remix'];

  // This creates a new array every render
  const filteredTags = allTags.filter(tag =>
    tag.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <input value={search} onChange={e => setSearch(e.target.value)} />
      <TagList tags={filteredTags} />
    </div>
  );
}

const TagList = React.memo(function TagList({ tags }) {
  console.log('TagList rendered, count:', tags.length);
  return <div>{tags.map(t => <span key={t}>{t}</span>)}</div>;
});
```

Type the same character repeatedly (delete and retype). `TagList` rerenders on every keystroke even when the filter result is identical.

### Step 4 — Memoize the filtered array

```jsx
const filteredTags = useMemo(() =>
  allTags.filter(tag =>
    tag.toLowerCase().includes(search.toLowerCase())
  ),
[search]); // only re-filter when search changes
```

Now `TagList` only rerenders when the filter result actually has a new reference (when `search` changes).

### Step 5 — Simulate an expensive computation

Mount `ExpensiveStats` inside a parent that also has unrelated state:

```jsx
function StatsDashboard() {
  const [data] = useState([
    { value: 10 }, { value: 20 }, { value: 30 },
  ]);
  const [unrelated, setUnrelated] = useState(0);

  return (
    <div>
      <button onClick={() => setUnrelated(n => n + 1)}>
        Unrelated update: {unrelated}
      </button>
      <ExpensiveStats data={data} />
    </div>
  );
}

function ExpensiveStats({ data }) {
  const stats = useMemo(() => {
    console.log('Computing stats...');
    return data.reduce((acc, item) => {
      return { total: acc.total + item.value, count: acc.count + 1 };
    }, { total: 0, count: 0 });
  }, [data]);

  return <div>Total: {stats.total}, Count: {stats.count}</div>;
}
```

Click **Unrelated update** repeatedly. "Computing stats..." does not log — `useMemo` returns the cached value because `data` hasn't changed. The parent rerenders but the expensive computation is skipped.

---

## What To Observe

- Object/array literals create new references on every render — same as functions
- `useMemo` returns the same reference as long as deps are unchanged
- `React.memo` + `useMemo` together prevent child rerenders effectively
- "Computing stats..." log fires only when the dependency changes
- For cheap computations, `useMemo` overhead may not be worth it (profile!)

---

## Internal React Explanation

### Why `[] !== []`

Arrays and objects in JavaScript are heap-allocated. Each literal expression creates a new allocation:

```js
const a = [1, 2, 3];
const b = [1, 2, 3];
a === b; // false — two different heap addresses

const x = { key: 'value' };
const y = { key: 'value' };
x === y; // false — same content, different allocations
```

When React's shallow comparison sees a prop go from reference A to reference B, it considers the prop "changed" — even if the contents are identical. This bypasses `React.memo`.

### How useMemo stores values

`useMemo` uses the same fiber hook storage as `useState` and `useCallback`. Each hook invocation corresponds to a slot in the fiber's `memoizedState` linked list.

On the first render, `useMemo` runs the factory function, stores the result and deps in the fiber slot, and returns the result.

On subsequent renders, React compares the new deps with the stored deps using `Object.is`. If all deps are equal → returns the stored result (same reference). If any dep changed → runs the factory function again, stores new result and deps.

```
Fiber.memoizedState = {
  memoizedState: [cachedValue, [dep1, dep2]],
  next: null
}
```

### The order of hooks matters

React relies on **hooks being called in the same order every render** to map fiber slots correctly. This is why you can't call hooks conditionally. The nth call to `useMemo` always maps to the nth slot, regardless of what's stored there.

### useMemo vs variable assignment

```jsx
// NOT memoized — recalculated every render
const filtered = items.filter(i => i.active);

// Memoized — recalculated only when items or activeOnly changes
const filtered = useMemo(() =>
  items.filter(i => i.active),
[items]);
```

The first version always runs the filter. The second only runs it when `items` changes. For 10,000 items with a complex filter, this difference is significant.

---

## Optimization Challenge

**Challenge 1:** Build a `DataTable` with sortable columns. Memoize the sorted data so sorting computation doesn't re-run when unrelated state (e.g., page title) changes.

**Challenge 2:** Create a chart component that receives raw data and computes aggregated statistics. Memoize the aggregation. Add an unrelated UI element (theme toggle) and verify the computation doesn't re-run.

**Challenge 3:** Measure the actual time difference.

```jsx
const filtered = useMemo(() => {
  console.time('filter');
  const result = largeDataset.filter(/* complex logic */);
  console.timeEnd('filter');
  return result;
}, [largeDataset, searchQuery]);
```

Compare `console.time` output with and without `useMemo` by toggling unrelated state.

---

## Why This Optimization Works

**Case 1: Reference stability**
Same reference → `React.memo` shallow check passes → child skips render. The value isn't necessarily "expensive to compute" but the new reference was causing unnecessary work downstream.

**Case 2: Expensive computation**
The factory function is only called when deps change. On unrelated rerenders, the cached result is returned in O(deps.length) time (just dep comparison) instead of running O(n) computation.

Both cases reduce work — just different kinds of work.

---

## Common Mistakes

**Mistake 1: Memoizing cheap computations**

```jsx
// Not worth it — addition is nanoseconds
const total = useMemo(() => a + b, [a, b]);
// Better:
const total = a + b;
```

`useMemo` adds: allocating a deps array, running Object.is comparisons, accessing fiber state. For trivial math, this overhead is greater than just computing.

**Mistake 2: Memoizing values that always change**

If `deps` changes on every render, `useMemo` runs the factory every render anyway — you've added overhead with no benefit.

**Mistake 3: Relying on useMemo for correctness**

`useMemo` is a performance optimization hint. React may choose to discard cached values (e.g., during concurrent rendering features). Your component must be correct even if `useMemo` doesn't memoize. Don't use it to "prevent" side effects.

**Mistake 4: Deep dependencies**

```jsx
const result = useMemo(() => process(config), [config]);
```

If `config` is an object that's recreated every render, `config` as a dep always changes, and `useMemo` never caches. You'd need to either stabilize `config` itself (another `useMemo`) or use its primitive fields as deps.

**Mistake 5: Forgetting useMemo for context values**

A very common source of performance bugs:

```jsx
const ctx = { user, theme, dispatch }; // new object every render!
return <MyContext.Provider value={ctx}>...
```

Every consumer of `MyContext` rerenders on every parent render. Fix: `useMemo` on the context value. Day 22 covers this in depth.

---

## Debugging Tools

### Measuring computation time

```jsx
const result = useMemo(() => {
  const start = performance.now();
  const value = expensiveComputation(data);
  const end = performance.now();
  console.log(`Computation took: ${end - start}ms`);
  return value;
}, [data]);
```

If `end - start` is consistently under 1ms, `useMemo` is probably not worth it.

### React DevTools Profiler

Look at the "What caused this render?" tooltip. If a child component shows "prop changed" for an object prop that semantically didn't change, you need `useMemo` to stabilize it.

### Tracking recomputation

```jsx
const computationCount = useRef(0);
const result = useMemo(() => {
  computationCount.current++;
  console.log(`Computed ${computationCount.current} times`);
  return heavyWork(data);
}, [data]);
```

---

## Interview Questions

1. What are the two distinct use cases for `useMemo`?
2. Why is `[] !== []` in JavaScript and why does this matter in React?
3. How is `useMemo` implemented internally in React?
4. What's the difference between `useMemo` and just calculating a value inline?
5. Should you use `useMemo` for every calculation? Why or why not?
6. What happens if you use an object as a `useMemo` dependency?
7. Can you rely on `useMemo` for correctness (to prevent side effects)?
8. What's the performance cost of `useMemo` itself?
9. How does `useMemo` relate to `useCallback`?
10. When should you memoize a context value with `useMemo`?

---

## Interview Answers

**1. Two use cases for useMemo?**
(1) Reference stabilization: returning a stable object/array reference so that downstream `React.memo` checks can pass, even when the parent rerenders for unrelated reasons. (2) Expensive computation caching: avoiding re-running a costly calculation when its inputs haven't changed.

**2. Why `[] !== []`?**
Arrays and objects are reference types in JavaScript. Each literal creates a new allocation on the heap. `===` compares memory addresses, not content. Two literals with identical content live at different addresses. React's shallow comparison uses `===`, so a new object/array always appears "changed" even with identical data.

**3. How is useMemo implemented?**
It stores `[cachedValue, depsArray]` in a slot of the fiber's memoized state linked list. On rerender, it reads the stored deps, compares them to new deps with `Object.is`, and either returns the cached value or reruns the factory and updates the stored state.

**4. useMemo vs inline calculation?**
Inline: runs on every render, creates new reference every time. `useMemo`: runs only when deps change, returns same reference when deps unchanged. For cheap computations with stable deps, the difference is negligible or negative (useMemo overhead > computation cost). For expensive computations or when reference stability matters, `useMemo` wins.

**5. Should you useMemo everything?**
No. `useMemo` has overhead: dep array allocation, `Object.is` comparisons, fiber state access. For trivial calculations (arithmetic, string concatenation), this overhead exceeds the computation cost. Only use `useMemo` when (a) the computation is measurably expensive or (b) reference stability is needed for downstream optimization.

**6. Object as useMemo dependency?**
If the object is recreated every render (new reference), the dep comparison always fails and `useMemo` never caches. You'd need to either stabilize the object itself or use its primitive properties as individual deps.

**7. useMemo for correctness?**
Never. React may discard cached values during concurrent rendering. `useMemo` is explicitly documented as a performance hint, not a guarantee. Components must be correct whether `useMemo` caches or not.

**8. Performance cost of useMemo?**
Each `useMemo` call: reads from fiber state (linked list traversal), allocates deps array on first render, runs `Object.is` for each dep on every render. Small but non-zero. Matters when you have hundreds of `useMemo` calls in a single component tree.

**9. useMemo vs useCallback?**
`useCallback(fn, deps)` = `useMemo(() => fn, deps)`. Both memoize values in fiber state. `useCallback` is specialized for functions; `useMemo` is for any value. They're implementations of the same concept.

**10. When to memoize context value?**
Always when the context value is an object or array, and the providing component can rerender for reasons unrelated to the context data. Without memoization, every context consumer rerenders every time the provider's parent rerenders — even if the context data didn't change.

---

## Senior-Level Thinking

**"Should I useMemo this?" decision framework:**

1. Is this passed to a `React.memo` child as a prop? → Is the parent expected to rerender without this value changing? → Yes: memoize for reference stability.
2. Is this a computationally expensive operation on a large dataset? → Profile it. If > ~5ms on average hardware, memoize.
3. Is this used as a dep in `useEffect`, `useCallback`, or another `useMemo`? → Memoize to prevent cascading dep changes.
4. Is this a simple calculation on primitive values? → Don't memoize.

**The "profiler-first" discipline.**

Before adding any `useMemo`, measure the current performance. React DevTools Profiler shows render times per component. If a component renders in 0.2ms, memoizing something inside it will save at most 0.2ms — probably not worth the complexity.

**Selector patterns as an alternative.**

Libraries like Reselect (for Redux) and Jotai/Zustand selectors provide memoized derived state at the data layer level, outside of components. This is often cleaner than scattering `useMemo` throughout component code — the memoization lives where the data does.

---

## Revision Notes

- `[] !== []` and `{} !== {}` — reference types, not value types
- `useMemo` use case 1: reference stability for memo'd children
- `useMemo` use case 2: avoid re-running expensive computations
- Internally: stores `[value, deps]` in fiber slot, compares deps with `Object.is`
- `useMemo` = `useCallback` for non-function values
- Never use `useMemo` for correctness — it's a performance hint, not a guarantee
- Measure before memoizing — cheap computations don't need it
- Context values should almost always be memoized

---

## Next Day Preview

**Day 5 — Keys & Reconciliation**

How React uses `key` props to match elements across renders. Why using array index as a key causes subtle bugs. What happens during list reconciliation. The difference between remounting and rerendering.
