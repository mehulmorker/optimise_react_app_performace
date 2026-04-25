# Day 2 — React.memo

## Objective

Understand exactly how `React.memo` works, when it saves rerenders, and critically — when it **silently fails**. Most developers use `React.memo` without understanding its failure modes and end up with wasted overhead and zero benefit.

---

## Real World Importance

- Product card lists where only one card's data changed but all cards rerender
- Dashboard widgets that rerender whenever any unrelated metric updates
- Sidebar navigation that rerenders on every route-level state change
- Table rows that rerender when parent page state changes (search text, pagination)
- Any component that is "expensive to render" but receives stable props most of the time

---

## Concepts Covered

- How `React.memo` performs shallow comparison
- What "shallow" means exactly and where it breaks
- The `areEqual` custom comparator (second argument to `React.memo`)
- Why function and object props break memo
- When memo adds cost with zero benefit
- How to verify memo is actually working

---

## Exercise Task

### Step 1 — Build the baseline (no memo)

Create a `ProductList` parent with a list of 5 product names and a separate `discount` state.

```jsx
function ProductList() {
  const [discount, setDiscount] = useState(0);
  const products = ['Shoes', 'Hat', 'Bag', 'Watch', 'Belt'];

  return (
    <div>
      <button onClick={() => setDiscount(d => d + 5)}>
        Apply Discount: {discount}%
      </button>
      {products.map(name => (
        <ProductCard key={name} name={name} />
      ))}
    </div>
  );
}

function ProductCard({ name }) {
  console.log(`ProductCard rendered: ${name}`);
  return <div>{name}</div>;
}
```

Click **Apply Discount** and observe: all 5 cards rerender even though `name` never changes.

### Step 2 — Wrap with React.memo

```jsx
const ProductCard = React.memo(function ProductCard({ name }) {
  console.log(`ProductCard rendered: ${name}`);
  return <div>{name}</div>;
});
```

Click **Apply Discount** again. Cards should no longer rerender.

### Step 3 — Break it with an object prop

Now pass a `style` prop as an inline object:

```jsx
<ProductCard key={name} name={name} style={{ color: 'black' }} />
```

Click **Apply Discount**. All cards rerender again despite `React.memo`. Understand why before moving to Step 4.

### Step 4 — Break it with a function prop

Pass an inline click handler:

```jsx
<ProductCard
  key={name}
  name={name}
  onClick={() => console.log(name)}
/>
```

Same result — memo fails. Each render creates a new function reference.

### Step 5 — Observe with React DevTools

Open React DevTools → Profiler → Record → click Apply Discount → Stop.

Compare the flamegraph with and without memo. Note the "Why did this render?" tooltip.

---

## What To Observe

- Without memo: all 5 cards rerender on every discount change
- With memo + stable string prop: cards skip rerender entirely
- With memo + inline object prop: memo fails, all cards rerender
- With memo + inline function prop: memo fails, all cards rerender
- The `console.log` inside cards fires or doesn't fire based on whether memo bails out
- React DevTools shows "rendered by parent" vs "memo" in the profiler

---

## Internal React Explanation

### How React.memo works

`React.memo` is a **higher-order component** (a function that returns a component). It wraps your component in a special fiber type that holds the **previous props** in memory.

When the parent rerenders and React encounters `<ProductCard name="Shoes" />`, instead of immediately calling `ProductCard()`, React first runs:

```js
arePropsEqual(prevProps, nextProps)
```

The default implementation does a **shallow equality check** over all prop keys:

```js
function shallowEqual(prev, next) {
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);

  if (prevKeys.length !== nextKeys.length) return false;

  for (let key of prevKeys) {
    if (prev[key] !== next[key]) return false;  // strict ===
  }

  return true;
}
```

If `shallowEqual` returns `true` → React reuses the last fiber output, skipping the function call entirely.

If `shallowEqual` returns `false` → React calls the component function as normal.

### Why "shallow" breaks on objects and functions

`===` for objects and functions compares **reference identity**, not content:

```js
{ color: 'black' } === { color: 'black' }  // false — different objects
(() => {}) === (() => {})                   // false — different functions
'Shoes' === 'Shoes'                        // true  — primitives compare by value
```

Every time the parent renders, `{ color: 'black' }` creates a **new object in memory** even though its content is identical. The shallow check sees two different references and returns false. Memo is bypassed.

### The custom comparator

`React.memo` accepts a second argument: a custom equality function.

```jsx
const ProductCard = React.memo(
  function ProductCard({ name, config }) {
    return <div style={config}>{name}</div>;
  },
  (prevProps, nextProps) => {
    // return true to SKIP rerender (props are "equal")
    // return false to ALLOW rerender
    return (
      prevProps.name === nextProps.name &&
      prevProps.config.color === nextProps.config.color
    );
  }
);
```

Note: the semantics are **inverted** compared to `shouldComponentUpdate`. Return `true` means "equal, skip render." Return `false` means "different, rerender."

This is rarely the right solution. The better fix is to **stabilize the prop reference** at the parent level using `useMemo` or `useCallback` — covered on Days 3 and 4.

### React fiber and memoization

Internally, React stores a `memoizedProps` field on each fiber node. `React.memo` tells React's reconciler: before reconciling this fiber, do a bailout check. If the check passes, mark this subtree as "no work needed" and skip it entirely. This is called a **bailout**.

A bailout doesn't just skip one component — it skips the **entire subtree** rooted at that component. This is why memo on a parent component that contains many children can be very impactful.

---

## Optimization Challenge

**Challenge 1:** Fix the object prop case without changing `ProductCard`.

In `ProductList`, move the style object outside the component (or memoize it):

```jsx
const cardStyle = { color: 'black' }; // defined once, stable reference

function ProductList() {
  // ...
  return products.map(name => (
    <ProductCard key={name} name={name} style={cardStyle} />
  ));
}
```

Verify memo works again.

**Challenge 2:** Fix the function prop case.

Move the handler to `useCallback` (preview of Day 3):

```jsx
const handleClick = useCallback((name) => {
  console.log(name);
}, []); // stable reference across renders

<ProductCard key={name} name={name} onClick={handleClick} />
```

**Challenge 3:** Measure the performance difference.

Use `React.memo` on a component that renders 100 items and does something "expensive" (e.g., rendering a long description). Profile with and without memo.

---

## Why This Optimization Works

When memo successfully bails out:

1. React skips calling the component function entirely (no reconciliation work for this subtree)
2. The previous fiber tree is reused as-is
3. No virtual DOM diffing happens for the skipped subtree
4. No DOM mutations are considered for the skipped subtree

The savings scale with **subtree size**. If a memoized component has 50 descendant components, all 50 are skipped on a successful bailout.

---

## Common Mistakes

**Mistake 1: Wrapping everything in React.memo**

Memo adds cost: a comparison on every render cycle. For components that frequently rerender (because their props genuinely change), you've added work with no benefit. Profile first.

**Mistake 2: Thinking memo prevents all rerenders**

Memo only prevents rerenders caused by **parent rerenders with unchanged props**. If the component's own state changes, it still rerenders. If context it subscribes to changes, it still rerenders.

**Mistake 3: Assuming memo handles deep objects**

Passing `user={{ name: 'Alice', address: { city: 'NYC' } }}` — if `user` is a new object reference each render, memo will fail even if all nested values are identical.

**Mistake 4: Using memo on components that always receive new props**

A `SearchInput` that receives the current query string — the query changes on every keystroke. Memo runs the comparison every render and never bails out. Pure overhead.

**Mistake 5: Forgetting that children are props too**

`<Wrapper><Child /></Wrapper>` — the `children` prop is a JSX element created fresh on every render. If Wrapper is wrapped in `React.memo`, it will still rerender because `children` (an object) fails the `===` check every time.

---

## Debugging Tools

### Confirming memo is working

```jsx
const ProductCard = React.memo(function ProductCard({ name }) {
  const renderCount = useRef(0);
  renderCount.current++;
  console.log(`ProductCard[${name}] render #${renderCount.current}`);
  return <div>{name}</div>;
});
```

If the count stays at 1 after multiple parent rerenders, memo is working.

### React DevTools — Component panel

Click a component in the DevTools tree. You'll see "Memo" badge if wrapped. The "Why did this render?" section in the Profiler explains each rerender cause.

### Why Did You Render

```jsx
ProductCard.whyDidYouRender = true;
```

WDYR will log when a memoized component rerenders due to props that are deeply equal but not referentially equal — highlighting exactly where you need `useMemo`/`useCallback`.

---

## Interview Questions

1. What does `React.memo` do and how does it work internally?
2. What is shallow comparison? When does it fail?
3. What is the second argument to `React.memo` and when would you use it?
4. Can a `React.memo` component still rerender? When?
5. Why do inline object props break `React.memo`?
6. Why do inline function props break `React.memo`?
7. What is a "bailout" in React's reconciler?
8. What's the performance cost of `React.memo` itself?
9. If I wrap a parent in `React.memo` and memo bails out, do the children also skip rendering?
10. What's the difference between `React.memo` and `React.PureComponent`?

---

## Interview Answers

**1. What does React.memo do?**
It's a HOC that memoizes a component's output. Before re-rendering, it compares current props with previous props using shallow equality. If equal, it skips the render and reuses the last output. If not equal, it renders normally.

**2. What is shallow comparison? When does it fail?**
Shallow comparison checks each prop key with `===`. It works perfectly for primitives (strings, numbers, booleans). It fails for objects and functions because `===` checks reference identity, not content — new object/function literals always fail even with identical content.

**3. Second argument to React.memo?**
A custom `areEqual(prevProps, nextProps)` function. Returns `true` to skip rerender, `false` to allow it. Use when you need deep comparison for a specific prop or want to ignore certain props entirely. Rarely needed — usually better to fix the prop reference with `useMemo`.

**4. Can a memo component still rerender?**
Yes. Memo only prevents rerenders from parent rerenders with unchanged props. The component still rerenders when: (a) its own state changes, (b) a context it subscribes to changes, (c) a custom hook it uses triggers a rerender.

**5. Why do inline objects break memo?**
`{ color: 'black' }` creates a new object reference on every render. `===` between two different object references is `false`, so the shallow check fails and memo rerenders.

**6. Why do inline functions break memo?**
`() => {}` creates a new function object on every render. Same reference identity issue as objects. Fix with `useCallback`.

**7. What is a bailout?**
When React determines that a component's output won't change (via `React.memo`, `shouldComponentUpdate`, or pure hooks), it "bails out" — skips calling the component function, skips reconciling the subtree, and reuses the previously committed fiber tree.

**8. Cost of React.memo?**
A shallow comparison of all props on every render cycle. Cost is O(number of props). For components with few props and frequent bailouts, this is negligible. For components with many props that always change, it's pure overhead.

**9. If parent memo bails out, do children skip too?**
Yes. A bailout skips the entire subtree. React doesn't descend into the memoized component's children at all if the bailout succeeds.

**10. React.memo vs React.PureComponent?**
Both do shallow prop comparison. `PureComponent` is for class components and also does shallow `state` comparison in `shouldComponentUpdate`. `React.memo` is for function components and only compares props (function components manage state via hooks, not `this.state`).

---

## Senior-Level Thinking

**The real question is: why are your props changing in the first place?**

If you're adding `React.memo` to fight prop instability, you're treating symptoms. The better question is: why is the parent creating new object/function references on every render? Usually the answer is poor state placement or missing `useMemo`/`useCallback` at the source.

**Memo is a bailout, not a performance budget.**

Don't think "I'll memo this component and it'll be fast." Think "I'll memo this component because its props are stable and the render is expensive." Both conditions must be true for memo to be worth it.

**Children composition pattern avoids memo entirely.**

Instead of:
```jsx
// Parent rerenders → Wrapper rerenders → Child rerenders
<Wrapper>
  <Child />
</Wrapper>
```

You can sometimes restructure so the stable child is passed as a prop:
```jsx
// Child is created in a scope that doesn't rerender
// Wrapper can rerender freely without affecting Child
<Wrapper child={<Child />} />
```

This is a powerful pattern that avoids memo completely by using React's composition model. Day 25 (State Locality) will revisit this.

---

## Revision Notes

- `React.memo` = shallow prop comparison before deciding to skip render
- Shallow = `===` per key — works for primitives, fails for objects/functions
- Bailout skips the **entire subtree**, not just the memoized component
- Memo has cost: comparison on every render cycle
- Fix object props with `useMemo`, fix function props with `useCallback`
- Memo doesn't prevent rerenders from own state or context changes
- Profile before adding memo — measure, don't guess

---

## Next Day Preview

**Day 3 — useCallback & Function Identity**

Why inline function props are the #1 cause of memo failures. How `useCallback` creates stable function references. The dependency array trap. When `useCallback` helps vs when it's pure overhead.
