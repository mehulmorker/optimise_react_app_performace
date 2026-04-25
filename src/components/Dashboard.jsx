import React, { useMemo, useState } from "react";

export function Dashboard() {
  const [theme, setTheme] = useState("light");
  const [unrelated, setUnrelated] = useState(0);

  //   const config = { theme, maxItems: 10 }; // new object every render

  const config = useMemo(
    () => ({
      theme,
      maxItems: 10,
    }),
    [theme],
  ); // only recreate when theme changes

  return (
    <div>
      <button onClick={() => setUnrelated((n) => n + 1)}>
        Unrelated update: {unrelated}
      </button>
      <button
        onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
      >
        Toggle theme
      </button>
      <ProductGrid config={config} />
    </div>
  );
}

const ProductGrid = React.memo(function ProductGrid({ config }) {
  console.log("ProductGrid rendered, theme:", config.theme);
  return <div>Grid: {config.theme}</div>;
});
