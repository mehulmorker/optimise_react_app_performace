# Day 18 — Virtualized Lists

## Objective

Understand why rendering 5,000+ DOM nodes is fundamentally different from rendering 50, and how virtualization (windowing) fixes it by rendering only the visible items. This is one of the highest-impact performance techniques for data-heavy UIs.

---

## Real World Importance

- Data tables with thousands of rows (sales data, logs, user lists)
- Chat applications with long message history
- File explorers with deep directory trees
- Social media feeds with infinite scroll
- Code editors with large files
- Any list where the data far exceeds the viewport height

---

## Concepts Covered

- Why DOM nodes are expensive (memory, layout, paint)
- The "viewport window" concept — only render what's visible
- Implementing basic virtualization from scratch
- Using `react-window` for production virtualization
- Variable-height rows
- Combining virtualization with React.memo
- The tradeoffs: scroll jump bugs, accessibility considerations

---

## Exercise Task

### Step 1 — Build the naive 5,000-item list

```jsx
function NaiveList() {
  const items = useMemo(() =>
    Array.from({ length: 5000 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      description: `Description for item ${i}`,
      value: Math.random() * 1000,
    })),
  []);

  console.time('render');

  const result = (
    <div style={{ height: '600px', overflow: 'auto' }}>
      {items.map(item => (
        <div key={item.id} style={{ height: '50px', borderBottom: '1px solid #eee', padding: '10px' }}>
          <strong>{item.name}</strong>: {item.description} — ${item.value.toFixed(2)}
        </div>
      ))}
    </div>
  );

  console.timeEnd('render');
  return result;
}
```

Open this page. Observe:
1. Initial render time (console.time)
2. Memory usage in DevTools Memory panel
3. Scrolling performance (FPS meter in Performance panel)
4. DOM node count (DevTools Elements panel — count the children)

### Step 2 — Measure the DOM cost

Open DevTools → Console:

```js
document.querySelectorAll('[data-list-item]').length
// or check Elements panel — count div children
```

5,000 DOM nodes visible in the DOM tree. Each one:
- Allocated in browser memory
- Participates in layout recalculations
- Gets painted on initial render
- Participates in hit testing on every mouse move

### Step 3 — Implement basic virtualization from scratch

Understand the concept before using a library:

```jsx
function VirtualizedList({ items, itemHeight = 50, windowHeight = 600 }) {
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = items.length * itemHeight;
  const visibleCount = Math.ceil(windowHeight / itemHeight);
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + visibleCount + 2, items.length - 1);
  // +2 for buffer (partial items at edges)

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const offsetY = startIndex * itemHeight; // padding-top to position visible items

  return (
    <div
      style={{ height: windowHeight, overflow: 'auto' }}
      onScroll={e => setScrollTop(e.target.scrollTop)}
    >
      {/* Inner container = full height to enable correct scrollbar */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* Visible items, offset to their correct position */}
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map(item => (
            <div
              key={item.id}
              style={{ height: itemHeight, borderBottom: '1px solid #eee', padding: '10px' }}
            >
              <strong>{item.name}</strong>: {item.description}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

This renders only `visibleCount + 2` items regardless of total list size. Scroll performance is now O(1) with respect to list length.

### Step 4 — Use react-window (production approach)

```bash
npm install react-window
```

```jsx
import { FixedSizeList } from 'react-window';

function RowRenderer({ index, style }) {
  const item = items[index];
  return (
    <div style={style} key={item.id}>
      <strong>{item.name}</strong>: {item.value.toFixed(2)}
    </div>
  );
}

function VirtualList() {
  return (
    <FixedSizeList
      height={600}        // viewport height
      itemCount={5000}    // total items
      itemSize={50}       // row height in px
      width="100%"
    >
      {RowRenderer}
    </FixedSizeList>
  );
}
```

`FixedSizeList` handles scroll tracking, buffer zones, and DOM recycling. Only ~15-20 DOM nodes exist at any time regardless of list size.

### Step 5 — Variable height rows

```jsx
import { VariableSizeList } from 'react-window';

const getItemSize = (index) => {
  // Some rows are taller
  return index % 10 === 0 ? 100 : 50;
};

function VariableList() {
  return (
    <VariableSizeList
      height={600}
      itemCount={5000}
      itemSize={getItemSize}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>Row {index}</div>
      )}
    </VariableSizeList>
  );
}
```

### Step 6 — Combine with React.memo

```jsx
const RowRenderer = React.memo(function RowRenderer({ index, style, data }) {
  const item = data[index];
  console.log(`Row ${index} rendered`);
  return (
    <div style={style}>
      <strong>{item.name}</strong>: ${item.value.toFixed(2)}
    </div>
  );
});

// Pass data via itemData to avoid inline object prop breaking memo
<FixedSizeList
  height={600}
  itemCount={items.length}
  itemSize={50}
  itemData={items}  // passed as 'data' prop to row renderer
>
  {RowRenderer}
</FixedSizeList>
```

---

## What To Observe

- Naive list: 5,000 DOM nodes, slow initial render, sluggish scroll
- Virtualized list: ~20 DOM nodes at all times, fast render, smooth scroll
- Browser memory: significant reduction with virtualization
- React DevTools: Component count dramatically reduced
- React.memo + react-window: visible rows don't rerender on scroll

---

## Internal React Explanation

### Why DOM nodes are expensive

Each DOM node:
- Consumes ~1-2KB of browser memory (style, layout, event handler tables)
- Participates in layout calculation (browser recomputes layout tree on any style change)
- Is painted on initial render (GPU memory for composite layers)
- Is garbage-collected only when removed from DOM

5,000 items × 2KB = ~10MB just for DOM nodes. More importantly, scroll performance requires the browser to check all nodes for pointer events and visibility — this doesn't scale.

### The windowing concept

The key insight: **a 600px container can show at most 12 items (at 50px each)**. Whether you have 50 or 50,000 total items, only 12 need to be in the DOM at once.

Windowing maintains this invariant:
- Keep the scroll container at the correct total height (via a spacer div)
- Only render items that fall within the visible viewport (+ a small buffer)
- As the user scrolls, swap items in and out of the DOM

The visible window "moves" over the data, like a camera panning over a large scene — only the visible area is rendered in detail.

### React-window internals

`react-window` tracks `scrollTop` and computes:

```js
const firstVisibleIndex = Math.floor(scrollTop / itemHeight);
const lastVisibleIndex = firstVisibleIndex + Math.ceil(containerHeight / itemHeight);
// Add overscan (buffer) of ~3-5 items on each side
```

Items outside this range are unmounted. Items entering the range are mounted. Items in the range are updated if their data changes.

This means: constant ~20 DOM nodes regardless of list size. Scroll performance is O(1).

---

## Optimization Challenge

**Challenge 1:** Build a chat window with 10,000 messages. Virtualize it. Add a "scroll to bottom" button that correctly positions the scroll.

**Challenge 2:** Implement infinite scroll with react-window. Load more items when the user scrolls near the end.

```jsx
function onScroll({ scrollOffset, scrollUpdateWasRequested }) {
  const nearBottom = scrollOffset > (items.length * itemHeight - containerHeight - 200);
  if (nearBottom && !loading) loadMore();
}
```

**Challenge 3:** Build a virtualized table (rows AND columns) with `react-window`'s `FixedSizeGrid`.

---

## Why This Optimization Works

Virtualization reduces the problem from "render N items" to "render ~20 items," making the render time constant regardless of dataset size. The browser maintains and reflows only the visible DOM nodes. Memory usage is bounded, not linear.

The result: 5,000 items performs identically to 50 items from the browser's perspective.

---

## Common Mistakes

**Mistake 1: Using virtualization for small lists**

Lists under ~100 items don't need virtualization. The overhead of scroll tracking and position calculation isn't worth it. Only virtualize when you have measurable performance issues from list size.

**Mistake 2: Inline functions in row renderers breaking memo**

```jsx
<FixedSizeList itemData={{ items, onDelete: (id) => {} }}>
```

The `itemData` object is recreated every render → `React.memo` on rows fails. Memoize `itemData` with `useMemo`.

**Mistake 3: Dynamic/unknown item heights with FixedSizeList**

`FixedSizeList` requires all items to have the same height. Use `VariableSizeList` for variable heights — but provide a stable size function that returns the same value for the same index.

**Mistake 4: Missing key on list items**

react-window handles keys internally when using the standard API. If you're implementing custom virtualization, keys must be stable IDs (not index).

**Mistake 5: Accessibility**

Virtualized lists remove items from the DOM, which breaks `aria-setsize`/`aria-posinset` attributes and keyboard navigation. Use `react-virtual` (from TanStack) which has better accessibility support, or manually manage ARIA attributes.

---

## Debugging Tools

### DOM node count

```js
document.querySelectorAll('.row-class').length
// Should stay ~constant while scrolling, not grow with list size
```

### Browser Memory Panel

DevTools → Memory → Heap Snapshot. Compare heap size between naive and virtualized implementations.

### FPS Meter

DevTools → Performance → Record while scrolling. Enable FPS meter in Settings. Should stay at 60fps with virtualization.

---

## Interview Questions

1. What is list virtualization (windowing)?
2. Why is rendering 5,000 DOM nodes slow even if they're off-screen?
3. How does `react-window` know which items to render?
4. What is the difference between `FixedSizeList` and `VariableSizeList`?
5. How many DOM nodes does a virtualized list with 10,000 items have in the DOM?
6. Why must you pass data via `itemData` to maintain `React.memo` compatibility?
7. What is the "overscan" in virtualized lists?
8. What are the accessibility challenges with virtualized lists?
9. When should you NOT use virtualization?
10. How would you implement "scroll to item X" in a virtualized list?

---

## Interview Answers

**1. List virtualization?**
Only rendering the items currently visible in the viewport (plus a small buffer) and unmounting everything else. The scroll container has the full height (via a spacer), but only ~20 DOM nodes exist at any time, regardless of total item count.

**2. Off-screen DOM nodes are slow?**
All DOM nodes consume memory, participate in layout calculations, and affect browser hit testing — even when off-screen. 5,000 nodes cause slow initial render (creating 5,000 nodes), high memory usage, slow layout recalculations, and degraded scroll performance due to large paint areas.

**3. react-window knows what to render?**
It tracks `scrollTop` and computes `firstVisibleIndex = floor(scrollTop / itemHeight)` and `lastVisibleIndex = firstVisibleIndex + ceil(containerHeight / itemHeight)`. It renders items in `[firstVisible - overscan, lastVisible + overscan]` and unmounts the rest.

**4. FixedSizeList vs VariableSizeList?**
`FixedSizeList` requires a constant `itemSize` number — all rows are the same height. Very efficient. `VariableSizeList` accepts a function `itemSize(index)` that returns the height for each index. Requires caching height values for correct scroll position calculation.

**5. DOM nodes in 10k virtualized list?**
Roughly `visibleCount + 2 * overscan`. For a 600px container with 50px rows: ~12 visible + 6 overscan = ~18 DOM nodes. The number is constant regardless of total list size.

**6. itemData for memo compatibility?**
If you pass data inline as a prop to react-window, like `<FixedSizeList itemData={{ items, onDelete }}>`, the object is new on every parent render. `React.memo` on the row component sees a new `data` prop and rerenders. Pass a stable reference (memoize with `useMemo`).

**7. Overscan?**
Extra items rendered beyond the visible viewport edge — typically 3-5 items. Without overscan, fast scrolling causes a "flash of empty" as items aren't rendered fast enough. Overscan pre-renders nearby items to ensure they're ready before they scroll into view.

**8. Accessibility challenges?**
Screen readers rely on the DOM. Virtualized items not in the DOM are invisible to screen readers. `aria-setsize` (total count) and `aria-posinset` (position) can convey list position, but keyboard navigation through all items requires them to be in the DOM. TanStack Virtual has better accessibility handling.

**9. When not to virtualize?**
Lists under ~100-200 items — overhead of virtualization is greater than the benefit. Static content that doesn't need to scroll. Situations where accessibility cannot be compromised. Use case that requires all items to participate in layout.

**10. Scroll to item X?**
react-window's list ref exposes `listRef.current.scrollToItem(index, 'start'|'center'|'end'|'smart')`. This programmatically sets the scroll position to show item X. For custom virtualization, compute `scrollTop = index * itemHeight` and set on the container.

---

## Senior-Level Thinking

**Virtualization is the floor, not the ceiling.**

Virtualization fixes DOM count. But each rendered row still runs a React component. For 20 rows that are each expensive to render, you still have 20 expensive renders per scroll event. Combine with `React.memo` to ensure rows only rerender when their data changes.

**TanStack Virtual as the modern choice.**

`react-window` is stable but unmaintained. `@tanstack/react-virtual` is actively maintained, has better TypeScript support, supports dynamic heights more cleanly, and integrates with TanStack Table for complex data grids.

**The infinite scroll pattern:**

Infinite scroll requires pagination: maintain a `page` or `cursor`, load more items when the user approaches the end. react-window's `onItemsRendered` callback tells you which items are currently visible — trigger load more when `overscanStopIndex` approaches `itemCount`.

---

## Revision Notes

- 5,000 DOM nodes = high memory + slow layout + sluggish scroll
- Virtualization: only render visible items + small buffer
- Total DOM nodes stays ~constant (~20) regardless of list size
- react-window: FixedSizeList (same height) vs VariableSizeList (function)
- itemData must be stable (useMemo) for React.memo on rows to work
- Overscan: buffer beyond visible range to prevent scroll blanks
- When to virtualize: >200-500 items with measurable performance issue

---

## Next Day Preview

**Day 19 — Debounce Search Hook**

Build a `useDebounce` custom hook from scratch. Understand when debouncing is for network requests (API calls) vs `useDeferredValue` for rendering. Apply to a search input that fires API calls.
