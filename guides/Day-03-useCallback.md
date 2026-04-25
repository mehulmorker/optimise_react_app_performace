# Day 3 — useCallback & Function Identity

## Objective

Understand why **function identity** matters in React, how JavaScript closures interact with component renders, and how `useCallback` creates a stable function reference to prevent memo failures and unnecessary child rerenders.

This is the direct solution to the function-prop problem you discovered on Day 2.

---

## Real World Importance

- Passing `onDelete`, `onEdit`, `onSelect` handlers to memoized list items
- Passing event handlers from a container component down to presentational children
- Passing callbacks to custom hooks that use them in `useEffect`
- Preventing `useEffect` from re-running because a callback prop "changed" (even though logic didn't)
- Event handlers in data grids, dropdowns, modals that should not cause full list rerenders

---

## Concepts Covered

- JavaScript closure mechanics inside React components
- Why every render creates a new function instance
- How `useCallback` memoizes a function reference
- The dependency array — what to include, why
- Stale closure risk inside `useCallback`
- When `useCallback` actually helps vs when it's overhead
- The relationship between `useCallback` and `React.memo`

---

## Exercise Task

### Step 1 — Build the baseline

Create a `TaskList` parent with a list of tasks and a `completedCount` state.

```jsx
function TaskList() {
  const [completedCount, setCompletedCount] = useState(0);
  const tasks = ['Write tests', 'Review PR', 'Deploy', 'Update docs'];

  const handleComplete = (task) => {
    console.log(`Completed: ${task}`);
    setCompletedCount(c => c + 1);
  };

  return (
    <div>
      <p>Completed: {completedCount}</p>
      {tasks.map(task => (
        <TaskItem key={task} task={task} onComplete={handleComplete} />
      ))}
    </div>
  );
}

const TaskItem = React.memo(function TaskItem({ task, onComplete }) {
  console.log(`TaskItem rendered: ${task}`);
  return (
    <div>
      {task}
      <button onClick={() => onComplete(task)}>Done</button>
    </div>
  );
});
```

Click **Done** on any task. Observe all `TaskItem` components rerender despite `React.memo`.

### Step 2 — Understand why

Log the handler reference:

```jsx
console.log('handleComplete reference:', handleComplete);
```

Add this inside the parent before the return. Every render logs a **different function object**. The memo shallow comparison sees a new `onComplete` each time → fails → all items rerender.

### Step 3 — Fix with useCallback

```jsx
const handleComplete = useCallback((task) => {
  console.log(`Completed: ${task}`);
  setCompletedCount(c => c + 1);
}, []); // empty deps — function logic doesn't depend on any props/state
```

Click **Done** again. Now only the parent rerenders. `TaskItem` components do not rerender.

### Step 4 — Test the dependency array

Add a `prefix` state to `TaskList` and update the handler to use it:

```jsx
function TaskList() {
  const [completedCount, setCompletedCount] = useState(0);
  const [prefix, setPrefix] = useState('Task');
  const tasks = ['Write tests', 'Review PR', 'Deploy', 'Update docs'];

  const handleComplete = useCallback((task) => {
    console.log(`${prefix} completed: ${task}`);
    setCompletedCount(c => c + 1);
  }, [prefix]); // prefix is a dependency — handler recreates when prefix changes

  return (
    <div>
      <p>Completed: {completedCount}</p>
      <button onClick={() => setPrefix(p => p === 'Task' ? 'Job' : 'Task')}>
        Toggle Prefix (current: {prefix})
      </button>
      {tasks.map(task => (
        <TaskItem key={task} task={task} onComplete={handleComplete} />
      ))}
    </div>
  );
}
```

Verify:
- Clicking **Toggle Prefix** creates a new handler (correct — logic changed, `prefix` is in deps)
- Clicking **Done** does NOT create a new handler (correct — `completedCount` is not in deps)

### Step 5 — Stale closure trap

Remove `prefix` from the dependency array deliberately:

```jsx
const handleComplete = useCallback((task) => {
  console.log(`${prefix} completed: ${task}`);
  setCompletedCount(c => c + 1);
}, []); // prefix is missing!
```

Change `prefix` via a button. Click Done. The console still shows the old prefix — a **stale closure**. The function captured `prefix` at the time it was created and never updated. This is the core danger.

---

## What To Observe

- Without `useCallback`: new function reference every render → memo fails → all children rerender
- With `useCallback([])`: same reference across all renders → memo works → children skip
- With correct deps `[prefix]`: function recreates only when `prefix` changes → targeted rerenders
- With wrong deps (stale): function uses outdated values — silent bug, not a crash

---

## Internal React Explanation

### Why does every render create a new function?

A React component is just a JavaScript function. Every time it runs (renders), every line of code inside it executes fresh:

```js
function TaskList() {
  // This line runs on EVERY render:
  const handleComplete = (task) => { /* ... */ };
  // A new function object is allocated in memory every time
}
```

In JavaScript, functions are objects. `() => {}` creates a new object in the heap. Two calls to the same code produce two different objects with two different memory addresses.

```js
const f1 = () => {};
const f2 = () => {};
f1 === f2; // false — different objects in memory
```

This is fundamental JavaScript, not a React quirk.

### How useCallback works

`useCallback(fn, deps)` stores the function in the **fiber's memoized state**. On the next render:

1. React compares `deps` with the previous deps using `Object.is`
2. If deps are unchanged → returns the **same function reference** from the previous render
3. If any dep changed → stores and returns the new function

Essentially, `useCallback(fn, deps)` is syntactic sugar for:

```js
useMemo(() => fn, deps)
```

They are identical in implementation. `useCallback` returns the function itself; `useMemo` would need to return `() => fn` to achieve the same thing — hence the separate API for clarity.

### Closure mechanics

When a function is created inside a component, it **closes over** all variables in scope at the time of creation:

```js
function TaskList() {
  const [prefix, setPrefix] = useState('Task');

  const handleComplete = useCallback((task) => {
    // 'prefix' is captured from the outer scope
    // at the time this function was created
    console.log(`${prefix} completed`);
  }, []); // but we don't re-create when prefix changes!
}
```

When `prefix` changes, the component rerenders. But because `useCallback`'s deps array is empty, it returns the **old function** — which still has the **old `prefix` value** baked into its closure. The function is frozen in time.

This is the **stale closure** problem. It doesn't throw an error. It silently uses outdated data.

### The correct fix: functional updates

When your callback only needs to update state (not read it for logic), use a functional update to avoid including state in deps:

```jsx
// BAD — needs count in deps, creates new function on every count change
const handleAdd = useCallback(() => {
  setCount(count + 1);
}, [count]);

// GOOD — functional update, no count dependency needed
const handleAdd = useCallback(() => {
  setCount(c => c + 1);
}, []);
```

The functional update receives the current state as an argument, bypassing the closure issue.

---

## Optimization Challenge

**Challenge 1:** Build a notification system where a parent manages a list of notifications and each `NotificationItem` has a "dismiss" button. Use `useCallback` to ensure dismissing one notification doesn't rerender all other items.

**Challenge 2:** Create a form component where the parent passes `onChange` handlers to multiple field components. Verify that typing in one field doesn't rerender the other fields.

**Challenge 3:** Intentionally create a stale closure bug in a counter that uses `setInterval`. See that the count doesn't increment correctly, then fix it with a functional update.

---

## Why This Optimization Works

`useCallback` + `React.memo` form a complementary pair:

- `React.memo` says: "skip rerender if props are shallowly equal"
- `useCallback` says: "keep the same function reference if dependencies haven't changed"

Together they allow a parent's state changes to stay local without cascading to children that don't need to rerender.

The performance gain is proportional to:
- How expensive the children are to render
- How many children there are
- How frequently the parent rerenders

For a list of 100 memoized items where only 1 item's data changes, `useCallback` prevents 99 unnecessary renders on every parent state update.

---

## Common Mistakes

**Mistake 1: Using useCallback for every function**

`useCallback` itself has a cost: allocating the deps array, running comparisons, storing the function in fiber state. For functions that are never passed to memoized children or used as `useEffect` deps, `useCallback` adds overhead with zero benefit.

**Mistake 2: Empty deps array with state dependencies**

`useCallback(() => doSomethingWith(value), [])` — if the function uses `value`, it should be in deps. Leaving it out causes stale closure bugs that are very hard to debug.

**Mistake 3: Using useCallback to "optimize" event handlers in the same component**

```jsx
// Pointless — this button is in the same component, not a memoized child
const handleClick = useCallback(() => setCount(c => c + 1), []);
return <button onClick={handleClick}>+</button>;
```

The button is in the same render scope. Stabilizing the reference helps nothing here.

**Mistake 4: Thinking useCallback prevents the function from running**

`useCallback` memoizes the **function reference**, not the **function result**. The function still runs when called. Only `useMemo` memoizes the result.

**Mistake 5: Overcomplicating deps to avoid adding them**

Some developers restructure code awkwardly to avoid adding deps, when the correct answer is just to add the dep and accept that the function recreates.

---

## Debugging Tools

### Verify reference stability

```jsx
const prevHandler = useRef();
useEffect(() => {
  if (prevHandler.current && prevHandler.current !== handleComplete) {
    console.log('handleComplete reference changed!');
  }
  prevHandler.current = handleComplete;
});
```

This logs any time the handler gets a new reference — useful for debugging unexpected memo failures.

### ESLint exhaustive-deps rule

The `eslint-plugin-react-hooks` rule `react-hooks/exhaustive-deps` automatically warns when you're missing deps in `useCallback` (or `useMemo`, `useEffect`). It catches stale closure bugs at lint time.

Install and enable it — it's one of the most valuable React-specific lint rules.

### React DevTools Profiler

After adding `useCallback`, record a profiling session and look for "why did this render?" If a child still shows "prop changed" for your callback prop, the `useCallback` isn't working as expected.

---

## Interview Questions

1. Why does every render in React create a new function instance?
2. What does `useCallback` do and how does it work?
3. What is the difference between `useCallback` and `useMemo`?
4. What is a stale closure and how does it happen in `useCallback`?
5. What should go in the `useCallback` dependency array?
6. If I use `useCallback` with an empty deps array but my function reads state, what happens?
7. When does `useCallback` actually provide a performance benefit?
8. Does `useCallback` prevent the function from executing? What does it actually prevent?
9. How do `useCallback` and `React.memo` work together?
10. Is there a case where you should NOT use `useCallback` even if you're passing a function to a memoized child?

---

## Interview Answers

**1. Why does every render create a new function?**
A React component is a JavaScript function. Every time it executes, every expression inside is evaluated fresh, including function definitions. `const fn = () => {}` creates a new function object on the heap with a new memory address on every invocation. This is standard JavaScript behavior, not React-specific.

**2. What does useCallback do?**
It memoizes a function reference. It stores the function in fiber state and returns the same reference across renders as long as its dependency array hasn't changed. When deps change, it creates and stores the new function.

**3. useCallback vs useMemo?**
`useMemo` memoizes the **return value** of a function: `useMemo(() => compute(), deps)` returns the computed value. `useCallback` memoizes the **function itself**: `useCallback(fn, deps)` returns `fn`. They're implemented identically — `useCallback(fn, deps)` is `useMemo(() => fn, deps)`.

**4. What is a stale closure?**
When a function closes over a variable (captures it from the outer scope), and later the variable's value changes but the function isn't recreated, the function still uses the old value. In `useCallback`, this happens when a variable used inside the function is missing from the deps array.

**5. What goes in the dependency array?**
Every value from the component scope that the function uses inside its body: props, state, context values, other functions. Exclude only stable values: `setState` updaters, `dispatch` from `useReducer`, and `ref.current`.

**6. Empty deps array with state dependency?**
Stale closure. The function uses the state value from the first render forever. When state updates and the component rerenders, the function still has the old value baked in. It will never read the updated state.

**7. When does useCallback provide a benefit?**
Only when the function is passed as a prop to a memoized child (`React.memo`) or used as a dependency in another hook (`useEffect`, `useCallback`, `useMemo`). In both cases, a stable reference prevents unnecessary work. For all other cases, `useCallback` is pure overhead.

**8. Does useCallback prevent function execution?**
No. The function still runs when called. `useCallback` only prevents a new function **reference** from being created. The optimization is about reference stability, not execution prevention.

**9. How do useCallback and React.memo work together?**
They're complementary. `React.memo` prevents a child from rerendering if its props are shallowly equal. But if a function prop is recreated every render (new reference), the shallow check fails and memo is bypassed. `useCallback` stabilizes the function reference so `React.memo`'s check can actually pass.

**10. Should you always use useCallback when passing to memo'd child?**
Not always. If the parent itself only rerenders when the function logic should change (i.e., its deps change), there's no benefit — the function would recreate anyway. Also, if the child is cheap to render, the overhead of `useCallback` comparison + `React.memo` comparison may exceed the cost of just rerendering.

---

## Senior-Level Thinking

**`useCallback` is not free — it's a bet.**

You're betting that the cost of: allocating a deps array + comparing deps + storing in fiber state is LESS than the cost of the rerender you're preventing. For cheap children that render in under 1ms, you often lose this bet.

**The real fix is often architectural.**

Ask why the parent rerenders so often. If the parent holds state that a specific child only cares about, maybe that state should live in the child, or in a separate context. `useCallback` is often a patch over a state-placement problem.

**Lint your way to correctness.**

With `react-hooks/exhaustive-deps` enabled, stale closure bugs are caught at write time. Never disable this rule to "make it work" — that's papering over a real bug.

**`useCallback` in custom hooks is often worth it.**

When you write a custom hook that returns a function (e.g., `useToggle`, `useApiCall`), wrapping the returned function in `useCallback` is almost always worth it — callers will pass it to children or use it in effects, and they shouldn't need to add it to deps just because of your hook's implementation.

---

## Revision Notes

- Every render creates new function objects — this is JavaScript, not React
- `useCallback` returns same function reference if deps unchanged
- `useCallback` = `useMemo(() => fn, deps)` — identical under the hood
- Only useful when passed to memo'd child or used as hook dependency
- Always include every closure variable in deps — use `exhaustive-deps` lint rule
- Stale closure = function uses old values because deps list was incomplete
- Functional state updates (`c => c + 1`) avoid needing state in deps
- Don't `useCallback` everything — it has a cost

---

## Next Day Preview

**Day 4 — useMemo & Object References**

The same reference identity problem, but for objects and arrays instead of functions. How `useMemo` stabilizes object references to prevent memo failures. When `useMemo` is worth the overhead. Computing expensive derived values vs just stabilizing references.
