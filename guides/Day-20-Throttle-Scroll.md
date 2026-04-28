# Day 20 — Throttle Scroll Events

## Objective

Understand why scroll events are a performance hazard when handled naively, how throttling differs from debouncing, and how to build a production-quality throttled scroll hook using `requestAnimationFrame` and timestamp-based throttling.

---

## Real World Importance

- Sticky header that appears after scrolling past 100px
- Progress bar showing scroll percentage through an article
- Parallax effects triggered by scroll position
- Infinite scroll loading more content when near the bottom
- "Back to top" button appearing after scrolling down
- Analytics tracking scroll depth

---

## Concepts Covered

- How many times scroll events fire (up to 100+ per second)
- Throttling: execute at most once per N ms (vs debounce: wait N ms after last call)
- `requestAnimationFrame` throttling — sync with browser paint cycle
- Timestamp-based throttling — control exact rate
- Building `useThrottle` and `useScrollPosition` hooks
- Passive event listeners for non-blocking scroll handling
- The `IntersectionObserver` alternative (often better than scroll events)

---

## Exercise Task

Create a new file: `src/components/ScrollDemo.jsx`

### Setup — Before you start

```jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
```

> **Note on Step 1:** `ScrollFlood` creates a `div` with `height: 5000px` to generate scrollable content. For the scroll event to fire, this component must be placed inside a page that can scroll (not inside a fixed-height container). Render it directly at the top level in `App.jsx`.

---

### Step 1 — Show the scroll event flood

```jsx
export function ScrollFlood() {
  const eventCount = useRef(0);
  const [renderCount, setRenderCount] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      eventCount.current++;
      console.log(`Scroll event #${eventCount.current}`);
      setRenderCount(eventCount.current); // triggers rerender on EVERY scroll event!
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div style={{ height: '5000px' }}>
      <div style={{ position: 'fixed', top: 0, background: 'white', padding: '8px 12px', zIndex: 10 }}>
        Scroll events fired: {renderCount}
      </div>
      <p style={{ paddingTop: 60 }}>Scroll down to see the event counter increase</p>
    </div>
  );
}
```

Scroll slowly through the page. In 1 second, you may see 60-100 scroll events logged. Each one triggers a rerender — 60 rerenders per second is 60fps of React rendering just from scrolling.

---

### Step 2 — Build timestamp-based throttle

Add this hook above the components:

```jsx
function useThrottle(value, interval = 200) {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastUpdatedRef = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    const timeSinceLast = now - lastUpdatedRef.current;

    if (timeSinceLast >= interval) {
      // Enough time has passed — update immediately
      lastUpdatedRef.current = now;
      setThrottledValue(value);
    } else {
      // Schedule update for remaining time
      const timer = setTimeout(() => {
        lastUpdatedRef.current = Date.now();
        setThrottledValue(value);
      }, interval - timeSinceLast);

      return () => clearTimeout(timer);
    }
  }, [value, interval]);

  return throttledValue;
}
```

---

### Step 3 — Build useScrollPosition hook with throttle

```jsx
function useScrollPosition(throttleMs = 100) {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let lastTime = 0;

    const handleScroll = () => {
      const now = Date.now();
      if (now - lastTime < throttleMs) return; // skip if too soon
      lastTime = now;
      setScrollY(window.scrollY);
    };

    // { passive: true } — tells the browser "this handler won't call preventDefault()"
    // The browser can scroll immediately without waiting for JS — critical for smooth scrolling
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [throttleMs]);

  return scrollY;
}
```

---

### Step 4 — Build requestAnimationFrame throttle

```jsx
function useScrollPositionRAF() {
  const [scrollY, setScrollY] = useState(0);
  const ticking = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      if (!ticking.current) {
        requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          ticking.current = false;
        });
        ticking.current = true;
      }
      // If ticking is true, skip — a RAF is already scheduled
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return scrollY;
}
```

The `ticking` flag ensures only one `requestAnimationFrame` is queued at a time. This naturally throttles updates to 60fps (one per frame) — synchronized with the browser's repaint cycle.

---

### Step 5 — Apply to practical use cases

These components use `useScrollPositionRAF` from Step 4. Add them to the same file:

```jsx
export function StickyHeader() {
  const scrollY = useScrollPositionRAF(); // hook from Step 4
  const isSticky = scrollY > 80;

  return (
    <>
      <header style={{
        position: isSticky ? 'fixed' : 'relative',
        top: 0,
        width: '100%',
        background: isSticky ? 'white' : 'transparent',
        boxShadow: isSticky ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
        transition: 'background 0.2s, box-shadow 0.2s',
        padding: '12px 16px',
        zIndex: 10,
      }}>
        Navigation — scrollY: {scrollY}px {isSticky ? '(sticky)' : ''}
      </header>
      {/* Spacer so content doesn't jump under fixed header */}
      {isSticky && <div style={{ height: 44 }} />}
      <div style={{ height: '3000px', paddingTop: 20 }}>
        <p>Scroll down past 80px to see the sticky header</p>
      </div>
    </>
  );
}

export function ReadingProgress() {
  const scrollY = useScrollPositionRAF(); // hook from Step 4
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - doc.clientHeight;
    setProgress(scrollable > 0 ? (scrollY / scrollable) * 100 : 0);
  }, [scrollY]);

  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '3px',
        width: `${progress}%`,
        background: '#0070f3',
        transition: 'width 0.1s',
        zIndex: 100,
      }} />
      <div style={{ height: '4000px' }}>
        <p>Scroll to see reading progress bar at the top</p>
      </div>
    </div>
  );
}
```

---

### Step 6 — IntersectionObserver (often better than scroll)

For "element is visible" checks, `IntersectionObserver` is more efficient than scroll + position math. It runs off the main thread — no scroll event overhead.

> **Important:** The `options` object passed to `useInView` must be stable. If you pass `{ threshold: 0.1 }` inline at the call site (a new object every render), the `useEffect` dependency will change every render, causing the observer to reconnect on every render. Fix: pass a memoized options object or use a primitive.

```jsx
function useInView(ref, threshold = 0) {
  // Accept threshold as a primitive (not an object) to avoid dependency instability
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold }
    );

    const el = ref.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [ref, threshold]); // threshold is a number — stable as a primitive

  return inView;
}

export function LoadMoreTrigger({ onLoadMore }) {
  const ref = useRef(null);
  const inView = useInView(ref, 0.1);

  useEffect(() => {
    if (inView) onLoadMore();
  }, [inView, onLoadMore]);

  return <div ref={ref} style={{ height: '1px' }} />;
}
```

`IntersectionObserver` runs off the main thread — zero scroll event overhead. The browser tells you when something intersects the viewport, not the other way around.

---

### Final file structure

```
imports (React, useState, useEffect, useRef, useCallback)

useThrottle          (hook — Step 2)
useScrollPosition    (hook — Step 3)
useScrollPositionRAF (hook — Step 4)
useInView            (hook — Step 6)

ScrollFlood     (export — Step 1)
StickyHeader    (export — Step 5)
ReadingProgress (export — Step 5)
LoadMoreTrigger (export — Step 6)
```

Render `<StickyHeader />` and `<ReadingProgress />` separately (not on the same page) — both need a full-page scroll context.

---

## What To Observe

- Without throttle: 60-100 scroll events/second → 60 rerenders/second (Step 1)
- With timestamp throttle (200ms): max 5 updates/second
- With RAF throttle: max 60 updates/second, synced with paint cycle
- `{ passive: true }`: enables browser scroll optimizations (no perceptible lag on scroll)
- IntersectionObserver: zero scroll events, browser handles intersection detection
- Sticky header updates lag slightly with timestamp throttle — acceptable for a header

---

## Internal React Explanation

### Why scroll events are dangerous

The browser fires `scroll` events synchronously during scrolling. If your handler is slow, it blocks the main thread and prevents the browser from painting the next frame. Result: janky scrolling.

Even if the handler is fast, calling `setState` 60 times per second means:
- 60 React renders per second
- 60 reconciliation passes
- 60 potential DOM updates

For a component like "sticky header" that only needs to know "am I past 80px or not?", this is enormous waste — the answer changes at most a few times per scroll session.

### Passive event listeners

```js
window.addEventListener('scroll', handler, { passive: true });
```

Without `passive: true`, the browser must wait for your handler to return before scrolling — because the handler might call `event.preventDefault()` (which blocks default scroll). With `passive: true`, you're promising not to call `preventDefault()`, so the browser can scroll immediately and run your handler asynchronously.

This is one of the most impactful performance improvements for scroll handling.

### requestAnimationFrame as a throttle

```
Scroll event 1 (0ms):    ticking=false → schedule RAF → ticking=true
Scroll event 2 (2ms):    ticking=true → skip
Scroll event 3 (4ms):    ticking=true → skip
...
RAF fires (16ms):         update state, ticking=false
Scroll event N (17ms):   ticking=false → schedule RAF → ticking=true
```

RAF throttles to exactly the display's refresh rate (60fps or 120fps). Updates happen as fast as the browser can paint — no faster, no slower.

### IntersectionObserver vs scroll events

`IntersectionObserver` is implemented in the browser's compositor thread — it doesn't run JavaScript and doesn't affect main thread performance. It's the correct tool for:
- "Is element X visible in the viewport?"
- Lazy loading images
- Infinite scroll triggers
- Animating elements when they enter the viewport

Only use scroll events when you need the exact `scrollY` value (e.g., parallax, progress bars).

---

## Optimization Challenge

**Challenge 1:** Build an infinite scroll component using `IntersectionObserver` + `useCallback` for loading more items. Verify no scroll events are used.

**Challenge 2:** Build a "scroll to section" navigation where clicking links smoothly scrolls to sections, and the active section is highlighted in the nav as you scroll. Use `IntersectionObserver` for section detection.

**Challenge 3:** Build a scroll-based animation: an element that fades in and translates up when it enters the viewport. Use `IntersectionObserver` for trigger detection.

---

## Common Mistakes

**Mistake 1: Not using `{ passive: true }`**

Every scroll event without `passive: true` forces the browser to wait before scrolling. This is the number one cause of scroll jank in React apps.

**Mistake 2: setState on every scroll event**

Even if setState is fast, 60 renders per second is excessive for most scroll-based UI. Throttle to the minimum frequency your UI actually needs.

**Mistake 3: Passing options object inline to useInView**

```jsx
// WRONG — new object every render → observer reconnects every render
const inView = useInView(ref, { threshold: 0.1 });

// RIGHT — pass primitive threshold, construct options inside the hook
const inView = useInView(ref, 0.1);
```

**Mistake 4: Using scroll events for intersection detection**

Replace `scrollY > element.getBoundingClientRect().top` checks with `IntersectionObserver`. The observer approach is off the main thread and more accurate.

**Mistake 5: Not cleaning up scroll listeners**

Unremoved scroll listeners persist after component unmount. Multiple navigations accumulate multiple listeners. Always `removeEventListener` in cleanup — always store the handler in a variable to pass the exact same reference to both add and remove.

---

## Debugging Tools

### FPS meter

Chrome DevTools → More Tools → Rendering → Frame Rendering Stats. Shows FPS while scrolling. Should stay at 60fps.

### Count render frequency

```jsx
const renderCount = useRef(0);
renderCount.current++;
console.log(`Render #${renderCount.current} at ${Date.now()}`);
```

Check the timestamps — how many renders per second?

### Performance Timeline

Record a scroll interaction in the Performance panel. Look for "scripting" blocks (yellow) during scroll. Long scripting blocks = slow scroll handlers.

---

## Interview Questions

1. How many scroll events can fire per second?
2. What is throttling and how does it differ from debouncing?
3. What is `{ passive: true }` and why does it matter?
4. What is the RAF throttle pattern and how does it work?
5. When should you use `IntersectionObserver` instead of scroll events?
6. How would you build a sticky header using scroll position?
7. What is `ticking` in the RAF throttle pattern?
8. How do you prevent scroll event handler accumulation?
9. What's the difference between throttling to 200ms vs using RAF?
10. What is the main thread and why does blocking it matter for scroll?

---

## Interview Answers

**1. Scroll events per second?**
Up to 100+ per second on high-refresh-rate displays (120Hz, 144Hz). At 60fps displays, 60 per second. Without throttling, each event can trigger state updates and React rerenders.

**2. Throttle vs debounce?**
Debounce: waits N ms after the LAST invocation, then fires. Good for "fire when done" (search input). Throttle: fires at most once per N ms during continuous invocations. Good for "fire regularly during activity" (scroll, resize, drag).

**3. `{ passive: true }`?**
Tells the browser "this listener will never call `preventDefault()`." Without it, the browser must wait for your handler before scrolling (to see if scrolling is prevented). With it, the browser scrolls immediately and runs your handler separately. Critical for scroll performance.

**4. RAF throttle?**
A boolean `ticking` flag: on scroll, if `ticking=false`, schedule a RAF callback and set `ticking=true`. Inside the RAF callback, do the work and set `ticking=false`. Subsequent scroll events while `ticking=true` are ignored. This naturally limits to one update per browser paint cycle (~60fps).

**5. IntersectionObserver instead of scroll?**
When you need to know if an element is visible in the viewport. IO runs in the compositor thread — no main thread cost, no scroll events. Use for: lazy loading, infinite scroll, animate-on-enter, section highlighting, visibility tracking.

**6. Sticky header with scroll?**
Track `scrollY` with a throttled scroll listener (or RAF). Set a CSS class/style when `scrollY > threshold`. Use CSS transitions for smooth style changes. Use `{ passive: true }` for the listener.

**7. ticking flag?**
A boolean that prevents multiple RAF callbacks from being scheduled. RAF callbacks are queued — without the flag, each scroll event would queue a new callback, defeating the purpose. `ticking=true` means "a frame update is already scheduled, skip this event."

**8. Prevent listener accumulation?**
Return a cleanup function from `useEffect` that calls `removeEventListener`. Always store the handler reference in a variable to pass the exact same function to both add and remove.

**9. 200ms throttle vs RAF?**
RAF throttle: 60 updates/second, synced with paint — looks smooth, matches display refresh. 200ms throttle: 5 updates/second — more efficient, but can feel slightly laggy for smooth animations. Choose based on how smooth the visual needs to be: parallax → RAF; sticky header → 100-200ms is fine.

**10. Main thread and scroll?**
The browser's main thread handles JavaScript execution, layout, style recalculation, and paint. `scroll` event handlers run on the main thread. If a handler takes >16ms, the browser misses a frame → scroll jank. `passive: true` allows the browser to scroll on a separate thread while JavaScript is running.

---

## Senior-Level Thinking

**Prefer IntersectionObserver wherever possible.**

Scroll events are a legacy API for a pre-observer world. `IntersectionObserver` handles the majority of scroll-driven use cases more efficiently, with less code, and without main thread involvement. The only case where scroll events are necessary is when you need the raw `scrollY` value (parallax, progress bars).

**The three layers of scroll performance:**

1. **Event handling**: Use `passive: true`, minimize handler complexity
2. **Update throttling**: Use RAF or timestamp throttle to limit state updates
3. **React rendering**: Use `React.memo` and keep scroll-tracking state localized to the component that needs it (not lifted to a parent that rerenders other things)

Missing any one layer can cause jank.

---

## Revision Notes

- Scroll fires 60-100+ times/second — don't setState on every event
- `{ passive: true }` — browser scrolls without waiting for handler
- RAF throttle: `ticking` flag limits to 1 update per frame (~60fps)
- Timestamp throttle: explicit N ms interval control
- IntersectionObserver: off main thread, better than scroll for visibility checks
- Always removeEventListener in cleanup — store handler reference in variable
- Pass threshold as a primitive to useInView (not an object) to avoid dep instability

---

## Next Day Preview

**Day 21 — Weekly Project: Product Search App**

Apply all Week 3 concepts: debounced API calls, useDeferredValue for rendering, memoized filtering, virtualized results, and throttled scroll for infinite loading.
