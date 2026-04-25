# Day 10 — Infinite useEffect Loops

## Objective

Understand every pattern that causes `useEffect` to run infinitely, why it happens, and how to fix each one. Infinite loops are silent by default — no crash, just a browser tab freezing or a network being flooded. You must recognize the patterns to stop them before they reach production.

---

## Real World Importance

- API endpoint called hundreds of times per second, hitting rate limits
- Browser tab locking up silently because the render-effect cycle spirals
- WebSocket reconnecting in an infinite loop
- localStorage being written on every render
- State updates inside effects causing rerenders that trigger effects again

---

## Concepts Covered

- The useEffect re-run model: runs after every render where deps changed
- Pattern 1: no dependency array — runs on every render
- Pattern 2: setting state without deps restriction — triggers rerender → reruns effect
- Pattern 3: object/array in deps — new reference every render
- Pattern 4: function in deps — new reference every render
- Pattern 5: deps that depend on state updated inside the effect
- How to think about effects correctly: "synchronize with external world"

---

## Exercise Task

### Step 1 — The simplest infinite loop

ç```jsx
function InfiniteLoop1() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(count + 1); // state update → rerender → effect runs → state update → ...
  }); // no dependency array!

  return <div>{count}</div>;
}
```

Mount this component. The count increments rapidly until the browser freezes. This is because **no dep array means "run after every render."** The effect sets state → triggers render → effect runs again → infinite.

**Before testing**, add a safety guard:

```jsx
useEffect(() => {
  if (count < 5) setCount(count + 1); // limited for safety
});
```

Observe 5 rapid renders.

### Step 2 — State in deps, set inside effect

```jsx
function InfiniteLoop2() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/data')
      .then(r => r.json())
      .then(json => setData(json)); // setData → rerender → data changes → effect reruns
  }, [data]); // data is dep, effect updates data

  return <div>{JSON.stringify(data)}</div>;
}
```

The fetch fires, updates `data`, which is a dep, which reruns the effect, which fetches again. Infinite fetch loop. Fix: remove `data` from deps (the effect doesn't read `data`).

```jsx
useEffect(() => {
  fetch('/api/data')
    .then(r => r.json())
    .then(json => setData(json));
}, []); // run once on mount
```

### Step 3 — Object reference in deps

```jsx
function InfiniteLoop3() {
  const [result, setResult] = useState('');
  const config = { endpoint: '/api', timeout: 3000 }; // new object every render!

  useEffect(() => {
    fetchData(config).then(setResult);
  }, [config]); // config changes every render → infinite fetching

  return <div>{result}</div>;
}
```

Fix with `useMemo`:

```jsx
const config = useMemo(() => ({ endpoint: '/api', timeout: 3000 }), []);
```

Or use primitive deps:

```jsx
useEffect(() => {
  fetchData({ endpoint: '/api', timeout: 3000 }).then(setResult);
}, []); // no object in deps at all
```

### Step 4 — Function in deps

```jsx
function InfiniteLoop4({ userId }) {
  const [user, setUser] = useState(null);

  const fetchUser = () => { // new function every render
    return fetch(`/api/users/${userId}`).then(r => r.json());
  };

  useEffect(() => {
    fetchUser().then(setUser);
  }, [fetchUser]); // new function → effect reruns → new function → ...

  return <div>{user?.name}</div>;
}
```

Fix with `useCallback`:

```jsx
const fetchUser = useCallback(() => {
  return fetch(`/api/users/${userId}`).then(r => r.json());
}, [userId]); // stable unless userId changes
```

Or inline the fetch logic:

```jsx
useEffect(() => {
  fetch(`/api/users/${userId}`).then(r => r.json()).then(setUser);
}, [userId]); // only dep is the primitive userId
```

### Step 5 — The spread/map trap

```jsx
function InfiniteLoop5({ items }) {
  const [processed, setProcessed] = useState([]);

  useEffect(() => {
    setProcessed(items.map(item => ({ ...item, processed: true })));
  }, [items, processed]); // processed is dep, but effect updates it!

  return <ul>{processed.map(i => <li key={i.id}>{i.name}</li>)}</ul>;
}
```

Remove `processed` from deps — the effect doesn't need to read it:

```jsx
useEffect(() => {
  setProcessed(items.map(item => ({ ...item, processed: true })));
}, [items]); // only dep is the source data
```

---

## What To Observe

- No deps: effect runs after every render (observe rapid state increments)
- Setting state in effect with that state as dep: fetch/update loop
- Object/array in deps: `{} !== {}` → effect reruns every render
- Function in deps without `useCallback`: same reference issue
- Incorrect dep inclusion: adding state that the effect writes to as a dep

---

## Internal React Explanation

### The useEffect execution model

React runs `useEffect` after every render where the dependency values changed. The lifecycle:

```
Component renders
  → React commits to DOM
  → Browser paints
  → useEffect runs (if deps changed)
    → if effect updates state:
      → component rerenders
      → React commits to DOM
      → browser paints
      → useEffect runs again (if deps changed again)
```

The key insight: **if an effect updates state, it causes a rerender, which may cause the effect to run again.** This feedback loop is the source of all infinite loops.

### Why no dep array means "every render"

An absent deps array is NOT the same as `[]`. The semantics:

- No array: "run after every render"
- `[]`: "run once after mount"  
- `[a, b]`: "run when `a` or `b` changes"

This is a deliberate design — for effects that should always re-synchronize (e.g., `document.title = pageTitle`), no array is correct. But combining with `setState` creates the loop.

### Object.is comparison for deps

React compares deps using `Object.is(prev, next)`:

```js
Object.is(1, 1)         // true
Object.is('a', 'a')     // true
Object.is({}, {})       // false — different references!
Object.is([], [])       // false — different references!
Object.is(fn, fn)       // true IF same reference
```

A new object or array literal always returns `false` with `Object.is`. Effect sees "dep changed" every render → reruns every render.

### The "synchronization" mental model

The correct way to think about `useEffect`:

> An effect describes how to synchronize React state with some external system (DOM, API, timer, subscription). It should run when the data it needs to do the synchronization has changed.

Ask: **What external thing is this effect synchronizing?** The deps should be exactly the values the synchronization logic depends on — no more, no less.

If you're unsure what to put in deps, ask: "If X changes, does the external system need to be re-synchronized?" If yes → X is a dep. If no → X shouldn't be a dep.

---

## Optimization Challenge

**Challenge 1:** Find and fix 3 infinite loops in this code:

```jsx
function BuggedComponent({ config, onData }) {
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const processor = (d) => d.map(x => x * 2);

  useEffect(() => {
    fetch(config.url)
      .then(r => r.json())
      .then(json => setData(processor(json)))
      .catch(setError);
  }, [config, data, processor, onData]);

  useEffect(() => {
    if (data.length > 0) onData(data);
  }, [data, onData]);

  return <div>{error ? error.message : data.join(', ')}</div>;
}
```

Identify each bug. Fix each one.

**Challenge 2:** Build an effect that polls an API every 5 seconds. Ensure it stops polling when the component unmounts and doesn't infinite loop.

---

## Why This Optimization Works

Correct dependency arrays mean effects run **only when they actually need to**:

- Network requests only fire when their input data changes
- Subscriptions only reinstantiate when the subscribed value changes
- DOM synchronization only runs when the relevant state changes

This makes effects predictable, testable, and prevents runaway network/state cycles.

---

## Common Mistakes

**Mistake 1: ESLint says "add dep" but adding it creates a loop**

If `exhaustive-deps` lint rule tells you to add `X` to deps but adding `X` causes a loop because the effect sets `X`, the real bug is that the effect logic is wrong — not the dep array. Restructure the logic. Never disable the lint rule to hide a real bug.

**Mistake 2: Adding everything to deps "to be safe"**

Adding state that the effect sets creates a loop. Only add values the effect **reads** (not writes). For values the effect writes, use functional state updates or `useReducer` to break the dependency.

**Mistake 3: Using `JSON.stringify(obj)` in deps as a "deep compare"**

```jsx
useEffect(() => { ... }, [JSON.stringify(config)]);
```

This is a hack that: (a) runs JSON.stringify on every render, (b) doesn't work for non-serializable values (functions, undefined, circular refs). Fix the reference stability problem at the source instead.

**Mistake 4: Defining functions inside the component that are used in effects**

Either move the function inside the effect or wrap it in `useCallback`. Functions defined in the component body are recreated every render — if used as effect deps, they cause the effect to rerun every render.

**Mistake 5: Not including all actual dependencies**

Omitting a dep to prevent a loop when the dep should be there creates a stale closure bug. The effect runs with old data. The correct fix is restructuring the effect, not omitting the dep.

---

## Debugging Tools

### Detect before it happens

```jsx
// Add a loop guard during development
let runCount = 0;
useEffect(() => {
  runCount++;
  if (runCount > 10) {
    console.error('Possible infinite loop detected!');
    return;
  }
  // effect logic
}, [deps]);
```

### Network tab in DevTools

Open Network tab. If you see the same API endpoint called hundreds of times, you have an infinite fetch loop. Pause JavaScript (Sources → Pause) during a request flood to see the call stack.

### React DevTools Profiler

An infinite loop shows as many rapid commits in the profiler timeline. Each commit takes a few ms. A component with 100+ commits in 1 second is a red flag.

### The `useEffect` log pattern

```jsx
useEffect(() => {
  console.log('Effect ran. Deps:', { dep1, dep2 });
  // effect logic
}, [dep1, dep2]);
```

If this logs more than expected, investigate why deps are changing.

---

## Interview Questions

1. What causes an infinite `useEffect` loop?
2. What is the difference between no dep array, `[]`, and `[a, b]`?
3. Why do object/array values in deps cause effects to rerun every render?
4. How should you think about what goes in the dependency array?
5. What's wrong with having `setX` depend on `X` in the same effect?
6. How do you fetch data in a useEffect without infinite loops?
7. When is it valid to have an empty deps array `[]`?
8. What does `Object.is` do and why does React use it for dep comparison?
9. Why should you never disable the `exhaustive-deps` ESLint rule?
10. What is the correct mental model for `useEffect`?

---

## Interview Answers

**1. What causes infinite useEffect loops?**
An effect that updates state which is either: (a) directly listed as a dep, causing the effect to rerun after the state update, or (b) causes the component to rerender with new reference-type deps (objects, functions, arrays) that compare as different on every render.

**2. No array vs `[]` vs `[a, b]`?**
No array: runs after every render. `[]`: runs once after initial mount (empty deps never change). `[a, b]`: runs after any render where `a` or `b` changed (compared with `Object.is`).

**3. Objects/arrays in deps?**
`Object.is({}, {})` is `false` — different references. A new object literal in the component body creates a new reference every render. React's dep comparison sees "deps changed" every render, so it reruns the effect every render.

**4. What goes in deps?**
Every value from the component scope that the effect **reads** and that could change between renders. Exclude: stable references (`setState`, `dispatch`, `useRef.current`), constants defined outside the component. The rule: if the dep changed and the effect's behavior should be different, include it.

**5. Setting state that's in deps?**
The state update causes a rerender → dep value changes → effect reruns → state update → loop. Fix: use functional state updates so the effect doesn't need to read the current state, then remove it from deps.

**6. Fetch data without infinite loops?**
Put the effect in `[]` if you only need the data once. If you need to re-fetch when params change, use the params as deps (not the result data). Never include the state variable being set as a dep.

**7. Valid empty deps `[]`?**
When the effect only needs to run once: subscriptions set up on mount, one-time DOM measurements, single API calls where the data doesn't change based on any component state.

**8. Object.is?**
JavaScript's strict equality that handles edge cases: `Object.is(NaN, NaN)` is `true` (unlike `===`), `Object.is(0, -0)` is `false` (unlike `===`). React uses it because it's more semantically correct for dep tracking than `===`.

**9. Never disable exhaustive-deps?**
The rule catches missing deps that cause stale closures (effect uses old data). Disabling it hides bugs. If adding a dep creates a loop, the loop is the real bug — fix the logic, not the lint rule.

**10. Correct mental model for useEffect?**
An effect is "synchronization code" — it keeps an external system in sync with React state. It should run whenever its inputs change enough that the external system needs to be re-synchronized. Think: "What external thing does this effect manage, and when should it be re-managed?"

---

## Senior-Level Thinking

**Effects are for external synchronization, not for derived state.**

A common pattern that causes loops: using an effect to compute derived state from other state. This is always wrong:

```jsx
// Wrong — creates a loop or is just unnecessary
useEffect(() => {
  setFullName(`${firstName} ${lastName}`);
}, [firstName, lastName]);

// Right — derived state belongs in render
const fullName = `${firstName} ${lastName}`;
```

Effects that update state based on other state should almost always be refactored to derived values, `useMemo`, or `useReducer`.

**The `useEffectEvent` RFC (React 19).**

React's team recognized that putting event callbacks in effect deps causes instability. The proposed `useEffectEvent` hook (experimental) creates a callback that's "always current" (not stale) but not reactive (not a dep). This solves the pattern where you want to call a callback from an effect without making it a dep.

---

## Revision Notes

- No dep array = runs every render = high chance of infinite loop with setState
- Object/array literals = new reference every render = effect reruns every render
- Function defined in component = new reference every render = same problem
- Effect that sets state → state in deps → loop
- Fix: remove the "written" state from deps, use functional updates
- Fix: memoize objects/functions (useMemo/useCallback) before putting in deps
- Never disable exhaustive-deps ESLint rule — it's catching real bugs

---

## Next Day Preview

**Day 11 — Stale Closures**

The subtlest React bug: when a function captures a variable that later changes, but the function keeps using the old value. How this manifests in timers, event listeners, and async operations — and the patterns to fix it.
