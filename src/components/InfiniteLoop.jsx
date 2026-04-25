// import { useCallback, useEffect, useState } from "react";

// export function InfiniteLoop1() {
//   const [count, setCount] = useState(0);

//   useEffect(() => {
//     if (count < 250000) setCount(count + 1); // state update → rerender → effect runs → state update → ...
//   }); // no dependency array!

//   return <div>{count}</div>;
// }

// export function InfiniteLoop1() {
//   const [data, setData] = useState(null);

//   useEffect(() => {
//     fetch('https://jsonplaceholder.typicode.com/todos')
//       .then(r => r.json())
//       .then(json => setData(json)); // setData → rerender → data changes → effect reruns
//   }, [data]); // data is dep, effect updates data

//   return <div>{JSON.stringify(data)}</div>;
// }

// export function InfiniteLoop1() {
//   const [data, setData] = useState(null);
//   const [id, setID] = useState(1);

//   const fetchTodos = useCallback(() => {
//     // new function every render
//     return fetch(`https://jsonplaceholder.typicode.com/todos/${id}`).then((r) =>
//       r.json(),
//     );
//   },[id]);

//   useEffect(() => {
//     fetchTodos().then((json) => setData(json)); // setData → rerender → data changes → effect reruns
//   }, [fetchTodos]); // data is dep, effect updates data

//   return <div>{JSON.stringify(data)}</div>;
// }


