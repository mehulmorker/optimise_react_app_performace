# Day 11 — Stale Closures

## Objective

Understand one of React's most subtle and frustrating bugs: the stale closure. A function captures variables from its surrounding scope at the time it's created. If those variables change later but the function is never recreated, it keeps using the old values — silently, without errors.

---

## Real World Importance

- A counter inside `setInterval` that always shows 0 or 1
- An event handler that references state from when the component first mounted
- A debounced callback that uses the initial value of a search query forever
- WebSocket message handlers that read stale user authentication state
- Animation frames that operate on old coordinates

---

## Concepts Covered

- What a JavaScript closure is
- How React component renders create new closures
- Why `setInterval`/`setTimeout` callbacks are prone to stale closures
- The three patterns to fix stale closures: functional updates, refs, effect cleanup+restart
- Stale closures in `useCallback` and `useMemo`
- Reading state inside async operations

---

## Exercise Task

### Step 1 — Build the classic stale closure bug

```jsx
function StaleCounter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      console.log('count inside interval:', count); // always 0!
      setCount(count + 1); // always sets to 0+1=1!
    }, 1000);

    return () => clearInterval(interval);
  }, []); // empty deps — interval callback captures count=0 forever

  return <div>Count: {count}</div>;
}
```

Run this. The count will increment to 1 and **stay at 1 forever**. Open the console — it logs `count: 0` on every tick.

### Step 2 — Understand why

```jsx
// At render 1: count = 0
// setInterval callback is created, capturing: { count: 0 }
// The callback is a frozen snapshot of render 1's variables

// At render 2: count = 1
// A NEW callback would capture { count: 1 }
// But our interval is still using the OLD callback from render 1!
// count inside interval = 0 (stale)
// setCount(0 + 1) = setCount(1) — always sets to 1
```

### Step 3 — Fix 1: Functional update (cleanest fix)

```jsx
useEffect(() => {
  const interval = setInterval(() => {
    setCount(c => c + 1); // c is the current state, not the closure value
  }, 1000);

  return () => clearInterval(interval);
}, []);
```

The functional update receives the **current state** as an argument at call time — not from the closure. No need to capture or read `count` in the interval callback.

### Step 4 — Fix 2: useRef to hold latest value

```jsx
function FixedWithRef() {
  const [count, setCount] = useState(0);
  const countRef = useRef(count);

  // Keep ref synchronized with state
  useEffect(() => {
    countRef.current = count;
  }, [count]);

  useEffect(() => {
    const interval = setInterval(() => {
      console.log('count from ref:', countRef.current); // always current!
      setCount(countRef.current + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return <div>Count: {count}</div>;
}
```

`countRef.current` is mutable and doesn't cause rerenders. The interval always reads the current value through the ref.

### Step 5 — Fix 3: Include dep and restart effect

```jsx
useEffect(() => {
  const interval = setInterval(() => {
    setCount(count + 1); // safe — closure has current count
  }, 1000);

  return () => clearInterval(interval); // cleanup old interval
}, [count]); // restart effect when count changes
```

Now the effect re-runs on every count change: clears the old interval, creates a new one with the fresh closure. Works but is less efficient — creates/destroys the interval on every tick.

### Step 6 — Stale closure in event handler

```jsx
function StaleHandler() {
  const [message, setMessage] = useState('Hello');

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Enter') {
        alert(message); // captures message at mount time!
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, []); // stale: message changes but handler doesn't update

  return (
    <div>
      <input
        value={message}
        onChange={e => setMessage(e.target.value)}
      />
      <p>Press Enter to alert: {message}</p>
    </div>
  );
}
```

Type a new message. Press Enter. The alert shows the original "Hello". Fix: add `message` to deps (or use a ref).

---

## What To Observe

- Interval counter stuck at 1: stale closure captures `count = 0`
- Console logs always show 0 inside the interval
- Functional update fix: counter increments correctly without reading closure value
- Ref fix: ref.current always has the latest value, interval reads correctly
- Event handler: alert shows value from mount time, not current input value

---

## Internal React Explanation

### What is a closure?

A closure is a function plus the scope variables it captures when created:

```js
function makeCounter(start) {
  let count = start;
  return function increment() {
    count++; // captures 'count' from makeCounter's scope
    return count;
  };
}
```

In React, every render creates a new scope with new variable values:

```jsx
function Component() {
  const [count, setCount] = useState(0); // at render N: count = N

  const logCount = () => {
    console.log(count); // captures count from this render's scope
  };

  // logCount created at render 1 has count=0 baked in
  // logCount created at render 2 has count=1 baked in
  // These are DIFFERENT functions with DIFFERENT captured values
}
```

### Why setInterval creates stale closures

`setInterval` holds a reference to the **function object** passed to it at the time of the call. React component rerenders create **new function objects** with updated closures. But the interval still holds the original function.

```
Render 1: count=0
  → setInterval(callback_v1, 1000)  // callback_v1 has count=0
  
Render 2: count=1 (after first tick)
  → Effect deps didn't change ([] empty)
  → No new interval created
  → callback_v1 still runs every second
  → callback_v1 still reads count=0
```

### The ref trick explained

`useRef` creates a mutable container (`{ current: value }`) that's the **same object** across all renders. Unlike state, mutating a ref doesn't trigger rerenders. When you do `countRef.current = count` in an effect, you update the shared container. The interval callback holds a reference to the container object (not a value copy), so it always reads the latest `countRef.current`.

```
countRef = { current: [mutable] }

Render 1: countRef.current = 0
Render 2: countRef.current = 1  ← mutated in place
Render 3: countRef.current = 2  ← mutated in place

Interval callback holds reference to countRef object
  → countRef.current is always the latest value
```

### async operations and stale closures

```jsx
const handleSearch = async () => {
  const results = await searchAPI(query);
  // By the time this line runs, 'results' is fresh
  // but 'query' might be stale if user typed while waiting!
  if (query === currentQuery) { // comparing to stale query!
    setResults(results);
  }
};
```

Async operations are particularly dangerous because the state captured at function creation time may have changed by the time the await resolves. Use a ref or check with a cleanup mechanism (AbortController pattern from Day 13).

---

## Optimization Challenge

**Challenge 1:** Build a stopwatch that uses `setInterval` for millisecond precision. Ensure the elapsed time is always correct, not stuck.

**Challenge 2:** Build a live typing indicator (like "User is typing...") that uses `setTimeout` to hide the indicator after 2 seconds of inactivity. Ensure the timeout always operates on the current typing state.

**Challenge 3:** Find the stale closure in this code and fix it:

```jsx
function DataPoller({ url, interval = 5000 }) {
  const [data, setData] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const result = await fetch(url).then(r => r.json());
        setData(result);
      } catch (e) {
        setRetryCount(retryCount + 1); // bug here!
      }
    }, interval);

    return () => clearInterval(timer);
  }, [url, interval]);

  return <div>Retries: {retryCount}</div>;
}
```

---

## Why This Optimization Works

Fixing stale closures isn't just about correctness — it's about preventing subtle performance bugs:

- Functional updates avoid creating a new effect/callback on every state change
- Refs provide a stable access path to latest state without effect restarts
- Correct closures mean effects don't need to restart more often than necessary

In the interval example, using functional updates means the effect runs exactly once (on mount) and cleans up once (on unmount). Without the fix, every approach either breaks or creates/destroys the interval on every render.

---

## Common Mistakes

**Mistake 1: Reading state directly in setInterval/setTimeout**

Always prefer functional updates for state that increments based on itself. Reading from closure in timers is almost always wrong.

**Mistake 2: Using `count` in setInterval deps to "stay fresh"**

Adding `count` to deps means the interval restarts every tick. This is technically correct but wastes resources. Use functional update instead.

**Mistake 3: Not cleaning up timers**

A stale timer that doesn't clean up continues referencing the old component's state even after unmount. Combine with cleanup (Day 13) to prevent memory leaks.

**Mistake 4: Forgetting async operations capture stale state**

An async function captures state at the time it's called. By the time it resolves, state may have changed. Use refs or cancellation tokens to handle this correctly.

**Mistake 5: Thinking refs are the universal solution**

Refs solve the reading problem but not the dependency tracking problem. Using a ref to avoid adding a dep to `useEffect` often hides a real dependency that should be in the array. Only use ref when functional update isn't applicable.

---

## Debugging Tools

### Log closure values

```jsx
const interval = setInterval(() => {
  console.log('Interval tick — count from closure:', count);
  // If this always shows the same value, it's a stale closure
}, 1000);
```

### Add a staleness detector

```jsx
const staleCheckRef = useRef(null);
staleCheckRef.current = count;

const interval = setInterval(() => {
  const latestFromRef = staleCheckRef.current;
  const fromClosure = count;
  if (latestFromRef !== fromClosure) {
    console.warn(`Stale closure! closure=${fromClosure}, actual=${latestFromRef}`);
  }
}, 1000);
```

---

## Interview Questions

1. What is a closure in JavaScript?
2. Why does `setInterval` commonly cause stale closures in React?
3. What is the "functional update" fix for stale closures?
4. How does using a `useRef` solve the stale closure problem?
5. Why is `useRef` not always the right solution?
6. What happens with stale closures in async functions?
7. How does adding a dep to `useEffect` fix the stale closure?
8. Why can't you just add `count` to the interval effect's deps?
9. What lint rule helps detect stale closure bugs?
10. What is the difference between data being stale vs data being stale AND causing wrong behavior?

---

## Interview Answers

**1. What is a closure?**
A closure is a function bundled with the lexical environment (scope) in which it was defined. The function "closes over" the variables in scope at creation time — it has access to those variables even when called outside that scope or after the outer function returns.

**2. Why setInterval causes stale closures?**
`setInterval` holds a reference to the function object passed at call time. React renders create new function objects with updated variable values (new closures). The interval continues calling the original function, which has the original variable values "frozen" in its closure.

**3. Functional update fix?**
Instead of reading state from the closure (`setCount(count + 1)`), use `setCount(c => c + 1)`. The `c` parameter receives the current state at call time, bypassing the closure entirely. No need to capture or depend on `count`.

**4. useRef solution?**
A ref is a stable container object (`{ current: value }`) that's the same reference across all renders. Keep `ref.current` synchronized with state via a `useEffect([state])`. The interval callback reads from `ref.current` (always current) instead of from its closure (potentially stale).

**5. Why not always use ref?**
Refs hide dependencies — the `exhaustive-deps` lint rule can't see that the effect depends on the state being synchronized. It can create subtle bugs where the ref isn't updated before the callback reads it. Functional updates are cleaner for state-incrementing patterns.

**6. Async functions and stale closures?**
An async function captures state at the time it's called. When it `await`s and resumes, the captured state values haven't updated. If the user changed state while waiting, the function operates on old data. Use refs or cancellation patterns to handle this.

**7. Adding dep to effect fixes stale closure?**
Yes — adding the state variable to deps causes the effect to re-run when it changes, creating a new callback with the fresh closure. The old timer is cleaned up; a new one starts with correct values.

**8. Why not just add count to interval deps?**
The interval restarts every time count changes. For a 1-second interval, this means: tick (count changes) → interval cleared → new interval started with 1-second delay → next tick is now 2 seconds after the previous. The timing becomes irregular.

**9. Lint rule for stale closures?**
`react-hooks/exhaustive-deps` from `eslint-plugin-react-hooks`. It warns when variables used inside hooks are missing from dependency arrays — catching potential stale closures at lint time.

**10. Stale data vs wrong behavior?**
Stale data means a function uses an old value. Whether this causes wrong behavior depends on whether the old value matters. `setCount(c => c + 1)` doesn't care about stale `count` because it receives current state. An alert showing the initial message is both stale AND wrong — the stale value produces incorrect output.

---

## Senior-Level Thinking

**React's mental model: renders are snapshots.**

Each render is a complete snapshot of the UI at that moment. Functions created during a render capture that snapshot. This is a feature — it makes React's rendering predictable and testable. Stale closures arise when you use long-lived callbacks (intervals, event listeners) that need to outlive their snapshot.

**The useEffectEvent future.**

React's team proposed `useEffectEvent` (React 19 experimental) to address this class of problem: event callbacks that should always be "current" but shouldn't be reactive deps. The pattern `const onMessage = useEffectEvent((msg) => { /* uses current state */ })` would give you a stable reference that always runs with the latest closure, without being a dep.

**Design consideration: long-lived callbacks.**

When you see `setInterval`, `addEventListener`, or `setTimeout` with non-trivial logic, ask: "What state does this access? Will that state change while this callback lives?" If yes, choose your fix deliberately: functional update (for incrementing patterns), ref (for reading arbitrary state), or effect restart (for logic that genuinely should re-run).

---

## Revision Notes

- Closure = function + its captured variables at creation time
- Each render = new scope = new closures with current values
- setInterval holds the original function — not the latest render's function
- Fix 1: Functional update (`c => c + 1`) — bypasses closure, reads current state
- Fix 2: useRef — stable container, always holds latest value
- Fix 3: Add dep to effect — restarts effect with fresh closure (has timing cost)
- Async operations: state captured at call time, stale by resolution time
- exhaustive-deps ESLint rule catches missing deps (potential stale closures)

---

## Next Day Preview

**Day 12 — useRef vs useState**

When to use a ref instead of state. The critical rule: refs don't trigger rerenders. Practical use cases: storing previous values, DOM access, interval/timeout IDs, tracking without causing rerenders.
