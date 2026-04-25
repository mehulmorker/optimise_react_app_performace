# Day 12 — useRef vs useState

## Objective

Know exactly when to reach for `useRef` instead of `useState`. These are two very different tools that serve different purposes. Using state where a ref should be used causes unnecessary rerenders; using a ref where state should be used causes the UI to not update. The distinction is crisp once you understand the rule.

---

## Real World Importance

- Tracking render count without causing additional renders
- Storing a `setInterval` ID to clear it later without a rerender
- Accessing and manipulating DOM elements (focus, scroll, measure)
- Holding a previous prop/state value for comparison
- Storing an AbortController, WebSocket instance, or animation frame ID
- Preventing double-submit by tracking if a request is in-flight

---

## Concepts Covered

- The fundamental difference: ref mutation doesn't trigger rerender
- DOM refs: accessing and imperative manipulation
- Value refs: mutable storage that persists across renders
- Tracking previous values with useRef
- Common ref use cases: timers, IDs, instances
- When "should this cause a rerender?" is the question to ask

---

## Exercise Task

### Step 1 — The core difference

```jsx
function RefVsState() {
  const [stateCount, setStateCount] = useState(0);
  const refCount = useRef(0);

  const incrementState = () => setStateCount(s => s + 1);
  const incrementRef = () => {
    refCount.current++;
    console.log('ref value:', refCount.current);
  };

  console.log('Component rendered');

  return (
    <div>
      <p>State: {stateCount}</p>
      <p>Ref: {refCount.current}</p> {/* won't update visually! */}
      <button onClick={incrementState}>Increment State</button>
      <button onClick={incrementRef}>Increment Ref (silent)</button>
    </div>
  );
}
```

Click **Increment Ref** several times. Watch: the console logs the updated value, but the page doesn't update. The `{refCount.current}` in JSX only shows the value from the last render — and there's no rerender triggered.

Click **Increment State** once. Now both values are shown — including all the ref increments that happened silently.

### Step 2 — Track render count with ref

```jsx
function RenderTracker() {
  const [data, setData] = useState(null);
  const renderCount = useRef(0);
  renderCount.current++; // mutate directly — no rerender triggered

  return (
    <div>
      <p>Render #{renderCount.current}</p>
      <button onClick={() => setData(Math.random())}>Update Data</button>
    </div>
  );
}
```

If you used `useState(0)` and `setRenderCount(n => n + 1)`, each increment would cause another render — infinite loop or at least double renders. Ref avoids this.

### Step 3 — DOM ref: focus management

```jsx
function FocusInput() {
  const inputRef = useRef(null);

  const focusInput = () => {
    inputRef.current.focus(); // imperative DOM access
  };

  return (
    <div>
      <input ref={inputRef} placeholder="I'll be focused..." />
      <button onClick={focusInput}>Focus the input</button>
    </div>
  );
}
```

`ref={inputRef}` tells React to store the DOM node in `inputRef.current` after mount. `inputRef.current` is the actual `<input>` DOM element — you can call any native DOM method on it.

### Step 4 — Storing timer IDs

```jsx
function Stopwatch() {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef(null); // store interval ID — doesn't need to trigger rerenders

  const start = () => {
    if (intervalRef.current) return; // prevent double-start
    intervalRef.current = setInterval(() => {
      setElapsed(e => e + 10);
    }, 10);
  };

  const stop = () => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  const reset = () => {
    stop();
    setElapsed(0);
  };

  return (
    <div>
      <p>{(elapsed / 1000).toFixed(2)}s</p>
      <button onClick={start}>Start</button>
      <button onClick={stop}>Stop</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}
```

The interval ID is stored in a ref because changing it shouldn't cause a rerender. If you stored it in state, every `start()` and `stop()` call would trigger an unnecessary rerender.

### Step 5 — Track previous value

```jsx
function PreviousValue({ value }) {
  const prevValueRef = useRef(null);

  // After render, save current value as the new "previous"
  useEffect(() => {
    prevValueRef.current = value;
  }, [value]);

  return (
    <div>
      <p>Current: {value}</p>
      <p>Previous: {prevValueRef.current ?? 'none'}</p>
    </div>
  );
}
```

During the render, `prevValueRef.current` still holds the previous value (before the useEffect update). After render, the effect updates it. This creates a one-render lag — `prevValueRef.current` is always one render behind, which is exactly what "previous value" means.

### Step 6 — Preventing double-submit

```jsx
function SubmitButton({ onSubmit }) {
  const isSubmittingRef = useRef(false);

  const handleClick = async () => {
    if (isSubmittingRef.current) return; // prevent double-submit
    isSubmittingRef.current = true;

    try {
      await onSubmit();
    } finally {
      isSubmittingRef.current = false;
    }
  };

  return <button onClick={handleClick}>Submit</button>;
}
```

Why not state? Using state would cause a rerender when submission starts/ends. If you want a visual loading state, use state for that separately. The "in-flight guard" is internal logic that doesn't need to affect the UI.

---

## What To Observe

- Ref mutation: no rerender, value updates silently
- State update: always causes rerender
- DOM ref: direct access to the native DOM node after mount
- Timer ID in ref: start/stop don't cause extra rerenders
- Previous value pattern: one render behind — the ref update happens after render

---

## Internal React Explanation

### What useRef actually is

`useRef(initialValue)` returns a plain JavaScript object: `{ current: initialValue }`. That's it. The object is created once and stored in the fiber. On every render, React returns the **same object** — the same reference.

When you mutate `ref.current`, you're modifying a property on a plain object. React doesn't know and doesn't care. No fiber update, no reconciliation, no rerender.

Compare to `useState`: calling `setState` enqueues a fiber update, schedules a rerender, and React processes it in the next render pass. It's a heavy operation by comparison.

### How React assigns DOM refs

When you write `<input ref={myRef} />`, React handles the `ref` prop specially:

1. After committing the DOM mutation (adding/updating the input element), React sets `myRef.current = inputDomNode`
2. When the component unmounts, React sets `myRef.current = null`

This happens in the commit phase, not the render phase. That's why you should never read `ref.current` during render — the DOM node may not exist yet.

### The rule: should this cause a rerender?

Ask this question every time you think about whether to use ref or state:

> "If this value changes, does the UI need to update to reflect the change?"

Yes → `useState` (the change is meaningful to the display)  
No → `useRef` (the change is internal implementation detail)

Examples:
- Form input value: YES → state (value shown in input)
- Is request in-flight: NO → ref (UI shows loading spinner separately)
- DOM node to focus: NO → ref (no visual representation needed)
- Count of user interactions: depends — if displayed, state; if just tracking, ref
- Previous value for comparison: NO → ref (used for logic, not display)

---

## Optimization Challenge

**Challenge 1:** Build a custom `usePrevious(value)` hook that returns the value from the previous render.

**Challenge 2:** Build an `useIsFirstRender()` hook that returns `true` only on the first render.

```jsx
function useIsFirstRender() {
  const isFirstRef = useRef(true);
  if (isFirstRef.current) {
    isFirstRef.current = false;
    return true;
  }
  return false;
}
```

**Challenge 3:** Build a component that auto-focuses an input when a modal opens. Use a ref to access the DOM element and call `.focus()` in a `useEffect`.

**Challenge 4:** Build a scroll position tracker that stores the scroll Y position in a ref (no rerender on scroll) but updates a state variable only when the scroll crosses a threshold (for showing a "back to top" button).

---

## Why This Optimization Works

Using refs instead of state for non-display values eliminates unnecessary rerenders:

- Storing an interval ID in state: `start()` and `stop()` each trigger rerenders for no visual reason
- Storing render count in state: each increment causes another render (catastrophic)
- Storing a loading guard in state: submission start and end both trigger rerenders

Each prevented rerender means fewer component function calls, less reconciliation work, and less DOM comparison. For components that track many internal IDs and flags, this adds up.

---

## Common Mistakes

**Mistake 1: Reading ref.current during render**

`ref.current` is set after the commit phase. During render (before commit), it may be null/stale. Safe places to read refs: event handlers, `useEffect`, `useLayoutEffect`.

**Mistake 2: Expecting a ref change to show in JSX**

```jsx
const countRef = useRef(0);
return <div>{countRef.current}</div>; // WON'T update when ref changes!
```

The JSX snapshot is taken during render. If `ref.current` changed after render without triggering a rerender, the JSX still shows the old value.

**Mistake 3: Using ref to avoid state when state is needed**

Some developers use refs to "optimize away" rerenders for values that genuinely need to update the UI. Result: the UI shows stale data. The fix: use state (and optimize the rerender if needed), not refs.

**Mistake 4: Callback refs vs ref objects**

`ref` prop accepts both a ref object (`useRef()`) and a callback function:

```jsx
<div ref={node => { if (node) doSomethingWith(node); }} />
```

Callback refs are called with the DOM node on mount and `null` on unmount. Useful when you need to run logic when the ref is assigned.

**Mistake 5: Storing ref in state (object identity confusion)**

```jsx
// Pointless and confusing
const [domRef, setDomRef] = useState(useRef(null));
```

Refs don't need to be in state. They're stable by design.

---

## Debugging Tools

### Log ref vs state updates

```jsx
useEffect(() => {
  console.log('State caused rerender:', stateValue);
});

const handleMutation = () => {
  refValue.current = 'new';
  console.log('Ref mutated (no rerender):', refValue.current);
};
```

### React DevTools

Refs are not shown in React DevTools' component props panel. State is shown. This is a reminder: refs are private implementation details, state is the component's "interface."

---

## Interview Questions

1. What is `useRef` and how does it differ from `useState`?
2. Why doesn't mutating a ref trigger a rerender?
3. How do DOM refs work in React?
4. What are the safe places to read `ref.current`?
5. Why would you store a timer ID in a ref instead of state?
6. How do you implement a "previous value" tracker with `useRef`?
7. Can you use a ref to avoid a stale closure?
8. What is the object returned by `useRef`?
9. When would you choose `useState` over `useRef`?
10. What is a callback ref and when would you use it?

---

## Interview Answers

**1. useRef vs useState?**
Both persist values across renders. `useState` triggers a rerender when updated via the setter. `useRef` doesn't trigger rerenders when `ref.current` is mutated. Use state for values that affect the UI; use ref for values that don't.

**2. Why no rerender on ref mutation?**
`ref.current` is a plain property assignment on a plain JavaScript object. React never intercepts or observes this mutation. It's not routed through any React scheduler or update queue. React has no knowledge that the value changed.

**3. How do DOM refs work?**
Assign a ref object to the `ref` prop of a JSX element. After React commits the DOM node to the document, it sets `ref.current = domNode`. When the element unmounts, React sets `ref.current = null`. This happens in the commit phase, after all renders and effects.

**4. Safe places to read ref.current?**
Event handlers (executed after render and commit), `useEffect` and `useLayoutEffect` callbacks (run after commit), and callbacks like `setInterval`/`setTimeout`. Never during render — the DOM node may not exist yet, and ref values from async operations may be stale.

**5. Timer ID in ref vs state?**
`clearInterval` doesn't need to show anything in the UI. Storing the ID in state would cause a rerender every time `start()` and `stop()` are called. The interval ID is an implementation detail, not display data. Ref is the correct choice.

**6. Previous value tracker?**
Store the value in a ref. After each render, use a `useEffect([value])` to update `ref.current` to the latest value. During the current render, `ref.current` still holds the previous value (the effect hasn't run yet). Expose `ref.current` from the hook.

**7. Ref to avoid stale closure?**
Yes — keep `ref.current` synchronized with state via a `useEffect([state])`. Read from `ref.current` inside callbacks instead of from the closure variable. The ref always has the latest value because it's a shared mutable object.

**8. Object returned by useRef?**
`{ current: initialValue }` — a plain JavaScript object. React creates it once and returns the same object reference on every render. The object is stored in the fiber's memoized state.

**9. When to choose state?**
When the changed value should cause the UI to update. The test: "If this value changes, do I need React to re-render to reflect it?" If yes → state.

**10. Callback ref?**
A function passed as the `ref` prop instead of a ref object: `ref={node => { myList.push(node); }}`. React calls this function with the DOM node on mount and `null` on unmount. Use when you need multiple refs (for a list), or when you need to run initialization logic when the ref is set.

---

## Senior-Level Thinking

**Refs are the imperative escape hatch from React's declarative model.**

React's core idea is: describe what the UI should look like as a function of state. Refs break this model by providing direct mutable access to DOM nodes and persistent mutable values. This is intentional — some things (focus, scroll, animation, measurements) genuinely need imperative code. Use refs for those things and keep declarative state for everything that drives the UI.

**The forwardRef pattern for component libraries.**

When building reusable components (like a `<CustomInput />`), you may need to expose the underlying DOM node to the parent. Use `React.forwardRef`:

```jsx
const CustomInput = React.forwardRef((props, ref) => (
  <input ref={ref} {...props} />
));
```

The parent can then do `customInputRef.current.focus()`. This is the correct way to expose DOM access from abstracted components.

**useImperativeHandle for controlled exposure.**

Instead of exposing the entire DOM node, expose only specific imperative methods:

```jsx
useImperativeHandle(ref, () => ({
  focus: () => inputRef.current.focus(),
  scrollIntoView: () => inputRef.current.scrollIntoView(),
}));
```

The parent gets a controlled API, not direct DOM access.

---

## Revision Notes

- `useRef` returns `{ current: initialValue }` — same object every render
- Mutating `ref.current` = no rerender (React doesn't know about it)
- `useState` setter = schedules rerender
- Rule: "Does this value changing need to show in UI?" → yes = state, no = ref
- DOM refs: assigned after commit phase — don't read during render
- Timer IDs, request in-flight guards, render counters → refs
- Previous value pattern: ref updated in useEffect (runs after render)

---

## Next Day Preview

**Day 13 — Cleanup & Memory Leaks**

What happens when effects don't clean up after themselves. Event listeners that pile up. Timers that keep running after unmount. Async operations that update unmounted components. How to write bulletproof cleanup functions.
