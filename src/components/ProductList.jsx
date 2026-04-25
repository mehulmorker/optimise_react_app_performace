import React, { useCallback, useState } from "react";

export function ProductList() {
  const [discount, setDiscount] = useState(0);
  const products = ["Shoes", "Hat", "Bag", "Watch", "Belt"];

  const handleClick = useCallback((name) => {
    console.log(name);
  }, []);

  return (
    <div>
      <button onClick={() => setDiscount((d) => d + 5)}>
        Apply Discount: {discount}%
      </button>
      {products.map((name) => (
        <ProductCard key={name} name={name} onClick={handleClick} />
      ))}
    </div>
  );
}

const ProductCard = React.memo(function ProductCard({ name }) {
  console.log(`ProductCard rendered: ${name}`);
  return <div>{name}</div>;
});
