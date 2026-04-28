import { useState } from "react";

// Generate once, outside component (stable reference)
const generateItems = (count) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Product ${i + 1}`,
    category: ["Electronics", "Clothing", "Food", "Books", "Sports"][i % 5],
    price: Math.round(Math.random() * 100000) / 100,
    rating: Math.round(Math.random() * 50) / 10,
    inStock: Math.random() > 0.3,
  }));
};

const ALL_ITEMS = generateItems(10000); // stable, generated once

export function ProductSearch() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState("name");
  const [unrelated, setUnrelated] = useState(0); // to trigger rerenders

  console.time("filter+sort");

  // Expensive: runs on EVERY render, including unrelated state changes
  const filtered = ALL_ITEMS.filter((item) => {
    if (category !== "All" && item.category !== category) return false;
    if (item.rating < minRating) return false;
    if (query && !item.name.toLowerCase().includes(query.toLowerCase()))
      return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === "price") return a.price - b.price;
    if (sortBy === "rating") return b.rating - a.rating;
    return a.name.localeCompare(b.name);
  });

  console.timeEnd("filter+sort");

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products..."
      />
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        <option>All</option>
        <option>Electronics</option>
        <option>Clothing</option>
        <option>Food</option>
        <option>Books</option>
        <option>Sports</option>
      </select>
      <input
        type="range"
        min={0}
        max={5}
        step={0.5}
        value={minRating}
        onChange={(e) => setMinRating(Number(e.target.value))}
      />
      <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
        <option value="name">Name</option>
        <option value="price">Price</option>
        <option value="rating">Rating</option>
      </select>
      <button onClick={() => setUnrelated((n) => n + 1)}>
        Unrelated update: {unrelated}
      </button>

      <p>{filtered.length} products found</p>
      <div>
        {filtered.slice(0, 50).map(
          (
            item, // only render first 50
          ) => (
            <ProductCard key={item.id} item={item} />
          ),
        )}
      </div>
    </div>
  );
}

function ProductCard({ item }) {
  return (
    <div style={{ border: '1px solid #eee', padding: '8px 12px', marginBottom: 4, borderRadius: 4 }}>
      <strong>{item.name}</strong> — {item.category}
      <span style={{ marginLeft: 12 }}>${item.price.toFixed(2)}</span>
      <span style={{ marginLeft: 12 }}>⭐ {item.rating}</span>
      <span style={{ marginLeft: 12, color: item.inStock ? 'green' : 'red' }}>
        {item.inStock ? 'In stock' : 'Out of stock'}
      </span>
    </div>
  );
}
