
---

# 🚀 30-Day React Optimization Bootcamp

## Rules (Important)

Every day do:

### Step 1:

Build task normally

### Step 2:

Add:

```js id="0w7wrh"
console.log("render")
```

inside components.

### Step 3:

Observe rerenders.

### Step 4:

Optimize.

### Step 5:

Explain in your own words:

> Why did this improve?

That’s where mastery happens.

---

# 📅 WEEK 1 — React Rendering Core

---

## Day 1 — Parent & Child Rerender

Build:

* Parent counter
* 3 children

Update parent.

### Learn:

* parent rerender causes child rerender

---

## Day 2 — React.memo

Optimize yesterday’s child rerenders.

### Learn:

* shallow compare
* memo basics

---

## Day 3 — Inline Functions Problem

Pass:

```js id="tzh3j7"
onClick={() => {}}
```

Break memoization.

Fix with `useCallback`.

---

## Day 4 — Object Props Problem

Pass:

```js id="x0kjrk"
config={{ dark: true }}
```

Fix with `useMemo`

---

## Day 5 — Keys & Reconciliation

List with index key.

Delete middle item.

Observe weird behavior.

---

## Day 6 — Controlled vs Uncontrolled Input Render Count

Compare both.

---

## Day 7 — Weekly Review Project

Build Todo App optimized.

Need:

* memo
* proper keys
* stable handlers

---

# 📅 WEEK 2 — State & Effects

---

## Day 8 — Multiple setState

```js id="rykk6m"
setCount(count+1)
setCount(count+1)
```

Then functional update.

---

## Day 9 — React 18 Batching

Try updates inside:

* click
* timeout
* promise

---

## Day 10 — Infinite Effect Loop

Create bug. Fix dependencies.

---

## Day 11 — Stale Closure

Interval counter bug.

Fix with functional update.

---

## Day 12 — useRef vs useState

Track render counts using ref.

---

## Day 13 — Cleanup Memory Leak

Resize listener / timer cleanup.

---

## Day 14 — Weekly Project

Build Stopwatch App.

Need:

* refs
* effects
* cleanup

---

# 📅 WEEK 3 — Performance Optimization

---

## Day 15 — Expensive Filtering

Search 10k items.

Laggy UI.

Fix with `useMemo`

---

## Day 16 — useDeferredValue

Smooth typing during heavy filter.

---

## Day 17 — useTransition

Heavy tab switching.

Use:

```js id="mpg2dz"
startTransition()
```

---

## Day 18 — Large List Render

5000 rows.

Then optimize with virtualization.

---

## Day 19 — Debounce Search Hook

Build:

```js id="gc42y6"
useDebounce()
```

---

## Day 20 — Throttle Scroll Events

Infinite scroll optimization.

---

## Day 21 — Weekly Project

Build Product Search App

Need:

* debounce
* deferred value
* memoized filter

---

# 📅 WEEK 4 — Advanced React

---

## Day 22 — Context Rerender Problem

One context with many values.

Fix by splitting context.

---

## Day 23 — Lazy Loading Routes

Use:

```js id="9m9v0n"
React.lazy()
Suspense
```

---

## Day 24 — Suspense Fallback UX

Delayed component loader.

---

## Day 25 — State Locality

Lift state too high.

Then move down.

---

## Day 26 — Smart vs Dumb Components

Separate UI from logic.

---

## Day 27 — Error Boundary

Build crashing child.

Catch gracefully.

---

## Day 28 — React DevTools Profiler

Analyze wasted renders.

---

## Day 29 — Why Did You Render

Detect unnecessary rerenders.

---

## Day 30 — Final Project

Build **Instagram Feed Clone**

Need:

* virtualization
* memo cards
* lazy images
* infinite scroll
* context optimization

---


