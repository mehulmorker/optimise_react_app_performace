import { useEffect, useRef, useState } from "react";

// export function StaleCounter() {
//   const [count, setCount] = useState(0);
// //   const countRef = useRef(count);

//   // Keep ref synchronized with state
//   useEffect(() => {
//   const interval = setInterval(() => {
//     setCount(count + 1); // safe — closure has current count
//   }, 1000);

//   return () => clearInterval(interval); // cleanup old interval
// }, [count]);

//   return <div>Count: {count}</div>;
// }

export function StaleCounter() {
  const [message, setMessage] = useState('Hello');

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Enter') {
        alert(message); // captures message at mount time!
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, [message]); // stale: message changes but handler doesn't update

  return (
    <div>
      <input
        value={message}
        onChange={e => setMessage(e.target.value)}
      />
      <p>Press Enter to alert: {message}</p>
    </div>
  );
}