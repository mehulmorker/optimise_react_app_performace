
import { useRef, useState } from "react";

export function Stopwatch() {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef(null); // store interval ID — doesn't need to trigger rerenders

  const start = () => {
    if (intervalRef.current) return; // prevent double-start
    intervalRef.current = setInterval(() => {
      setElapsed(e => e + 10);
    }, 10);
  };

  const stop = () => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  const reset = () => {
    stop();
    setElapsed(0);
  };

  return (
    <div>
      <p>{(elapsed / 1000).toFixed(2)}s</p>
      <button onClick={start}>Start</button>
      <button onClick={stop}>Stop</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}
