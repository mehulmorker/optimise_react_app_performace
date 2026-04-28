import React, { useState, useMemo, useDeferredValue, useEffect } from 'react';

// Generate 10,000 items once — stable reference, never re-created
const generateItems = (count) =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Product ${i + 1}`,
    price: Math.round(Math.random() * 100000) / 100,
    rating: Math.round(Math.random() * 50) / 10,
  }));

const ALL_ITEMS = generateItems(10000);

// Plain version — no memo. Re-renders on every parent render.
const HeavyList = React.memo(function HeavyList({ items }) {
  console.log('HeavyList rendered:', items.length);
  return (
    <ul>
      {items.slice(0, 200).map(item => (
        <HeavyItem key={item.id} item={item} />
      ))}
    </ul>
  );
});

function HeavyItem({ item }) {
  slowOperation(); // simulate expensive render per item
  return <li>{item.name} — ${item.price} — ⭐{item.rating}</li>;
}

// Simulates CPU work per item — does not use item intentionally
function slowOperation() {
  let result = 0;
  for (let i = 0; i < 500000; i++) result += i;
  return result;
}

export function SearchWithLag() {
  const [query, setQuery] = useState('');

  const results = useMemo(() =>
    ALL_ITEMS.filter(item =>
      item.name.toLowerCase().includes(query.toLowerCase())
    ),
  [query]);

  return (
    <div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search 10k items..."
      />
      <p>{results.length} results</p>
      <HeavyList items={results} />
    </div>
  );
}

export function SearchOptimized() {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query); // lags behind query

  
  // ADD THIS — logs on every render
  console.log(`query="${query}", deferredQuery="${deferredQuery}"`);

  const isStale = query !== deferredQuery;

  const results = useMemo(() => {
    // ADD THIS — logs only when deferredQuery changes
    console.log(`Computing results for: "${deferredQuery}"`);
    return ALL_ITEMS.filter(item =>
      item.name.toLowerCase().includes(deferredQuery.toLowerCase())
    );
  }, [deferredQuery]);

  return (
    <div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search 10k items..."
      />
      <p style={{ opacity: isStale ? 0.5 : 1 }}>
        {results.length} results
        {isStale && ' (updating...)'}
      </p>
      <div style={{ opacity: isStale ? 0.7 : 1 }}>
        <HeavyList items={results} />
      </div>
    </div>
  );
}

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function SearchDebounced() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const results = useMemo(() =>
    ALL_ITEMS.filter(item =>
      item.name.toLowerCase().includes(debouncedQuery.toLowerCase())
    ),
  [debouncedQuery]);

  return (
    <div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search 10k items..."
      />
      <p>{results.length} results</p>
      <HeavyList items={results} />
    </div>
  );
}