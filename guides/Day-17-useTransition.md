# Day 17 — useTransition

## Objective

Understand `useTransition` — React 18's mechanism for marking state updates as "non-urgent transitions." Learn how it keeps the current UI interactive while a heavy render is in progress, using the `isPending` flag to show loading state.

---

## Real World Importance

- Tab switchers where each tab loads heavy content
- Navigation where the new page renders are slow
- Filter panels where changing a filter triggers expensive recompute + render
- Form submissions with heavy preview updates
- Dashboards switching between data views

---

## Concepts Covered

- What `startTransition` marks and what it means
- The `isPending` flag
- How transitions differ from deferred values
- Transition + Suspense (preview of Day 23)
- When a transition is "interrupted" by urgent updates
- What can and can't be wrapped in `startTransition`

---

## Exercise Task

### Step 1 — Build the heavy tab switcher (unoptimized)

```jsx
function TabSwitcher() {
  const [tab, setTab] = useState('home');

  return (
    <div>
      <div>
        <button onClick={() => setTab('home')}>Home</button>
        <button onClick={() => setTab('posts')}>Posts</button>
        <button onClick={() => setTab('about')}>About</button>
      </div>

      {tab === 'home' && <HomeTab />}
      {tab === 'posts' && <PostsTab />}
      {tab === 'about' && <AboutTab />}
    </div>
  );
}

function HomeTab() { return <div>Home Content</div>; }
function AboutTab() { return <div>About Content</div>; }

function PostsTab() {
  console.log('PostsTab rendered');
  // Simulate 500 expensive items
  return (
    <ul>
      {Array.from({ length: 500 }, (_, i) => (
        <SlowPost key={i} index={i} />
      ))}
    </ul>
  );
}

function SlowPost({ index }) {
  // Simulate expensive render
  let total = 0;
  for (let i = 0; i < 5000; i++) total += i;
  return <li>Post {index + 1} (sum: {total})</li>;
}
```

Click the **Posts** tab. The entire UI freezes until the 500 `SlowPost` components render. The button you clicked doesn't even animate/depress visually — the browser is blocked.

### Step 2 — Add useTransition

```jsx
function TabSwitcher() {
  const [tab, setTab] = useState('home');
  const [isPending, startTransition] = useTransition();

  const selectTab = (nextTab) => {
    startTransition(() => {
      setTab(nextTab); // marked as non-urgent transition
    });
  };

  return (
    <div>
      <div>
        <button onClick={() => selectTab('home')}
          style={{ opacity: isPending ? 0.5 : 1 }}>
          Home
        </button>
        <button onClick={() => selectTab('posts')}
          style={{ opacity: isPending ? 0.5 : 1 }}>
          Posts
        </button>
        <button onClick={() => selectTab('about')}
          style={{ opacity: isPending ? 0.5 : 1 }}>
          About
        </button>
      </div>

      {/* Show spinner while transition is pending */}
      {isPending && <div>Loading...</div>}

      <div style={{ opacity: isPending ? 0.6 : 1 }}>
        {tab === 'home' && <HomeTab />}
        {tab === 'posts' && <PostsTab />}
        {tab === 'about' && <AboutTab />}
      </div>
    </div>
  );
}
```

Click **Posts** again. The button click is registered immediately (buttons show slight opacity change). The current tab stays visible with reduced opacity. "Loading..." appears. Then the posts tab finishes rendering and replaces the content.

### Step 3 — Interrupt a transition

Click **Posts** (heavy render starts), then immediately click **About** (light render).

With `startTransition`, the Posts render is interrupted. React switches to rendering About immediately — because user input (clicking About) is more urgent than the in-progress Posts transition.

This is the **interruptibility** of concurrent transitions.

### Step 4 — Compare isPending usage

```jsx
// Button variant: show specific loading state per tab
function TabButton({ label, tabName, currentTab, onSelect }) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(() => onSelect(tabName));
  };

  return (
    <button onClick={handleClick}>
      {label}
      {isPending && <Spinner />}
    </button>
  );
}
```

With this pattern, each button has its own `isPending` — only the clicked button shows a spinner, not all tabs.

### Step 5 — What you cannot put in startTransition

```jsx
// WRONG — synchronous DOM input must not be in transition
startTransition(() => {
  setInputValue(e.target.value); // this should be urgent, not transition
});

// CORRECT — only mark the heavy downstream render as transition
const handleInputChange = (e) => {
  setInputValue(e.target.value); // urgent — immediate
  startTransition(() => {
    setFilterQuery(e.target.value); // transition — heavy render
  });
};
```

State that directly controls user input must stay urgent. Only state that drives expensive rendering should go inside `startTransition`.

---

## What To Observe

- Without transition: clicking Posts freezes the entire UI until rendering completes
- With transition: UI stays interactive, buttons respond, old tab shows during render
- `isPending`: true while transition is in progress, false when complete
- Interrupting: clicking About while Posts is rendering cancels the Posts render
- Transitions batch together — multiple `startTransition` calls within a handler combine

---

## Internal React Explanation

### What startTransition does

`startTransition(() => { setTab('posts') })` creates a React **transition**:

1. React schedules the state update at **transition priority** (lower than default/user-event priority)
2. The current render (tab=home) stays committed to DOM
3. React starts a **concurrent render** of tab='posts' in the background
4. If higher-priority work arrives (user input), React pauses the background render
5. When idle, React resumes and completes the transition render
6. On completion, React commits the new state

`isPending` is `true` from when `startTransition` is called until the transition render completes.

### Priority lanes in React 18

React 18 uses a "lane" model for prioritization:

```
SyncLane (highest):     flushSync, root-level exceptions
InputContinuousLane:    drag events, scroll
DefaultLane:            most event handlers
TransitionLane:         startTransition
IdleLane (lowest):      useIdleCallback-equivalent work
```

`startTransition` moves the state update to `TransitionLane`. User interactions (clicks, typing) run in `DefaultLane` or higher. React always processes higher lanes before lower lanes — so a click during a transition preempts it.

### How the concurrent render works

React 18's concurrent renderer can:
1. Start rendering a new tree
2. Pause mid-render (yield to the browser event loop)
3. Check if higher-priority work arrived
4. If yes: throw away the in-progress render, process the urgent work
5. If no: continue the render from where it paused

This "time slicing" is what makes transitions interruptible. Each slice of work is roughly a 5ms chunk. Between chunks, React checks the event queue.

### Transition vs Deferred Value

Both use the concurrent renderer, but from different positions:

| | useTransition | useDeferredValue |
|---|---|---|
| Where | You own the state setter | You receive the value |
| Usage | `startTransition(() => setState(x))` | `const d = useDeferredValue(x)` |
| isPending | Yes, available | Use `val !== deferredVal` |
| Use case | Tab switching, navigation | Search input, heavy child |

---

## Optimization Challenge

**Challenge 1:** Build a multi-step form where navigating between steps involves expensive validation/computation. Use `useTransition` to keep the navigation buttons responsive while steps render.

**Challenge 2:** Build a "live preview" editor where the left side is a text editor (urgent input) and the right side is a rendered preview (transition). Typing in the editor should never feel laggy.

**Challenge 3:** Combine `useTransition` with Suspense (preview):

```jsx
const PostsTab = React.lazy(() =>
  new Promise(resolve => setTimeout(() => resolve(import('./PostsTab')), 2000))
);

function TabSwitcher() {
  const [tab, setTab] = useState('home');
  const [isPending, startTransition] = useTransition();

  return (
    <Suspense fallback={<div>Loading tab...</div>}>
      {/* With startTransition, Suspense doesn't show fallback during transition */}
      {/* The old tab stays visible until the new one is ready */}
      {tab === 'posts' && <PostsTab />}
    </Suspense>
  );
}
```

---

## Why This Optimization Works

Without transitions, React treats all state updates as equally urgent. A heavy state update blocks the UI until complete.

With transitions, React knows "this update is for a non-urgent render." It:
1. Keeps the current UI interactive (no blocking)
2. Shows the old content while the new content prepares
3. Allows interruption if the user changes direction
4. Commits the new content atomically when ready

The user experience shifts from "blocked for 500ms" to "responsive immediately, new content in 500ms."

---

## Common Mistakes

**Mistake 1: Putting input value updates inside startTransition**

User input (the value in a text field) must update immediately. If you put `setInputValue` inside `startTransition`, the user's typing lags. Only put the heavy downstream state inside the transition.

**Mistake 2: Expecting transitions to speed up rendering**

Transitions don't make rendering faster. The render still takes the same time. They just move it to the background so the current UI stays interactive. The total work is the same — the perception changes.

**Mistake 3: Using transitions for every state update**

Transitions have overhead (concurrent scheduling, interruption logic). Use them only for genuinely heavy renders. For fast renders, the default behavior is fine.

**Mistake 4: Not handling isPending**

If you don't handle `isPending`, users have no feedback that something is happening. The tab click appears to do nothing until the render finishes. Always show a visual indicator.

**Mistake 5: Transitions and synchronous code**

Code inside `startTransition` must be synchronous. You can't do:

```jsx
startTransition(async () => {
  const data = await fetchData(); // NOT supported
  setData(data);
});
```

Use `useEffect` or event handlers for async operations. Transitions are for synchronous state updates that drive expensive synchronous renders.

---

## Debugging Tools

### React DevTools Profiler

Enable "Show lanes" in Profiler settings. You'll see transitions shown in a different lane color from default renders. This visually confirms the concurrent rendering.

### Log transition timing

```jsx
const [isPending, startTransition] = useTransition();

const selectTab = (tab) => {
  console.time('transition');
  startTransition(() => setTab(tab));
};

useEffect(() => {
  if (!isPending) {
    console.timeEnd('transition');
  }
}, [isPending]);
```

---

## Interview Questions

1. What does `startTransition` do?
2. What is `isPending` and how do you use it?
3. What is the difference between `useTransition` and `useDeferredValue`?
4. What happens when a user interacts with the UI while a transition is in progress?
5. Why can't you put user input state updates inside `startTransition`?
6. What are React's rendering priority lanes?
7. Does `startTransition` make rendering faster?
8. Can you use `async/await` inside `startTransition`?
9. What visual feedback should you provide during a transition?
10. When should you NOT use `useTransition`?

---

## Interview Answers

**1. startTransition?**
It marks a state update as a low-priority "transition." React renders the transition update concurrently in the background, keeping the current UI committed and interactive. If higher-priority work arrives, React pauses and handles it first.

**2. isPending?**
`true` from when `startTransition` is called until the transition render completes and is committed. Use it to show loading indicators, dim the stale content, or disable buttons during the transition.

**3. useTransition vs useDeferredValue?**
`useTransition` is used when you own the state setter — you decide what's a transition. `useDeferredValue` is used when you receive a value (from props or context) and want to defer the heavy render it drives. Both use React's concurrent rendering, just from different positions.

**4. UI interaction during a transition?**
User interactions are higher priority (DefaultLane vs TransitionLane). React pauses the transition render, processes the interaction, and then resumes or restarts the transition with the latest state. The in-progress transition render may be discarded.

**5. Input state outside transition?**
User input must update immediately to feel responsive. If `setInputValue` is in a transition, the input lags by a render cycle — users see their keystrokes delayed. Keep urgent updates urgent; only put the slow downstream consequences in transitions.

**6. Priority lanes?**
React 18 uses a lane model: SyncLane (flushSync, errors) → InputContinuousLane (drag/scroll) → DefaultLane (most events) → TransitionLane (startTransition) → IdleLane. Higher lanes always preempt lower lanes.

**7. Faster rendering?**
No. The render still takes the same time. Transitions move work to the background, improving perceived performance by keeping the current UI interactive. Total computation is unchanged or slightly higher (due to concurrent overhead).

**8. Async inside startTransition?**
No. `startTransition` requires a synchronous function. Async functions return Promises which are ignored. Run async work (fetch) outside the transition; when the data is ready, put the state update inside `startTransition`.

**9. Visual feedback during transition?**
Use `isPending` to: show a spinner/loading indicator, dim stale content with reduced opacity, show "Updating..." text, disable buttons to prevent double-clicks. Don't leave users with no feedback.

**10. When NOT to use useTransition?**
When renders are fast (<50ms). When the state drives user input directly. When you're building for non-concurrent React (ReactDOM.render). When the update is urgent (errors, confirmations, direct user feedback). Transitions are for heavy, non-urgent background work only.

---

## Senior-Level Thinking

**Transitions redefine "loading state" in React.**

Before React 18, loading states were managed entirely by your code: set `loading = true`, fetch, set `loading = false`. Transitions provide a new primitive: React itself tracks whether a state update is "done." `isPending` is React's built-in loading state for synchronous rendering work — complementing your async loading states for network requests.

**The Suspense + Transition synergy.**

When you use `startTransition` to switch to a Suspense boundary that hasn't loaded yet, React holds the old content visible until the new content is ready — rather than showing the fallback. This creates smooth transitions without flash-of-fallback-content. Day 24 covers this UX pattern in depth.

**Transitions are not free — they're a bet.**

The concurrent overhead (scheduling, interruption tracking) is real. For renders that take <50ms, transitions add overhead with no perceptible benefit. Profile your heavy renders first. If a tab switch takes 500ms and blocks the UI, transitions are clearly worth it. If it takes 30ms, default rendering is fine.

---

## Revision Notes

- `startTransition(() => setState(x))` marks update as low-priority transition
- `isPending`: true while transition rendering, use for UI feedback
- Transitions are interruptible — urgent user input preempts them
- Cannot use async inside startTransition (synchronous only)
- Input state must stay urgent (outside transition)
- Doesn't make rendering faster — makes current UI stay interactive
- Requires React 18 concurrent mode (`createRoot`)
- useTransition = you own the setter; useDeferredValue = you receive the value

---

## Next Day Preview

**Day 18 — Virtualized Lists**

What happens when you render 5,000 DOM nodes and how to fix it with windowing/virtualization. Building with `react-window`. Understanding the technique: render only what's visible.
