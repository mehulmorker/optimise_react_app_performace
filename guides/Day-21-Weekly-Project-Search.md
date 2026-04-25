# Day 21 — Weekly Project: Product Search App

## Objective

Build a production-quality **Product Search App** that demonstrates every Week 3 performance technique: debounced API calls, `useDeferredValue` for rendering, memoized filtering/sorting, virtualized results, and throttled scroll for infinite loading.

---

## Concepts Applied

- `useDebounce` — control API call frequency
- `useDeferredValue` — keep search input responsive
- `useMemo` — memoize filter + sort computation
- `react-window` — virtualize the results list
- `useScrollPosition` (throttled) OR `IntersectionObserver` — infinite scroll
- `React.memo` — prevent unnecessary row rerenders
- `useCallback` — stable handlers for memo'd children
- `AbortController` — cancel stale API calls

---

## Exercise Task

Build in layers. Don't skip to the end.

---

### Layer 1: Basic search with debounce

```jsx
// hooks/useDebounce.js
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// hooks/useProductSearch.js
export function useProductSearch(query) {
  const debouncedQuery = useDebounce(query, 300);
  const [state, setState] = useState({
    products: [],
    loading: false,
    error: null,
    hasMore: true,
    page: 1,
  });

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setState({ products: [], loading: false, error: null, hasMore: false, page: 1 });
      return;
    }

    const controller = new AbortController();
    setState(s => ({ ...s, loading: true, error: null }));

    fetch(`/api/products?q=${encodeURIComponent(debouncedQuery)}&page=1&limit=50`, {
      signal: controller.signal,
    })
      .then(r => r.json())
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

  const loadMore = useCallback(async () => {
    if (!state.hasMore || state.loading) return;
    const controller = new AbortController();
    setState(s => ({ ...s, loading: true }));

    try {
      const res = await fetch(
        `/api/products?q=${encodeURIComponent(debouncedQuery)}&page=${state.page + 1}&limit=50`,
        { signal: controller.signal }
      );
      const data = await res.json();
      setState(s => ({
        products: [...s.products, ...data.items],
        loading: false,
        error: null,
        hasMore: data.hasMore,
        page: s.page + 1,
      }));
    } catch (err) {
      if (err.name !== 'AbortError') {
        setState(s => ({ ...s, loading: false, error: err.message }));
      }
    }
  }, [debouncedQuery, state.hasMore, state.loading, state.page]);

  return { ...state, loadMore };
}
```

### Layer 2: Client-side filtering and sorting with deferred value

```jsx
// ProductSearch.jsx
function ProductSearch() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState('relevance');
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(10000);

  const { products, loading, error, hasMore, loadMore } = useProductSearch(query);

  // Deferred value for the heavy rendering — input stays snappy
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;

  // Memoized client-side filter + sort
  const filteredProducts = useMemo(() => {
    return products
      .filter(p => {
        if (category !== 'All' && p.category !== category) return false;
        if (p.price < minPrice || p.price > maxPrice) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.price - b.price;
        if (sortBy === 'price-desc') return b.price - a.price;
        if (sortBy === 'rating') return b.rating - a.rating;
        return 0; // relevance: keep API order
      });
  }, [products, category, sortBy, minPrice, maxPrice]);

  return (
    <div className="product-search">
      <SearchBar
        query={query}
        onQueryChange={setQuery}
        category={category}
        onCategoryChange={setCategory}
        sortBy={sortBy}
        onSortChange={setSortBy}
        minPrice={minPrice}
        maxPrice={maxPrice}
        onPriceChange={(min, max) => { setMinPrice(min); setMaxPrice(max); }}
      />

      <div style={{ opacity: isStale ? 0.7 : 1, transition: 'opacity 0.15s' }}>
        <p>
          {loading ? 'Searching...' : `${filteredProducts.length} products`}
          {isStale && ' (filtering...)'}
        </p>
        {error && <p className="error">{error}</p>}
        <ProductList
          products={filteredProducts}
          hasMore={hasMore}
          onLoadMore={loadMore}
        />
      </div>
    </div>
  );
}
```

### Layer 3: Virtualized product list with infinite scroll

```jsx
import { FixedSizeList } from 'react-window';

// Memoize itemData to prevent ProductRow memo from breaking
function ProductList({ products, hasMore, onLoadMore }) {
  const itemData = useMemo(() => ({
    products,
    onLoadMore,
    hasMore,
  }), [products, onLoadMore, hasMore]);

  const handleItemsRendered = useCallback(({ visibleStopIndex }) => {
    // Load more when near the bottom
    if (
      visibleStopIndex >= products.length - 10 &&
      hasMore
    ) {
      onLoadMore();
    }
  }, [products.length, hasMore, onLoadMore]);

  return (
    <FixedSizeList
      height={600}
      itemCount={products.length + (hasMore ? 1 : 0)} // +1 for loading row
      itemSize={80}
      itemData={itemData}
      onItemsRendered={handleItemsRendered}
      width="100%"
    >
      {ProductRow}
    </FixedSizeList>
  );
}

const ProductRow = React.memo(function ProductRow({ index, style, data }) {
  const { products } = data;
  const product = products[index];

  if (!product) {
    return <div style={style}>Loading more...</div>;
  }

  return (
    <div style={{ ...style, display: 'flex', alignItems: 'center', padding: '0 12px', borderBottom: '1px solid #eee' }}>
      <img src={product.thumbnail} alt={product.name} style={{ width: 60, height: 60, objectFit: 'cover' }} />
      <div style={{ marginLeft: 12 }}>
        <strong>{product.name}</strong>
        <p style={{ margin: 0, color: '#666' }}>{product.category}</p>
      </div>
      <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
        <strong>${product.price}</strong>
        <p style={{ margin: 0 }}>⭐ {product.rating}</p>
      </div>
    </div>
  );
});
```

### Layer 4: SearchBar with stable handlers

```jsx
const SearchBar = React.memo(function SearchBar({
  query, onQueryChange,
  category, onCategoryChange,
  sortBy, onSortChange,
}) {
  console.log('SearchBar rendered');

  return (
    <div className="search-bar">
      <input
        value={query}
        onChange={e => onQueryChange(e.target.value)}
        placeholder="Search products..."
        autoFocus
      />
      <select value={category} onChange={e => onCategoryChange(e.target.value)}>
        <option>All</option>
        <option>Electronics</option>
        <option>Clothing</option>
        <option>Books</option>
        <option>Sports</option>
      </select>
      <select value={sortBy} onChange={e => onSortChange(e.target.value)}>
        <option value="relevance">Relevance</option>
        <option value="price-asc">Price: Low to High</option>
        <option value="price-desc">Price: High to Low</option>
        <option value="rating">Rating</option>
      </select>
    </div>
  );
});
```

---

## What To Observe

| Action | Behavior |
|--------|----------|
| Typing query | Input updates immediately (no lag) |
| Pause typing (300ms) | API call fires, results appear |
| Type quickly then pause | Only one API call (debounce) |
| Scroll near bottom | More results load automatically |
| Change filter/sort | Instant client-side re-sort (memoized) |
| Concurrent typing + filter | Input stays responsive (deferred value) |
| Scroll through 500+ items | No DOM growth (virtualized) |

---

## Internal React Explanation

### The data flow architecture

```
User typing
  ↓ query state (immediate)
  ↓ debouncedQuery (300ms delayed) → API fetch → products state
  ↓ filteredProducts (useMemo, from products)
  ↓ deferredQuery (deferred) → drives filtering UI
  ↓ ProductList (virtualized, React.memo rows)
```

Each transformation has the right optimization:
- Input → immediate state (urgent)
- State → API call → debounced (network rate control)
- Products → filtered list → useMemo (avoid recompute on unrelated state)
- Input rendering → deferredValue (stay responsive during filter compute)
- List rendering → virtualized (constant DOM nodes)

---

## Debugging Checklist

Before calling it "complete," verify:

- [ ] Typing "r" then "e" then "a" quickly: console shows only one API call
- [ ] Typing then changing category: zero new API calls (client-side filter)
- [ ] Scroll to bottom: "Loading more..." appears, new results load
- [ ] ProductRow console.log: existing rows don't rerender when new ones load
- [ ] SearchBar render count stays low when typing (useDeferredValue working)
- [ ] Memory tab: DOM node count stays constant while scrolling

---

## Common Mistakes in This Project

**Mistake 1:** Using `deferredQuery` instead of `query` for the API call — API calls should fire based on the actual (debounced) query, not the deferred value  
**Mistake 2:** Creating `itemData` inline in `ProductList` render — breaks `ProductRow.memo`  
**Mistake 3:** Missing `AbortController` cleanup — stale results from slow network responses  
**Mistake 4:** No min-query-length check — API called for single characters (wasteful)  
**Mistake 5:** Not handling `hasMore=false` — load trigger keeps firing after all data loaded  

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
The effect would re-run (and re-fetch) every time a filter changes. `useMemo` runs client-side with the existing data. Filters that don't need server data (price range, category) should never trigger a new API call — they should filter the already-fetched results.

**3. Why memoize itemData?**
`ProductRow` is wrapped in `React.memo`. Its `data` prop is `itemData`. If `itemData` is a new object on every render, `React.memo`'s shallow comparison fails — all visible rows rerender on every product list update. Memoizing `itemData` keeps the reference stable between renders.

**4. onItemsRendered + infinite scroll?**
`react-window` calls `onItemsRendered({ visibleStartIndex, visibleStopIndex, ... })` when the visible range changes. When `visibleStopIndex >= products.length - 10`, the user is near the end. `onLoadMore()` is called, fetching the next page and appending to `products` state.

**5. Race condition handling?**
`useProductSearch` uses `AbortController`. When `debouncedQuery` changes, the `useEffect` cleanup runs `controller.abort()`, cancelling the in-flight request. The new query's effect starts a fresh request. `AbortError` is caught and silently ignored. No stale results can overwrite fresh ones.

---

## Senior-Level Thinking

**This architecture scales.**

The pattern here — debounced fetch → memoized derivations → deferred render → virtualized list — is the same pattern used in enterprise data grids, analytics dashboards, and search platforms. You're not over-engineering — this is production-level thinking.

**When to add React Query to this.**

The custom `useProductSearch` hook works, but React Query would add: automatic caching (same query doesn't refetch for 5 minutes), background refetch on focus, automatic retry on failure, and page/cursor management for infinite scroll. In a real product, evaluate TanStack Query before writing data fetching from scratch.

---

## Revision Notes

- Debounce → API call rate control (network)
- useDeferredValue → rendering priority (UX)
- useMemo → client-side filter/sort (computation)
- react-window → DOM node count (memory)
- IntersectionObserver/onItemsRendered → infinite scroll trigger
- itemData memoized → ProductRow.memo works correctly
- AbortController → no stale/race condition results

---

## Next Day Preview

**Week 4 begins: Day 22 — Context Rerender Optimization**

Context is the most common source of "mystery rerenders" in React apps. When a single context value changes, EVERY consumer rerenders. Learn to split context, memoize values, and know when to reach for a state manager instead.
