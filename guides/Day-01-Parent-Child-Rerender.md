# Day 1 — Parent & Child Rerender

## Objective

Understand **when and why React rerenders components**, starting with the most fundamental trigger: a parent component re-rendering.

This is the root cause of 80% of performance issues you'll encounter in real React apps. Before you can optimize anything, you must first deeply understand what "rerender" means, when it happens, and what React actually does during one.

---

## Real World Importance

In production apps this shows up as:

- A **navbar or sidebar** re-rendering every time a counter updates elsewhere on the page
- A **modal or tooltip** flickering because its parent holds unrelated state
- A **data table** re-rendering all 100 rows when only one filter value changed
- **Slow forms** where every keystroke causes the entire page subtree to reconcile
- **Chat UIs** where typing in an input re-renders the entire message list

This is not a beginner problem. Senior engineers ship this bug regularly because it's invisible until the app is slow.

---

## Concepts Covered

- What a "render" means in React (hint: it's not a DOM update)
- The React render cycle: trigger → render → commit
- How parent rerenders cascade to all children by default
- The difference between rendering and painting
- Reference equality and why it matters
- How to detect rerenders using `console.log` and React DevTools

---

## Exercise Task

Build this step by step. **Do not skip ahead.**

### Step 1 — Create the Parent

Create a `Parent` component with a `count` state and a button that increments it.

```jsx
// Parent.jsx
function Parent() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <h2>Parent Count: {count}</h2>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
      {/* children go here */}
    </div>
  );
}
```

### Step 2 — Create 3 Child Components

Each child receives **no props** for now. Just renders some static text.

```jsx
function ChildA() {
  return <div>Child A</div>;
}

function ChildB() {
  return <div>Child B</div>;
}

function ChildC() {
  return <div>Child C</div>;
}
```

### Step 3 — Add Render Logs to Every Component

Inside every component — Parent, ChildA, ChildB, ChildC — add this **as the very first line**:

```jsx
console.log("ChildA rendered");
```

Use a different label for each component.

### Step 4 — Render All Children Inside Parent

Place `<ChildA />`, `<ChildB />`, `<ChildC />` inside the `Parent` return.

### Step 5 — Open the Browser Console

Click the **Increment** button several times.

Watch the console carefully.

---

## What To Observe

- Every time you click **Increment**, all 4 `console.log` statements fire
- ChildA, ChildB, ChildC **all rerender** — even though none of them receive or use `count`
- The children have **no reason to change** but React still calls their function bodies
- Even if the JSX output of a child is identical, React still **calls the function again**

This is the default behavior. React does not skip children unless you explicitly tell it to.

---

## Internal React Explanation

### What does "render" actually mean?

In React, a **render is a function call**, not a DOM update.

When React "renders" `ChildA`, it calls the `ChildA()` function and gets back a JSX description (a plain JavaScript object). React does **not** immediately update the DOM.

The cycle is:

```
1. TRIGGER   → State changed, so React schedules a re-render
2. RENDER    → React calls the component function, gets new JSX tree
3. RECONCILE → React diffs the new tree against the previous one
4. COMMIT    → React applies only the actual DOM differences
```

So even if `ChildA` rerenders (step 2), the DOM might not change at all (step 4 finds no difference).

### Why do children rerender when the parent does?

React's default model is **top-down rendering**. When a component's state changes, React re-executes that component's function. The returned JSX includes child components. React sees those and re-executes them too — recursively down the subtree.

React does **not** automatically check "did this child's inputs change?" It just calls the function.

This is by design. The cost of calling a simple component function is tiny (microseconds). React optimizes for correctness first: always re-render means you'll never show stale UI.

### What does React actually compare?

After calling each component function, React compares the **new element object** with the **previous element object** using the reconciler.

For a child like `<ChildA />` with no props, the element object looks like:

```js
{ type: ChildA, props: {}, key: null }
```

React compares `type` (same function reference), `key` (both null), and `props` (empty object `{}`).

Here's the catch: `{}` and `{}` are **not equal in JavaScript**:

```js
{} === {}  // false — two different object references
```

But React does a **shallow prop comparison** only when you use `React.memo`. Without it, React doesn't compare props at all — it just re-renders.

### So nothing changed in the DOM?

Correct. In your exercise, clicking Increment:
- Rerenders Parent (✓ expected — count changed)
- Rerenders ChildA, ChildB, ChildC (function bodies called)
- Reconciler finds no DOM changes for children (output is the same)
- No DOM updates for children

The **waste** is the unnecessary function calls and reconciliation work. On small apps this is invisible. On complex trees with expensive renders, this becomes the bottleneck.

---

## Optimization Challenge

Now observe what happens if you pass a prop to a child:

**Step 1:** Pass `count` as a prop to `ChildA` only.

```jsx
<ChildA count={count} />
```

Display it in ChildA:

```jsx
function ChildA({ count }) {
  console.log("ChildA rendered");
  return <div>Child A: {count}</div>;
}
```

**Step 2:** Leave ChildB and ChildC without any props.

**Step 3:** Click Increment and observe.

> All three children still rerender. Even ChildB and ChildC with no props.

**Step 4:** Now try to prevent ChildB and ChildC from rerendering.

Without looking ahead, think: what mechanism would tell React "skip this component if its inputs haven't changed"?

Attempt it using `React.memo`:

```jsx
const ChildB = React.memo(function ChildB() {
  console.log("ChildB rendered");
  return <div>Child B</div>;
});
```

Wrap ChildC too. Click Increment now.

> ChildB and ChildC should stop rerendering. ChildA still rerenders because its `count` prop actually changes.

---

## Why This Optimization Works

`React.memo` wraps a component and memoizes its output. Before calling the component function, React checks: **are the new props shallowly equal to the previous props?**

If yes → skip the render, reuse the last output.
If no → render as normal.

For ChildB and ChildC with no props, the props object is always `{}`. Shallow equality check passes every time after the first render → they are skipped.

For ChildA receiving `count`, the prop value changes on every click → memo doesn't help here, and shouldn't.

We'll explore `React.memo` in depth on Day 2, including its failure cases.

---

## Common Mistakes

**Mistake 1: Thinking "rerender" = "DOM update"**

These are separate things. Rerender = function called. DOM update = actual browser change. React is smart enough to skip DOM updates when the output is the same. But the function call itself still has cost.

**Mistake 2: Assuming children with no props won't rerender**

No props does not mean no rerender. The default is always rerender. You must opt out explicitly.

**Mistake 3: Adding `React.memo` everywhere as a "fix"**

`React.memo` adds a cost: it runs a comparison on every render. If a component almost always rerenders (because props change frequently), you've added overhead with no benefit. Memo is only worth it when rerenders are frequent AND the output rarely changes.

**Mistake 4: Not checking render logs before optimizing**

Many developers apply `useMemo`, `useCallback`, `React.memo` blindly without first confirming what's actually rerendering. Always measure first.

**Mistake 5: Mutating state instead of replacing it**

If you do `obj.value = newVal` and then `setState(obj)`, React sees the same object reference and may skip the rerender entirely — even when the data changed. Always create new objects/arrays when updating state.

---

## Debugging Tools

### 1. console.log render count

The simplest approach. Put this at the top of any component:

```jsx
const renderCount = useRef(0);
renderCount.current++;
console.log(`ComponentName rendered ${renderCount.current} times`);
```

Using a `ref` (not state) means tracking the count doesn't itself cause a rerender.

### 2. React DevTools Profiler

Open React DevTools (browser extension) → **Profiler** tab → click Record → interact with the UI → Stop recording.

You'll see:
- Which components rendered during each interaction
- How long each render took
- Why each component rendered ("props changed", "state changed", "parent rendered")

The "Highlight updates when components render" option in React DevTools settings is also invaluable — it flashes a colored border around components as they rerender.

### 3. Why Did You Render (WDYR)

A library that patches React and logs unnecessary rerenders to the console with detailed reasons.

```bash
npm install @welldone-software/why-did-you-render
```

```jsx
// wdyr.js (import before React in index.js)
import React from 'react';
import whyDidYouRender from '@welldone-software/why-did-you-render';
whyDidYouRender(React, { trackAllPureComponents: true });
```

We'll use this more on Day 29, but you can set it up now to start seeing output.

---

## Interview Questions

1. What triggers a component to rerender in React?
2. If a parent rerenders, do all its children always rerender?
3. What is the difference between a React render and a DOM update?
4. What does "reconciliation" mean in React?
5. If a child component receives no props and the parent rerenders, will the child rerender?
6. What does `React.memo` actually do under the hood?
7. What is shallow comparison and why does React use it?
8. Can a component rerender without its state or props changing?
9. What is the React render cycle? Name the three phases.
10. Why is `{}` === `{}` false in JavaScript, and why does this matter for React props?

---

## Interview Answers

**1. What triggers a component to rerender?**
Three things: its own state changes, its own context changes, or its parent rerenders. Prop changes are a consequence of parent rerendering — React doesn't track prop changes independently.

**2. If a parent rerenders, do all its children always rerender?**
By default, yes. React calls child component functions when a parent rerenders, regardless of whether the child's props changed. You can override this with `React.memo`, which adds a shallow prop comparison before deciding whether to skip the render.

**3. What is the difference between a React render and a DOM update?**
A React render is calling the component function to produce a new JSX/element tree (pure JavaScript objects). A DOM update is actually modifying browser DOM nodes. React always renders before deciding what to commit to the DOM — and often a render produces output identical to the last one, resulting in zero DOM changes.

**4. What does "reconciliation" mean in React?**
Reconciliation is React's algorithm for diffing the new element tree against the previous one to determine the minimal set of DOM operations needed. It compares elements by type and key, and applies a heuristic O(n) algorithm rather than a true O(n³) tree diff.

**5. If a child receives no props and the parent rerenders, will the child rerender?**
Yes, by default. The absence of props does not prevent rerender. You need `React.memo` to opt out.

**6. What does `React.memo` actually do?**
It wraps a component and memoizes the last render output. On each parent rerender, before calling the component function, React performs a shallow comparison of the current props vs. previous props. If they're equal, React skips calling the function and reuses the cached output.

**7. What is shallow comparison?**
Comparing object properties one level deep using `===`. `{ a: 1 }` shallow-equals another `{ a: 1 }` because `1 === 1`. But `{ a: { b: 1 } }` does NOT shallow-equal another `{ a: { b: 1 } }` because the inner objects are different references.

**8. Can a component rerender without its state or props changing?**
Yes. If its parent rerenders, it rerenders too (unless wrapped in `React.memo`). Also, if it consumes a Context that changed, it rerenders even if the specific value it uses didn't change (a known pain point covered on Day 22).

**9. What are the three phases of the React render cycle?**
**Render phase**: React calls component functions to compute the new element tree. Pure/has no side effects. Can be interrupted by concurrent features.
**Commit phase**: React applies DOM mutations. Runs synchronously.
**Layout phase** (sub-phase of commit): `useLayoutEffect` runs synchronously after DOM mutations but before the browser paints.
After commit, `useEffect` runs asynchronously.

**10. Why does `{} === {}` matter for React props?**
Every time a component renders, inline object literals like `config={{ theme: 'dark' }}` create a new object reference. Even though the content is identical, `===` returns false. This breaks `React.memo`'s shallow comparison, causing the child to rerender anyway. Solution: `useMemo` to stabilize the reference (Day 4).

---

## Senior-Level Thinking

**Rerender is not your enemy by default.**

React's rendering is fast. Calling a simple component function takes microseconds. The real cost comes from:
- Components that do expensive computation inside the render (fix: `useMemo`)
- Components that trigger expensive DOM work when they rerender (fix: `React.memo` + stable props)
- Deep trees where a top-level rerender cascades through hundreds of components

**Don't optimize what you haven't measured.**

The temptation after Day 1 is to wrap everything in `React.memo`. Resist it. Memo adds a comparison cost. For cheap components that always rerender anyway (because their props change), you've added overhead with no gain and reduced readability.

**The right mental model:**

Think of React's default behavior as "always correct, sometimes wasteful." Optimization is about eliminating the wasteful rerenders where the correctness guarantee is already satisfied by other means.

**Production architecture note:**

In large apps, the most impactful optimization is usually **lifting state down** (keeping state as close as possible to where it's used) rather than memoization. A counter deep in the tree that affects only its own subtree should live there — not at the app root. Day 25 covers this in depth.

---

## Revision Notes

- **Render** = function call. **Commit** = DOM update. These are separate.
- Parent rerender → all children rerender **by default**.
- No props ≠ no rerender. Default is always rerender.
- `React.memo` = shallow prop comparison before deciding to skip.
- `{}` !== `{}` — new object on every render breaks memo.
- Measure before optimizing. Use React DevTools Profiler or console logs.
- Real fix is often "move state down" not "add memo everywhere."

---

## Next Day Preview

**Day 2 — React.memo Deep Dive**

We'll take `React.memo` apart completely:
- How the shallow comparison algorithm actually works
- When memo helps and when it silently fails
- The `areEqual` custom comparator
- Memo + function props (spoiler: it breaks — Day 3 fixes it)
- Profiling the before/after with React DevTools
