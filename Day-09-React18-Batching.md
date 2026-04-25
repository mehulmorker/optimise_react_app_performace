# Day 9 — React 18 Automatic Batching

## Objective

Understand how React 18 extends batching beyond event handlers to cover `setTimeout`, `Promise` callbacks, and native event listeners — and how to opt out with `flushSync` when you need immediate DOM updates.

---

## Real World Importance

- Data fetching: updating `data`, `loading`, and `error` inside a `.then()` now batches correctly
- setTimeout animations: multiple state updates in a timer are now batched
- WebSocket handlers: incoming message updates batch correctly
- Event listeners added via `addEventListener`: now batch like React event handlers
- Any legacy code that relied on async updates being unbatched may behave differently in React 18

---

## Concepts Covered

- React 17 batching limitations (event handlers only)
- React 18 automatic batching everywhere
- `flushSync` to force immediate rendering when needed
- `createRoot` as the prerequisite for automatic batching
- How to detect if batching is occurring
- Migration considerations for React 17 → 18

---

## Exercise Task

### Step 1 — Demonstrate React 17 behavior (simulate with legacy mode)

In React 18, you can use `ReactDOM.render` (legacy mode) to simulate React 17 batching behavior:

```jsx
// index.js — legacy mode (React 17 behavior)
import ReactDOM from 'react-dom';
ReactDOM.render(<App />, document.getElementById('root'));
```

Build this component:

```jsx
function BatchingTest() {
  const [count, setCount] = useState(0);
  const [flag, setFlag] = useState(false);

  const renderCount = useRef(0);
  renderCount.current++;
  console.log(`Render #${renderCount.current}: count=${count}, flag=${flag}`);

  // In React 17 (legacy mode): setTimeout updates are NOT batched
  const asyncUpdate = () => {
    setTimeout(() => {
      setCount(c => c + 1); // render 1
      setFlag(f => !f);     // render 2 (separate render in React 17!)
    }, 0);
  };

  // In React 17: event handler updates ARE batched
  const syncUpdate = () => {
    setCount(c => c + 1); // batched
    setFlag(f => !f);     // batched
    // One render total
  };

  return (
    <div>
      <button onClick={syncUpdate}>Sync (1 render)</button>
      <button onClick={asyncUpdate}>Async (2 renders in React 17)</button>
      <p>Count: {count}, Flag: {flag.toString()}</p>
    </div>
  );
}
```

With legacy mode, the async button causes 2 renders. The sync button causes 1.

### Step 2 — Switch to React 18 concurrent mode

```jsx
// index.js — React 18 mode
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<App />);
```

Now run the same test. **Both buttons cause 1 render.** Automatic batching works everywhere.

### Step 3 — Test Promise callbacks

```jsx
const fetchAndUpdate = async () => {
  const data = await fakeApiCall(); // simulated delay
  setCount(data.count);     // these are now batched in React 18
  setFlag(data.active);     // one render, not two
  setLoading(false);
};
```

Log render count before and after the await. Verify only one render happens after the await resolves.

### Step 4 — Test native event listeners

```jsx
useEffect(() => {
  const handleScroll = () => {
    setScrollY(window.scrollY);  // batched in React 18
    setIsScrolled(window.scrollY > 100); // batched in React 18
  };

  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
}, []);
```

In React 17, these would cause two renders per scroll event. In React 18, they're batched.

### Step 5 — Opt out with flushSync

Sometimes you need state to be applied immediately before the next line of code — for example, reading DOM measurements that depend on the updated state:

```jsx
import { flushSync } from 'react-dom';

const handleClick = () => {
  flushSync(() => {
    setCount(c => c + 1); // renders immediately
  });
  // DOM is now updated — safe to measure
  console.log(containerRef.current.scrollHeight);

  flushSync(() => {
    setFlag(f => !f); // another immediate render
  });
};
```

`flushSync` forces React to flush all pending state updates synchronously before returning. Each `flushSync` call causes a separate render.

**Verify:** This handler now causes 2 renders instead of 1. Use only when you need the DOM to reflect state before continuing.

---

## What To Observe

- Legacy mode (React 17): `setTimeout` with 2 setState → 2 renders
- React 18 mode: same code → 1 render
- Promise `.then()`: React 18 batches, React 17 doesn't
- `addEventListener` callbacks: React 18 batches, React 17 doesn't
- `flushSync`: forces immediate render, breaks out of batching
- Each `flushSync` call = one synchronous render

---

## Internal React Explanation

### How React 18 batching works

React 17 used a simple flag: if you're inside a React event handler (synthetic event dispatch), batch updates. After the handler, flush and render.

The problem: once you're outside React's event system (inside a Promise callback, setTimeout, native listener), the flag is reset. React can't tell "are we still handling a logical user action?"

React 18 solves this with a different mechanism. It tracks batching at the **scheduler level**, not the event handler level. When React processes work, any state updates that happen synchronously during that work item are automatically batched — regardless of where they come from.

Concretely: when the microtask queue runs (after `await`), React's scheduler receives all pending state updates before scheduling the next render. They're all batched together.

### The `createRoot` requirement

Automatic batching **only applies when using `createRoot`**. The legacy `ReactDOM.render` API preserves React 17 behavior for backwards compatibility. This is intentional — batching behavior changes could break apps that relied on sequential renders.

Migration path: switch to `createRoot` when ready. Test with render count logs.

### How flushSync works

`flushSync` temporarily disables batching and forces React to process all queued updates synchronously before returning:

```
flushSync(() => {
  setCount(1);  → added to queue
  setFlag(true) → added to queue
})
// Before flushSync returns:
// React flushes queue → renders → commits DOM
// DOM is now updated
// flushSync returns
```

It's the escape hatch for scenarios like:
- Measuring the DOM immediately after a state change
- Integrating with third-party libraries that need synchronous DOM updates
- Animation libraries that need frame-exact rendering

**Don't use flushSync for general state updates.** It defeats batching and makes React less efficient.

### Automatic batching and concurrent features

React 18's automatic batching is a prerequisite for concurrent features (useTransition, useDeferredValue). Concurrent rendering needs to know that batched state represents a single "user intent" before it decides whether to interrupt rendering.

---

## Optimization Challenge

**Challenge 1:** Build a data fetching component that updates `data`, `loading`, and `error` state in a Promise callback. Verify with render logs that React 18 batches them into one render.

**Challenge 2:** Build a counter that uses both `setTimeout` and event handler updates. Log renders and verify they're both batched in React 18.

**Challenge 3:** Find a case where `flushSync` is genuinely needed:
- Build a scroll-to-bottom chat component
- When a new message is added, update `messages` state
- Immediately after, scroll to the bottom (needs the DOM to be updated first)
- Use `flushSync` to ensure the DOM updates before the scroll

```jsx
const sendMessage = (text) => {
  flushSync(() => {
    setMessages(prev => [...prev, { id: Date.now(), text }]);
  });
  // DOM now shows new message — scroll works correctly
  bottomRef.current.scrollIntoView({ behavior: 'smooth' });
};
```

---

## Why This Works

Automatic batching reduces the total number of renders without any code changes. Each render involves:
- Component function calls (all components in the updated subtree)
- Virtual DOM diffing
- DOM mutations
- Effect scheduling

Fewer renders = less of all of the above. For apps with multiple state updates in async callbacks (common with data fetching), this can halve the number of renders.

---

## Common Mistakes

**Mistake 1: Not switching to `createRoot`**

If your app uses `ReactDOM.render`, you don't get automatic batching even after upgrading to React 18. The upgrade is incomplete without `createRoot`.

**Mistake 2: Using `flushSync` for every update**

`flushSync` turns off batching for those updates. Using it everywhere defeats React 18's optimization. Use it only for the specific pattern: "I need to read the DOM immediately after a state update."

**Mistake 3: Expecting `flushSync` to work inside transitions**

`flushSync` cannot be called inside `startTransition` or `useTransition`. These are async by design and don't support synchronous flushing.

**Mistake 4: Assuming existing code breaks with React 18 batching**

Most code is unaffected or improves. Issues only arise if code relied on React 17's behavior of two separate renders (e.g., code that reads DOM in a way that assumed an intermediate state was committed). Audit with render count logs.

**Mistake 5: Missing the unstable_batchedUpdates workaround**

Legacy code using `unstable_batchedUpdates` to manually batch async updates in React 17 doesn't need it in React 18. It still works but is now redundant.

---

## Debugging Tools

### Render tracking

```jsx
const renderLog = useRef([]);
renderLog.current.push({ count, flag, time: Date.now() });
console.log('Renders:', renderLog.current.length);
```

### Comparing React 17 vs 18 side by side

Run two versions of the same component — one with `ReactDOM.render` (legacy), one with `createRoot`. Click the same buttons and compare render counts.

### React DevTools Profiler

Record an interaction that triggers multiple async state updates. In React 18, you should see them collapsed into one "commit" in the profiler. In legacy mode, you see separate commits.

---

## Interview Questions

1. What is automatic batching in React 18?
2. What was the batching behavior in React 17?
3. What is required to enable automatic batching in React 18?
4. What is `flushSync` and when should you use it?
5. Does React 18 automatic batching require code changes to existing apps?
6. What happens inside `flushSync` if there are multiple `setState` calls?
7. Can you use `flushSync` inside `startTransition`?
8. What is a practical example where `flushSync` is necessary?
9. How does automatic batching relate to React 18's concurrent features?
10. What problems does automatic batching solve compared to React 17?

---

## Interview Answers

**1. Automatic batching in React 18?**
React 18 batches all state updates — regardless of where they're called from (event handlers, setTimeout, Promise callbacks, native events) — into a single render pass when using `createRoot`. Previously, only updates inside React's synthetic event handlers were batched.

**2. React 17 batching?**
Updates inside React synthetic event handlers were batched. Updates inside setTimeout, Promise callbacks, native addEventListener, and async functions were not batched — each `setState` triggered a separate render.

**3. Prerequisite for automatic batching?**
Using `createRoot` from `react-dom/client` instead of the legacy `ReactDOM.render`. Apps using legacy render mode retain React 17 batching behavior.

**4. flushSync?**
An escape hatch that forces React to process all queued state updates synchronously before returning. Use when you need the DOM to reflect updated state before executing the next line of code — for example, measuring DOM dimensions or scrolling after a state update.

**5. Code changes needed?**
Minimal. Most apps just need to switch `ReactDOM.render` to `createRoot`. Existing code that correctly used event handlers already benefited from batching. Async code gains batching automatically. Rarely, apps that relied on sequential renders may need `flushSync` for specific cases.

**6. Multiple setState inside flushSync?**
They're batched together within that single `flushSync` call and committed in one synchronous render before `flushSync` returns. Multiple `flushSync` calls each cause their own separate render.

**7. flushSync inside startTransition?**
Not allowed. `startTransition` marks updates as interruptible by design. `flushSync` would require synchronous commitment, which contradicts concurrent semantics. React will throw an error.

**8. Practical flushSync example?**
Scroll-to-bottom in a chat app: add a message to state, then immediately scroll to the new message's DOM node. Without `flushSync`, the scroll runs before the DOM is updated — the new message isn't in the DOM yet. With `flushSync`, the message renders before the scroll executes.

**9. Automatic batching + concurrent features?**
Automatic batching is foundational for concurrent mode. Concurrent rendering (useTransition, useDeferredValue) needs to know when a batch of state updates represents one coherent user intent before deciding whether to interrupt or prioritize it. Without batching, concurrent scheduling would be less predictable.

**10. Problems automatic batching solves?**
Eliminates the inconsistent state problem: in React 17, async updates committed one at a time, creating intermediate states that could flicker or show stale data. Performance: fewer renders per async operation. Code simplicity: developers don't need to manually batch with `unstable_batchedUpdates`.

---

## Senior-Level Thinking

**Automatic batching is the right default; React 17's behavior was an accident.**

React 17's limitation to event-handler batching was a legacy constraint from the original synthetic event system. React 18 finally aligns behavior with developer expectations: if you call multiple state setters together, they should batch.

**The `createRoot` migration is not optional for performance.**

If you're still on `ReactDOM.render`, you're missing React 18's performance improvements. Plan the migration. It's usually straightforward — mostly switching the root render call and testing for unexpected render-count changes.

**flushSync is a compatibility tool, not a pattern.**

It exists primarily to help integrate React with non-React code that needs synchronous DOM updates. If you find yourself using `flushSync` frequently, it's usually a sign of an architectural issue — either the code should be restructured to not need synchronous DOM access, or state should live somewhere more appropriate.

---

## Revision Notes

- React 17: batch only in event handlers. Async = no batch
- React 18: batch everywhere, requires `createRoot`
- `flushSync`: forces synchronous render before returning — use sparingly
- Multiple setStates in flushSync → batched into one render
- `flushSync` cannot be used inside `startTransition`
- Legacy `ReactDOM.render` preserves React 17 behavior even in React 18

---

## Next Day Preview

**Day 10 — Infinite useEffect Loops**

The most common React beginner mistake that silently destroys performance: creating effects that trigger their own dependencies. Every pattern that causes infinite loops and the correct mental model for thinking about effect dependencies.
