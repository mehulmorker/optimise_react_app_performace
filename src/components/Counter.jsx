import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);

  console.log("Counter rendered, count:", count);

//   const incrementTwice = () => {
//     setCount(count + 1); // count is 0 here
//     setCount(count + 1); // count is still 0 here!
//     console.log("count", count);
//   };

  const incrementTwiceFunctional = () => {
    setCount((c) => c + 1); // c is latest state: 0, result: 1
    setCount((c) => c + 1); // c is latest queued state: 1, result: 2
  };

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={incrementTwiceFunctional}>+2 (broken)</button>
    </div>
  );
}
