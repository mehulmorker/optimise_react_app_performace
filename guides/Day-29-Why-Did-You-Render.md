# Day 29 — Why Did You Render

## Objective

Use the `@welldone-software/why-did-you-render` library to automatically detect and log wasted renders in development. Where the Profiler tells you *that* a component re-rendered, WDYR tells you *exactly what changed* — including showing you when `{}` equals `{}` but React still re-rendered because they're different object references.

---

## Real World Importance

- A memo'd component that still rerenders on every parent render — WDYR shows the exact unstable prop
- `useCallback` dependencies that silently include a recreated object — WDYR logs the change
- Context consumers that rerender even when the consumed value looks the same — WDYR shows the old vs new values side-by-side
- Large teams: automatic detection of wasted renders without manual `console.log` instrumentation
- Finding the "invisible" rerenders that only appear under specific interaction sequences

---

## Concepts Covered

- Installing and configuring `@welldone-software/why-did-you-render`
- Opting components in to tracking
- Reading WDYR console output
- Tracking hooks (state and context changes)
- Tracking all components at once (global mode)
- Understanding "same value, different reference" — the most common wasted render
- WDYR for custom hooks
- Development-only usage

---

## Exercise Task

### Step 1 — Install

```bash
npm install @welldone-software/why-did-you-render --save-dev
```

### Step 2 — Initialize before React (must be first)

Create a file that runs before any React component code:

```js
// src/wdyr.js  (import this FIRST in src/index.js or src/main.jsx)
import React from 'react';

if (process.env.NODE_ENV === 'development') {
  const whyDidYouRender = require('@welldone-software/why-did-you-render');
  whyDidYouRender(React, {
    trackAllPureComponents: false, // opt-in per component (safer)
    trackHooks: true,
    logOnDifferentValues: true,
    collapseGroups: true,
  });
}
```

```js
// src/index.js or src/main.jsx — FIRST import
import './wdyr';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
```

### Step 3 — Opt a component in to tracking

```jsx
const ProductCard = React.memo(function ProductCard({ product, onAddToCart }) {
  return (
    <div>
      <h3>{product.name}</h3>
      <p>${product.price}</p>
      <button onClick={() => onAddToCart(product.id)}>Add to Cart</button>
    </div>
  );
});

// Opt in — WDYR watches this component
ProductCard.whyDidYouRender = true;
```

### Step 4 — Trigger and read the output

```jsx
function ProductList() {
  const [cart, setCart] = useState([]);
  const products = [
    { id: 1, name: 'Widget', price: 9.99 },
    { id: 2, name: 'Gadget', price: 14.99 },
  ];

  // BUG: new function reference on every render
  const handleAddToCart = (id) => {
    setCart(prev => [...prev, id]);
  };

  return (
    <div>
      <p>Cart: {cart.length} items</p>
      {products.map(p => (
        <ProductCard key={p.id} product={p} onAddToCart={handleAddToCart} />
      ))}
    </div>
  );
}
```

Click "Add to Cart." In the console:

```
ProductCard
Re-rendered because of props changes:
  - onAddToCart: [function] !== [function]
    (same value, different reference)
    old: function handleAddToCart() {}
    new: function handleAddToCart() {}
```

WDYR shows: the prop is a function that **looks** the same but is a new reference every render. This is the exact wasted render — `React.memo` failed because the function reference changed. Fix: `useCallback`.

### Step 5 — Fix and verify

```jsx
const handleAddToCart = useCallback((id) => {
  setCart(prev => [...prev, id]);
}, []); // no deps — setCart is stable
```

Add to cart again. The WDYR log is gone — `ProductCard` no longer rerenders on parent state change.

### Step 6 — Tracking object prop instability

```jsx
function UserAvatar({ style, name }) {
  return <div style={style}>{name}</div>;
}
UserAvatar.whyDidYouRender = true;

// Parent passes a new object every render
function Header() {
  const [theme, setTheme] = useState('light');
  return (
    <div>
      <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>Toggle</button>
      {/* New object on every render */}
      <UserAvatar style={{ color: theme === 'dark' ? 'white' : 'black' }} name="Alice" />
    </div>
  );
}
```

Toggle theme. WDYR logs:

```
UserAvatar
Re-rendered because of props changes:
  - style: [object] !== [object]
    (same value, different reference)
    old: { color: "black" }
    new: { color: "black" }
```

The object has the same shape but is a different reference — `React.memo` fails. Fix: `useMemo` for the style object.

### Step 7 — Tracking context changes

```jsx
function CartBadge() {
  const { cart } = useContext(AppContext);
  return <span>{cart.length}</span>;
}
CartBadge.whyDidYouRender = true;
```

Toggle the theme (unrelated to cart). WDYR logs:

```
CartBadge
Re-rendered because of context changes:
  - AppContext: [object] !== [object]
    theme: "light" → "dark"
    cart: (same reference)
```

WDYR shows the context value changed (new object reference due to theme change) even though `cart` didn't change. Fix: split the context (Day 22).

### Step 8 — Track all pure components globally

```js
// wdyr.js
whyDidYouRender(React, {
  trackAllPureComponents: true, // tracks every React.memo and PureComponent
  trackHooks: true,
});
```

This is noisy — use only for a broad initial audit. Then disable and switch to per-component `whyDidYouRender = true` for targeted investigation.

### Step 9 — Custom display names for clearer logs

```jsx
const ProductCard = React.memo(function ProductCard(props) {
  // ...
});
ProductCard.whyDidYouRender = { logOnDifferentValues: true };
ProductCard.displayName = 'ProductCard'; // ensures WDYR shows a useful name
```

Anonymous components show as `Component` in WDYR logs. Always name your components.

---

## What To Observe

- Unstable function prop: WDYR shows `[function] !== [function] (same value, different reference)`
- Unstable object prop: WDYR shows `[object] !== [object] (same value, different reference)`
- Context rerender: WDYR shows exactly which key in the context value changed
- After fix: no WDYR log for that interaction — wasted render eliminated
- `trackHooks: true`: WDYR logs when a hook's value changes even if not surfaced in props

---

## Internal React Explanation

### How WDYR intercepts renders

WDYR patches React's reconciler to intercept `React.memo` comparisons and `PureComponent.shouldComponentUpdate`. When a "should update" check returns `true`, WDYR runs its own deep comparison to determine:

1. Did the value actually change (different by value)?
2. Or is it the same value but a different reference?

If case 2: logs "same value, different reference" — a genuine wasted render.

### The `logOnDifferentValues` flag

With `logOnDifferentValues: true`, WDYR also logs when values genuinely changed but you might not expect them to (e.g., a derived value being recomputed unnecessarily). With `false`, it only logs the "same reference, different value" case — less noisy for most use cases.

### Why WDYR must be imported first

WDYR patches the React module at require-time. If React has already been initialized (even partially), the patches don't apply fully. By importing `./wdyr` before React in the entry file, you guarantee the patches are in place before any React component code runs.

---

## Optimization Challenge

**Challenge 1:** Take the Dashboard from Day 21 (Product Search App). Add WDYR with `trackAllPureComponents: true`. Record which components log wasted renders when you:
- Type in the search box
- Change the sort order
- Scroll to the bottom

Fix each wasted render. Verify WDYR logs are gone.

**Challenge 2:** Build a component that uses context and deliberately trigger a wasted render. Use WDYR to confirm the context value is being recreated. Fix with `useMemo` on the context value. Verify.

---

## Common Mistakes

**Mistake 1: Using WDYR in production**

WDYR patches React internals and adds significant overhead. The `if (process.env.NODE_ENV === 'development')` guard is essential — without it, WDYR runs in production and hurts performance.

**Mistake 2: Importing wdyr.js after React**

```js
// WRONG — React already initialized
import React from 'react';
import './wdyr';

// RIGHT — WDYR patches React before it's used
import './wdyr';
import React from 'react';
```

**Mistake 3: Tracking all pure components in a large app permanently**

`trackAllPureComponents: true` is extremely verbose in a large codebase. Every `React.memo` component logs on every render that would have been skipped. Use it for an initial audit, then switch to targeted `whyDidYouRender = true` on specific suspects.

**Mistake 4: Misreading "same value, different reference"**

"Same value" means the values are deeply equal but `===` returns false (different object/function references). This is the most important WDYR message — it means `React.memo` ran and bailed out would have been possible if the reference were stable. This is always fixable with `useCallback` or `useMemo`.

**Mistake 5: Ignoring WDYR logs for context**

Context-triggered rerenders aren't shown in the flame chart as clearly as prop-triggered rerenders. WDYR's context change logs are often the first place you'll see a context split problem in a concrete, actionable form.

---

## Debugging Tools

### WDYR configuration options

```js
whyDidYouRender(React, {
  trackAllPureComponents: false,  // only opt-in components
  trackHooks: true,               // track hook value changes
  logOnDifferentValues: false,    // only log same-value/different-reference
  collapseGroups: true,           // collapse console groups (less noise)
  titleColor: 'teal',             // custom colors in console
  diffNameColor: 'darkturquoise',
});
```

### Per-component options

```jsx
// Basic opt-in
MyComponent.whyDidYouRender = true;

// With options
MyComponent.whyDidYouRender = {
  logOnDifferentValues: true,
  customName: 'MyComponent',
};
```

### DevTools + WDYR together

Use both. DevTools Profiler shows which commits are slow and how long. WDYR explains why specific components rendered in those commits. They complement each other: Profiler = macro view, WDYR = micro diagnosis.

---

## Interview Questions

1. What problem does `@welldone-software/why-did-you-render` solve?
2. What does "same value, different reference" mean in a WDYR log?
3. How does WDYR differ from the React DevTools Profiler?
4. Why must WDYR be imported before React?
5. What does `trackAllPureComponents` do and when should you use it?
6. What does `trackHooks: true` add?
7. How do you interpret a WDYR context change log?
8. What's the fix for a "same value, different reference" props log?
9. Why should WDYR only run in development?
10. How do you use WDYR alongside the DevTools Profiler?

---

## Interview Answers

**1. What problem does WDYR solve?**
It automatically detects wasted renders — cases where a memoized component re-executed its render function even though its output would have been identical. It explains exactly which prop, state, or context value caused the failed memo bailout, with old and new values shown side-by-side.

**2. "Same value, different reference"?**
The prop's value is deeply equal (`JSON.stringify(old) === JSON.stringify(new)`) but they're not the same object (`old !== new`). `React.memo` uses `===` by default — it sees different references and re-renders, even though the output would have been unchanged. The fix is to stabilize the reference (useCallback for functions, useMemo for objects).

**3. WDYR vs DevTools Profiler?**
Profiler: shows timing, commit history, and "why" at a high level (state/props/parent changed). WDYR: shows the exact old and new values of the changing prop, with a "same value, different reference" flag. WDYR gives more actionable information for a specific component; Profiler gives a broader performance picture across the whole tree.

**4. Why import before React?**
WDYR patches the React module at initialization time. If React is imported first, some internals are already set up without the patches. The import order ensures WDYR's monkey-patches are in place before any React component code executes.

**5. trackAllPureComponents?**
Automatically opts in every `React.memo` component and `PureComponent` to WDYR tracking. Useful for a broad initial audit — find all wasted renders in one pass. Too noisy for daily use in large apps. After the audit, switch to targeted per-component opt-in.

**6. trackHooks: true?**
WDYR also monitors hook return values. When a hook (like a custom hook or useContext) returns a new reference even though the value is the same, WDYR logs it. This catches wasted renders caused by unstable hook return values, not just unstable props.

**7. Context change log?**
WDYR shows which context caused the rerender, the old context value, the new context value, and which key changed. For example: `AppContext changed: theme "light" → "dark"` even though `cart` was unchanged. This reveals that the context value is a combined object — splitting the context (Day 22) or memoizing the context value would eliminate this rerender.

**8. Fix for "same value, different reference"?**
- Function prop: wrap with `useCallback` in the parent
- Object/array prop: wrap with `useMemo` in the parent, or move to a stable reference outside the component
- Context value: wrap the context value with `useMemo` in the provider

**9. Development only?**
WDYR patches React's internals (reconciler, memo comparison) and performs deep value comparisons on every render check. This overhead is acceptable in development for debugging but would significantly degrade production performance. The `process.env.NODE_ENV === 'development'` guard ensures it's stripped from production builds.

**10. DevTools + WDYR together?**
Use the Profiler to identify which commits are slow and which components are rendering too often (the macro view). Then add `whyDidYouRender = true` to the suspicious components and reproduce the interaction — WDYR explains the root cause (the micro view). Fix based on WDYR's diagnosis, re-profile to confirm the commit is gone.

---

## Senior-Level Thinking

**WDYR as a code review tool.**

In a team setting, WDYR running in development CI catches performance regressions before they land. A PR that introduces a new wasted render (unstable prop passing pattern) will show WDYR logs in the test run. Some teams configure WDYR to `console.error` instead of `console.warn` for certain components, making regressions CI-blocking.

**The "same value, different reference" pattern is everywhere.**

After using WDYR for a week, you start noticing the pattern in code review without needing the tool:
- `value={{ count, items }}` inside a render function → unstable object
- `onChange={e => doSomething(e.target.value)}` inline → unstable function
- `useMemo` missing the correct deps → returns a new object unnecessarily

WDYR trains you to see reference instability before writing the code.

**When WDYR isn't enough.**

WDYR diagnoses prop/state/context reference issues. It doesn't help with:
- Components that render correctly but are just slow (expensive computation) → use Profiler + `useMemo`
- Rendering the correct number of times but with a bad algorithm → profile `actualDuration`
- Too many DOM nodes (virtualization needed) → use memory profiler

WDYR + Profiler together cover the full spectrum of React render performance issues.

---

## Revision Notes

- WDYR = development-only library that explains wasted renders in the console
- Setup: import before React in entry file, wrapped in `NODE_ENV === 'development'`
- Opt in: `MyComponent.whyDidYouRender = true`
- Key log: "same value, different reference" → fix with useCallback / useMemo
- `trackAllPureComponents`: broad audit; per-component opt-in: targeted debug
- `trackHooks: true`: also catches unstable hook return values
- Context logs: shows exactly which key changed → reveals context split opportunities
- Combine with Profiler: Profiler = what's slow; WDYR = why it rendered

---

## Next Day Preview

**Day 30 — Final Project: Instagram Feed Clone**

Build a production-quality Instagram-style infinite scroll feed applying every technique from all four weeks: virtualized list, memoized cards, lazy-loaded images, infinite scroll, and context-optimized global state.
