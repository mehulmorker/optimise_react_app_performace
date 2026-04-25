import React, { useEffect, useRef, useState } from "react";

function StopWatchPro() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState([]);
  const intervalRef = useRef(null);
  const lapStartRef = useRef(0);

  const start = () => {
    if (running) return;
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setElapsed((e) => e + 10);
    }, 10);
  };

  const stop = () => {
    if (!running) return;
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRunning(false);
  };

  const lap = () => {
    setLaps((prev) => {
      const lapTime = elapsed - lapStartRef.current;
      lapStartRef.current = elapsed;
      return [...prev, { id: prev.length + 1, time: lapTime, total: elapsed }];
    });
  };

  const reset = () => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRunning(false);
    setElapsed(0);
    setLaps([]);
    lapStartRef.current = 0;
  };

  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <div>
      <Display elapsed={elapsed} />
      <div>
        <button onClick={start} disabled={running}>
          Start
        </button>
        <button onClick={stop} disabled={!running}>
          Stop
        </button>
        <button onClick={lap} disabled={!running}>
          Lap
        </button>
        <button onClick={reset}>Reset</button>
      </div>
      <LapList laps={laps} />
    </div>
  );
}

const Display = React.memo(function Display({ elapsed }) {
  const ms = elapsed % 1000;
  const s = Math.floor(elapsed / 1000) % 60;
  const m = Math.floor(elapsed / 60000);
  console.log(ms, s, m);
  return (
    <div>
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}.
      {String(ms).padStart(3, "0")}
    </div>
  );
});

const LapList = React.memo(function LapList({ laps }) {
  console.log("LapList rendered");

  if (laps.length === 0) return null;

  const fastest = Math.min(...laps.map((l) => l.time));
  const slowest = Math.max(...laps.map((l) => l.time));

  return (
    <div>
      {[...laps].reverse().map((lap) => (
        <LapItem
          key={lap.id}
          lap={lap}
          isFastest={lap.time === fastest}
          isSlowest={lap.time === slowest}
        />
      ))}
    </div>
  );
});

const LapItem = React.memo(function LapItem({ lap, isFastest, isSlowest }) {
  console.log(`LapItem rendered: lap ${lap.id}`);

  const formatTime = (ms) => {
    const s = Math.floor(ms / 1000) % 60;
    const m = Math.floor(ms / 60000);
    const mil = ms % 1000;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(mil).padStart(3, "0")}`;
  };

  return (
    <div
      style={{
        color: isFastest ? "green" : isSlowest ? "red" : "inherit",
      }}
    >
      <span>Lap {lap.id}</span>
      <span>{formatTime(lap.time)}</span>
      <span>{formatTime(lap.total)}</span>
    </div>
  );
});
export default StopWatchPro;
