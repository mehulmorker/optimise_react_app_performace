# Day 21 — Weekly Project: Product Search App

## Objective

Build a production-quality **Product Search App** that demonstrates every Week 3 performance technique: debounced search, `useDeferredValue` for rendering, memoized filtering/sorting, virtualized results, and infinite scroll.

---

## Concepts Applied

- `useDebounce` — rate-limit the search input (for API calls in production; simulated here)
- `useDeferredValue` — keep search input responsive while filter/sort rerenders happen
- `useMemo` — memoize filter + sort computation
- `react-window` — virtualize the results list
- `React.memo` — prevent unnecessary row rerenders
- `useCallback` — stable handlers for memo'd children
- `AbortController` — cancel stale requests

---

## Exercise Task

Build in layers. Verify each layer before moving to the next.

> **Note on the API:** This project uses a mock fetch that simulates network delay with local data. In a real app, replace `mockFetch` with your actual API endpoint. All debounce and AbortController patterns apply identically.

---

### Setup — shared data and mock API

Create `src/components/ProductSearchApp.jsx`. Add this at the top:

```jsx
import React, {
  useState, useEffect, useMemo, useCallback,
  useDeferredValue, useRef
} from 'react';
import { FixedSizeList } from 'react-window';

// 10,000 products — module-level so they're never recreated
const ALL_PRODUCTS = Array.from({ length: 10000 }, (_, i) => ({
  id: i + 1,
  name: `Product ${i + 1}`,
  category: ['Electronics', 'Clothing', 'Food', 'Books', 'Sports'][i % 5],
  price: Math.round(Math.random() * 100000) / 100,
  rating: Math.round(Math.random() * 50) / 10,
  inStock: Math.random() > 0.3,
}));

// Simulate API: filters by query server-side, returns paginated results
function mockFetch(query, page, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const filtered = ALL_PRODUCTS.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.category.toLowerCase().includes(query.toLowerCase())
      );
      const limit = 100;
      const start = (page - 1) * limit;
      resolve({
        items: filtered.slice(start, start + limit),
        hasMore: start + limit < filtered.length,
        total: filtered.length,
      });
    }, 300);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}
```

---

### Layer 1: useDebounce hook

```jsx
function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}
```

---

### Layer 2: useProductSearch hook

This hook owns all data-fetching logic. It exposes clean state to the UI layer.

```jsx
function useProductSearch(query) {
  const debouncedQuery = useDebounce(query, 300);
  const [state, setState] = useState({
    products: [],
    loading: false,
    error: null,
    hasMore: false,
    page: 1,
  });

  // Fetch page 1 whenever debouncedQuery changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setState({ products: [], loading: false, error: null, hasMore: false, page: 1 });
      return;
    }

    const controller = new AbortController();
    setState(s => ({ ...s, loading: true, error: null }));

    mockFetch(debouncedQuery, 1, controller.signal)
      .then(data => setState({
        products: data.items,
        loading: false,
        error: null,
        hasMore: data.hasMore,
        page: 1,
      }))
      .catch(err => {
        if (err.name === 'AbortError') return;
        setState(s => ({ ...s, loading: false, error: err.message }));
      });

    return () => controller.abort();
  }, [debouncedQuery]);

  // Load the next page
  const loadMore = useCallback(() => {
    if (state.loading || !state.hasMore) return;
    const nextPage = state.page + 1;
    const controller = new AbortController();
    setState(s => ({ ...s, loading: true }));

    mockFetch(debouncedQuery, nextPage, controller.signal)
      .then(data => setState(s => ({
        products: [...s.products, ...data.items],
        loading: false,
        error: null,
        hasMore: data.hasMore,
        page: nextPage,
      })))
      .catch(err => {
        if (err.name !== 'AbortError') {
          setState(s => ({ ...s, loading: false, error: err.message }));
        }
      });
  }, [debouncedQuery, state.loading, state.hasMore, state.page]);

  return { ...state, loadMore };
}
```

---

### Layer 3: ProductSearch — main component

```jsx
export function ProductSearch() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState('name');

  const { products, loading, error, hasMore, loadMore } = useProductSearch(query);

  // useDeferredValue defers the expensive filter+sort render
  // so typing in the input stays instant even while filtering 1000s of results
  const deferredCategory = useDeferredValue(category);
  const deferredSortBy = useDeferredValue(sortBy);
  const isStale = category !== deferredCategory || sortBy !== deferredSortBy;

  // memoized client-side filter + sort — only reruns when deps change
  const filteredProducts = useMemo(() => {
    return products
      .filter(p => deferredCategory === 'All' || p.category === deferredCategory)
      .sort((a, b) => {
        if (deferredSortBy === 'price') return a.price - b.price;
        if (deferredSortBy === 'rating') return b.rating - a.rating;
        return a.name.localeCompare(b.name);
      });
  }, [products, deferredCategory, deferredSortBy]);

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <SearchBar
        query={query}
        onQueryChange={setQuery}
        category={category}
        onCategoryChange={setCategory}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      <div style={{ opacity: isStale ? 0.7 : 1, transition: 'opacity 0.15s' }}>
        {loading && <p>Searching...</p>}
        {error && <p style={{ color: 'red' }}>Error: {error}</p>}
        {!loading && !error && (
          <p style={{ margin: '8px 0' }}>
            {filteredProducts.length} products
            {isStale && ' (filtering...)'}
          </p>
        )}
        <ProductList
          products={filteredProducts}
          hasMore={hasMore}
          loading={loading}
          onLoadMore={loadMore}
        />
      </div>
    </div>
  );
}
```

> **Why `useDeferredValue` on `category` and `sortBy` (not on `query`)?** The expensive operation here is the client-side `filter + sort` on potentially thousands of products. Deferring `category` and `sortBy` means: when the user changes a dropdown, the input/controls update immediately (urgent), and the heavy filter/sort rerenders at low priority. Deferring `query` itself would only help if it drove rendering directly — here `query` drives the API call (via debounce), not the filter.

---

### Layer 4: SearchBar

```jsx
const SearchBar = React.memo(function SearchBar({
  query, onQueryChange,
  category, onCategoryChange,
  sortBy, onSortChange,
}) {
  console.log('SearchBar rendered');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
      <input
        value={query}
        onChange={e => onQueryChange(e.target.value)}
        placeholder="Search products..."
        style={{ padding: '8px 12px', fontSize: 16 }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={category} onChange={e => onCategoryChange(e.target.value)}>
          <option>All</option>
          <option>Electronics</option>
          <option>Clothing</option>
          <option>Food</option>
          <option>Books</option>
          <option>Sports</option>
        </select>
        <select value={sortBy} onChange={e => onSortChange(e.target.value)}>
          <option value="name">Name</option>
          <option value="price">Price</option>
          <option value="rating">Rating</option>
        </select>
      </div>
    </div>
  );
});
```

---

### Layer 5: Virtualized ProductList with infinite scroll

```jsx
// Memoize itemData — if this is a new object every render, ProductRow.memo breaks
function ProductList({ products, hasMore, loading, onLoadMore }) {
  const itemData = useMemo(() => ({ products, hasMore, loading }), [products, hasMore, loading]);

  const handleItemsRendered = useCallback(({ visibleStopIndex }) => {
    if (visibleStopIndex >= products.length - 10 && hasMore && !loading) {
      onLoadMore();
    }
  }, [products.length, hasMore, loading, onLoadMore]);

  const itemCount = products.length + (hasMore ? 1 : 0);

  return (
    <FixedSizeList
      height={500}
      itemCount={itemCount}
      itemSize={60}
      itemData={itemData}
      onItemsRendered={handleItemsRendered}
      width="100%"
    >
      {ProductRow}
    </FixedSizeList>
  );
}

const ProductRow = React.memo(function ProductRow({ index, style, data }) {
  const { products, hasMore, loading } = data;
  const product = products[index];

  if (!product) {
    return (
      <div style={{ ...style, display: 'flex', alignItems: 'center', padding: '0 12px', color: '#888' }}>
        {loading ? 'Loading more...' : hasMore ? '' : 'All results loaded'}
      </div>
    );
  }

  return (
    <div style={{
      ...style,
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      borderBottom: '1px solid #eee',
    }}>
      <div style={{ flex: 1 }}>
        <strong>{product.name}</strong>
        <span style={{ marginLeft: 8, color: '#666', fontSize: 13 }}>{product.category}</span>
      </div>
      <span style={{ marginLeft: 'auto' }}>${product.price.toFixed(2)}</span>
      <span style={{ marginLeft: 12 }}>⭐ {product.rating}</span>
      <span style={{ marginLeft: 12, color: product.inStock ? 'green' : 'red', fontSize: 12 }}>
        {product.inStock ? 'In stock' : 'Out of stock'}
      </span>
    </div>
  );
});
```

---

## What To Observe

| Action | Expected behavior |
|--------|------------------|
| Typing query | Input updates immediately (no lag) |
| Pause typing (300ms) | API call fires, results appear |
| Type quickly then pause | Only one API call (debounce working) |
| Change category/sort | Controls update instantly; list re-sorts (deferred) |
| Scroll to bottom | More results load automatically (infinite scroll) |
| Scroll through 1000+ items | DOM node count stays ~20 (virtualization) |

---

## Debugging Checklist

Before calling it complete, verify:

- [ ] Type "r", "e", "a" quickly: console shows only one API call after pause
- [ ] Change category while typing: zero new API calls (client-side filter)
- [ ] Scroll to bottom: new results load and append
- [ ] ProductRow console.log: existing rows don't rerender when new ones load
- [ ] Memory tab: DOM node count stays constant while scrolling

---

## Data Flow Architecture

```
User typing
  ↓ query state (immediate)
  ↓ debouncedQuery (300ms delayed) → mockFetch → products state
  ↓ filteredProducts (useMemo, from products + deferredCategory + deferredSortBy)
  ↓ ProductList (virtualized, React.memo rows)

User changes category/sort
  ↓ category/sortBy state (immediate — controls update)
  ↓ deferredCategory/deferredSortBy (deferred — filter/sort rerenders at low priority)
```

Each transformation has the right optimization:
- Input → immediate state (urgent)
- State → API call → debounced (network rate control)
- Products → filtered/sorted list → useMemo (avoid recompute on unrelated state)
- Category/sort → deferredValue (stay responsive during filter compute)
- List rendering → virtualized (constant DOM nodes)

---

## Common Mistakes in This Project

**Mistake 1:** Using `deferredQuery` to drive the API call — API calls should fire based on the debounced query, not the deferred value. `useDeferredValue` is for rendering, not network calls.

**Mistake 2:** Creating `itemData` inline in `ProductList` render — recreated every render, breaks `ProductRow.memo`.

**Mistake 3:** Missing `AbortController` cleanup — stale results from slow responses overwrite fresh ones.

**Mistake 4:** No min-query-length check — API called for every single character (consider requiring 2+).

**Mistake 5:** Not handling `hasMore=false` — load trigger keeps firing after all data is loaded.

---

## Interview Questions

1. Why do we use `useDebounce` for API calls and `useDeferredValue` for rendering — can't we just use one?
2. What would happen if we put the filter/sort inside the API call effect instead of `useMemo`?
3. Why must `itemData` be memoized in the virtualized list?
4. How does `onItemsRendered` enable infinite scroll?
5. What's the race condition risk and how does this app handle it?

---

## Interview Answers

**1. Debounce + useDeferredValue — can't use one?**
They solve different problems. Debounce controls network call frequency — you can't use `useDeferredValue` for that, it's a rendering concept. `useDeferredValue` keeps the UI responsive during expensive renders — you can't use debounce for that, debounce always adds fixed latency. For a search with both an API + heavy rendering, you need both.

**2. Filter inside effect instead of useMemo?**
The effect would re-run (and re-fetch) every time a filter changes. `useMemo` runs client-side with the existing data. Filters that don't need server data (category, sort order) should never trigger a new API call — they should filter the already-fetched results.

**3. Why memoize itemData?**
`ProductRow` is wrapped in `React.memo`. Its `data` prop is `itemData`. If `itemData` is a new object on every render, `React.memo`'s shallow comparison fails — all visible rows rerender on every product list update. Memoizing `itemData` keeps the reference stable.

**4. onItemsRendered + infinite scroll?**
`react-window` calls `onItemsRendered({ visibleStopIndex })` when the visible range changes. When `visibleStopIndex >= products.length - 10`, the user is near the end. `onLoadMore()` is called, fetching the next page and appending to `products` state.

**5. Race condition handling?**
`useProductSearch` uses `AbortController`. When `debouncedQuery` changes, the `useEffect` cleanup runs `controller.abort()`, cancelling the in-flight request. The new query's effect starts a fresh request. `AbortError` is caught and silently ignored.

---

## Revision Notes

- Debounce → API call rate control (network)
- useDeferredValue → rendering priority (defer filter/sort rerenders, not the query itself)
- useMemo → client-side filter/sort (computation)
- react-window → DOM node count (memory)
- onItemsRendered → infinite scroll trigger
- itemData memoized → ProductRow.memo works correctly
- AbortController → no stale/race condition results

---

## Next Day Preview

**Week 4 begins: Day 22 — Context Rerender Optimization**

Context is the most common source of "mystery rerenders" in React apps. When a single context value changes, EVERY consumer rerenders. Learn to split context, memoize values, and know when to reach for a state manager instead.
