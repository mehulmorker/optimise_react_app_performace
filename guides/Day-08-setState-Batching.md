# Day 8 — setState Batching

## Objective

Understand how React batches multiple `setState` calls to minimize renders, why calling `setState` twice in a row doesn't always update state twice, and the critical difference between direct value updates and functional updates.

---

## Real World Importance

- Shopping cart: adding an item should update both `cartItems` and `cartCount` without causing two renders
- Form submission: resetting multiple fields at once shouldn't cause one render per field
- Game state: updating score, lives, and level in one user action without intermediate states
- Animation: multiple state changes triggered synchronously shouldn't cause visual flickering
- Server response handlers: updating data, loading, and error states from one fetch result

---

## Concepts Covered

- What batching means and why React does it
- How React batches in React 17 (event handlers only)
- The `setState` stale closure trap: `count + 1` called twice
- Functional updates: `c => c + 1` always sees latest state
- How to verify batching with render logs
- `unstable_batchedUpdates` for manual batching (pre-React 18)

---

## Exercise Task

### Step 1 — The two-setState trap

```jsx
function Counter() {
  const [count, setCount] = useState(0);

  console.log('Counter rendered, count:', count);

  const incrementTwice = () => {
    setCount(count + 1); // count is 0 here
    setCount(count + 1); // count is still 0 here!
  };

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={incrementTwice}>+2 (broken)</button>
    </div>
  );
}
```

Click the button. What do you expect? What actually happens?

Expected: count goes from 0 to 2  
Actual: count goes from 0 to 1

**Why?** Both calls capture the same `count = 0` from the closure. Both call `setCount(0 + 1)`. React batches them into one render with the final value — 1.

### Step 2 — Verify batching with render count

```jsx
const renderCount = useRef(0);
renderCount.current++;
console.log(`Render #${renderCount.current}, count: ${count}`);
```

Click the button. Despite two `setCount` calls, you see **one render** (one log). Batching is working.

### Step 3 — Fix with functional updates

```jsx
const incrementTwiceFunctional = () => {
  setCount(c => c + 1); // c is latest state: 0, result: 1
  setCount(c => c + 1); // c is latest queued state: 1, result: 2
};
```

Click this button. Count goes from 0 to 2. Still **one render** (batched), but now with the correct final value.

### Step 4 — Multiple independent state updates

```jsx
function UserProfile() {
  const [name, setName] = useState('');
  const [age, setAge] = useState(0);
  const [loading, setLoading] = useState(false);

  const renderCount = useRef(0);
  renderCount.current++;
  console.log(`Render #${renderCount.current}`);

  const loadUser = () => {
    // Three state updates in one handler
    setName('Alice');
    setAge(30);
    setLoading(false);
  };

  return (
    <div>
      <button onClick={loadUser}>Load User</button>
      <p>{name}, {age}, loading: {loading.toString()}</p>
    </div>
  );
}
```

Click Load User. Despite three `setState` calls, only **one render** occurs. React batches all three.

### Step 5 — The update queue

React processes functional updates in order. Each one receives the result of the previous:

```jsx
const weirdUpdate = () => {
  setCount(c => c + 10);  // queue: [c+10]
  setCount(c => c * 2);   // queue: [c+10, c*2]
  setCount(c => c - 5);   // queue: [c+10, c*2, c-5]
};
// If count = 3: (3+10)*2-5 = 21
```

Try this and verify the math. This demonstrates that functional updates form a chain.

---

## What To Observe

- Two `setCount(count + 1)` calls → only +1 (closure captures stale value)
- Two `setCount(c => c + 1)` calls → correctly +2 (functional update chains)
- Three independent setState calls in one handler → one render
- Render count should be 1 even after multiple setState calls (batching proof)
- Functional updates chain: each receives the output of the previous

---

## Internal React Explanation

### How batching works

React maintains an **update queue** per component. When `setState` is called, React doesn't immediately rerender. Instead, it enqueues an update and marks the component as "has pending updates."

```
Click handler starts
  → setName('Alice')   → enqueue update
  → setAge(30)         → enqueue update
  → setLoading(false)  → enqueue update
Click handler ends
  → React flushes queue in one pass
  → One rerender with all updates applied
```

For **direct value updates** (`setCount(count + 1)`), each call just enqueues a "set to X" operation. The last one wins if the same state is set multiple times.

For **functional updates** (`setCount(c => c + 1)`), React applies them in order, threading the output of each as the input to the next. This is the update chain.

### The closure trap explained

```jsx
const [count, setCount] = useState(0); // count = 0

const incrementTwice = () => {
  // At this point, the closure over 'count' has captured 0
  setCount(count + 1); // setCount(0 + 1) → setCount(1)
  setCount(count + 1); // setCount(0 + 1) → setCount(1) (still 0!)
};
```

Both calls happen synchronously. `count` doesn't change between them (the component hasn't rerendered). Both schedule "set count to 1." React batches them and rerenders once with count = 1.

### The functional update queue

React's fiber architecture keeps a **queue of update objects** per state slot. Functional updates are stored as functions, not values:

```
Queue after functional calls:
[
  { action: c => c + 1 },
  { action: c => c + 1 },
]
```

When React processes the queue, it runs each action sequentially, threading the result:

```
baseState = 0
after action 1: 0 + 1 = 1
after action 2: 1 + 1 = 2
final state = 2
```

Direct value updates are stored as values:
```
[
  { action: 1 },  // replace, don't compute
  { action: 1 },
]
// Last value wins: 1
```

### Why batching is important for UI consistency

Without batching, each `setState` would trigger a rerender. If you had:

```jsx
setCartItems([...items, newItem]);
setCartCount(count + 1);
```

Without batching, there would be a render where `cartItems` has the new item but `cartCount` is still the old value — an inconsistent intermediate state that users might see. Batching ensures related state updates are committed atomically.

---

## Optimization Challenge

**Challenge 1:** Build a bank account with `balance`, `transactionCount`, and `lastTransaction` state. Make a "deposit" action that updates all three. Verify it's one render.

**Challenge 2:** Build a broken double-increment counter using `count + 1` style. Show the bug. Fix it with functional update. Profile both.

**Challenge 3:** Build a reducer-style updater:

```jsx
const processOrder = () => {
  setInventory(inv => inv - quantity);
  setRevenue(rev => rev + price * quantity);
  setOrderCount(n => n + 1);
};
```

Verify the math is always consistent regardless of call order.

---

## Why This Works

**Batching** reduces renders by collecting all synchronous state updates in one event handler and flushing them together. One render instead of N renders.

**Functional updates** solve the stale closure problem by giving the updater function direct access to the latest queued state rather than relying on a potentially stale closure value.

Together, they ensure: minimal rerenders + correct state computation even with multiple updates.

---

## Common Mistakes

**Mistake 1: Relying on `setState` to be synchronous**

```jsx
setCount(count + 1);
console.log(count); // still the old value!
```

`setState` is asynchronous. State doesn't update until the next render. Reading state immediately after setting it gives the old value.

**Mistake 2: Using direct value update when you need the latest state**

Any time your new state depends on the old state, use a functional update. `setCount(count + 1)` is only safe if you're certain only one `setCount` call happens per event. Under async conditions (timeouts, promises), it's always wrong.

**Mistake 3: Expecting multiple setState calls to cause multiple renders**

They're batched. If you need to observe two distinct intermediate states (for animation or testing purposes), you need to structure the updates differently or use `flushSync` (covered on Day 9).

**Mistake 4: Mixing direct and functional updates**

```jsx
setCount(10);       // direct: set to 10
setCount(c => c + 1); // functional: applies to 10 → 11
```

This works but can be confusing. When mixing, the direct update sets the base value and subsequent functional updates chain from it.

**Mistake 5: `setState` inside `useEffect` without deps**

```jsx
useEffect(() => {
  setCount(count + 1); // runs every render, causes another render → infinite loop
}); // no deps!
```

This is an infinite loop — covered thoroughly on Day 10.

---

## Debugging Tools

### Counting renders per state change

```jsx
const renderCount = useRef(0);
renderCount.current++;
console.log(`Render #${renderCount.current}`);
```

If multiple `setState` calls cause multiple renders, you'll see multiple sequential logs. If batched, only one log per user action.

### React DevTools Profiler

Record an interaction. The profiler shows one render entry per batch, not per `setState` call. This is visual proof of batching.

### Log the update queue (advanced)

Install React DevTools and pause in a debugger during a setState call. Inspect the fiber's `updateQueue.pending` linked list to see queued updates.

---

## Interview Questions

1. What is setState batching and why does React do it?
2. What happens when you call `setCount(count + 1)` twice in one handler?
3. What is a functional update and how does it fix the batching problem?
4. Does React batch updates in async contexts (setTimeout, Promise)?
5. How many renders occur when you call 3 different `setState` functions in one event handler?
6. What is the update queue in React fiber?
7. Is `setState` synchronous or asynchronous?
8. How do functional updates chain together?
9. What is `unstable_batchedUpdates` and when was it needed?
10. When should you always prefer functional updates?

---

## Interview Answers

**1. What is batching?**
React collects multiple `setState` calls made within the same synchronous event handler and processes them together in a single render pass. This prevents multiple intermediate renders that would be visible to the user and reduces rendering work.

**2. setCount(count + 1) called twice?**
Both calls capture the same `count` value from the closure. Both enqueue "set count to count + 1" with the same base. React processes them in order, the last one wins. Net result: +1, not +2.

**3. Functional update fix?**
`setCount(c => c + 1)` stores the updater function in the queue. React applies each function in sequence, threading the result: `c` in the second call receives the result of the first. Both calls process correctly → +2.

**4. Batching in async contexts (pre-React 18)?**
No. In React 17 and before, batching only happens inside React's synthetic event handlers. Updates inside `setTimeout`, `Promise.then`, or native event listeners trigger a render per `setState` call. React 18 adds automatic batching everywhere (Day 9).

**5. Three setState calls in one handler?**
One render in React 17+ for event handlers. The three updates are batched and committed in a single render pass with all three state values updated simultaneously.

**6. Update queue in React fiber?**
Each fiber has an `updateQueue` property containing a linked list of pending updates. Direct value updates store the new value; functional updates store the updater function. React processes the queue during the render phase, threading functional updates.

**7. Is setState synchronous?**
No. `setState` schedules an update and returns immediately. The state variable doesn't change until the component rerenders. Code immediately after `setState` still sees the old state value.

**8. How functional updates chain?**
React processes the update queue in order. For each functional update, it calls `action(currentValue)` where `currentValue` is the base state modified by all previous updates in the queue. The output becomes the input for the next functional update.

**9. unstable_batchedUpdates?**
A React utility to manually batch updates outside of event handlers (in timeouts, async callbacks) in React 17 and before. Wrap multiple `setState` calls inside it to force batching. Made obsolete by React 18's automatic batching.

**10. When to always use functional updates?**
When the new state depends on the previous state. When there could be multiple updates queued for the same state. When inside setTimeout, Promise handlers, or async operations. When inside `useReducer`-style patterns. Basically: when in doubt, use functional update.

---

## Senior-Level Thinking

**Batching is a performance feature, not just an implementation detail.**

Understanding batching helps you design state structures correctly. If you have 5 related pieces of state that always change together, consider consolidating them into one `useReducer` or one state object. This guarantees they're always committed atomically and eliminates the possibility of intermediate inconsistent states.

**Functional updates are the right default for state that builds on itself.**

Any time state is derived from its previous value (counters, lists, toggles, stacks), use functional update. It's not just about batching — it also makes your code correct in concurrent mode (React 18+), where renders may be interrupted and retried. Functional updates work correctly under retries; direct value updates may not.

**The relationship to useReducer.**

`useReducer` is essentially "functional updates all the time, with named actions." It's the natural evolution when you have complex state with many updates. The dispatcher always receives the current state, avoiding all stale closure issues. Day 8's lessons are exactly why `useReducer` exists.

---

## Revision Notes

- Batching: multiple `setState` in one handler → one render
- `setCount(count + 1)` twice → only +1 (stale closure)
- `setCount(c => c + 1)` twice → +2 (functional updates chain)
- State doesn't change until after the render — don't read it immediately after setting
- Functional update = safer default when new state depends on old state
- React 17: batch only in event handlers. React 18: batch everywhere (Day 9)

---

## Next Day Preview

**Day 9 — React 18 Automatic Batching**

React 18 extends batching to setTimeout, Promises, and native event listeners. What changes, what doesn't, and how `flushSync` lets you opt out when you need immediate DOM updates.
