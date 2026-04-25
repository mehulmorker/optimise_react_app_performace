import { useRef, useState } from "react";

export function RefVsState() {
  const [data, setData] = useState(null);
  const renderCount = useRef(0);
  renderCount.current++; // mutate directly — no rerender triggered

  return (
    <div>
      <p>Render #{renderCount.current}</p>
      <button onClick={() => setData(Math.random())}>Update Data</button>
    </div>
  );
}
