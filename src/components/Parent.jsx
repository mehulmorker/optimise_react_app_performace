import React, { useEffect, useRef, useState } from "react";

function Parent() {
  useRenderCount("Parent");

  console.log("Parent rendered");
  const [count, setCount] = useState(0);

  return (
    <div>
      <h2>Parent Count: {count}</h2>
      <button onClick={() => setCount((c) => c + 1)}>Increment</button>
      {/* children go here */}
      <ChildA count={count} />
      <ChildB />
      <ChildC />
    </div>
  );
}

function ChildA({ count }) {
  console.log("ChildA rendered");
  return <div>Child A: {count}</div>;
}

const ChildB = React.memo(function ChildB() {
  console.log("ChildB rendered");
  return <div>Child B</div>;
});

const ChildC = React.memo(function ChildC() {
  console.log("ChildC rendered");
  return <div>Child C</div>;
});

function useRenderCount(name) {
  const count = useRef(0);

  useEffect(() => {
    count.current++;
    console.log(`${name}: ${count.current}`);
  });
}

Parent.whyDidYouRender = true
export default Parent