# Day 14 — Weekly Project: Stopwatch App

## Objective

Build a complete, production-quality **Stopwatch App** that applies every concept from Week 2: state batching, refs for timer IDs, proper effect cleanup, stale closure avoidance with functional updates, and correct handling of async timing.

---

## Concepts Applied

- `useRef` for interval ID (no rerender needed)
- `useRef` for start timestamp (precise timing)
- Functional state updates (avoid stale closures)
- Effect cleanup (clear interval on unmount)
- State batching (update elapsed + running in one render)
- `useCallback` for stable handlers
- `React.memo` on lap list items

---

## Exercise Task

Build in progressive layers. Don't jump to the final version.

---

### Layer 1: Basic start/stop counter

```jsx
function Stopwatch() {
  const [elapsed, setElapsed] = useState(0); // milliseconds
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  const start = () => {
    if (running) return;
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setElapsed(e => e + 10); // functional update — no stale closure
    }, 10);
  };

  const stop = () => {
    if (!running) return;
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRunning(false);
  };

  const reset = () => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRunning(false);
    setElapsed(0);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <div>
      <Display elapsed={elapsed} />
      <button onClick={start} disabled={running}>Start</button>
      <button onClick={stop} disabled={!running}>Stop</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}

const Display = React.memo(function Display({ elapsed }) {
  const ms = elapsed % 1000;
  const s = Math.floor(elapsed / 1000) % 60;
  const m = Math.floor(elapsed / 60000);
  return (
    <div>
      {String(m).padStart(2, '0')}:
      {String(s).padStart(2, '0')}.
      {String(ms).padStart(3, '0')}
    </div>
  );
});
```

Verify: start/stop works. Reset clears. No stale closure (increment is always correct).

---

### Layer 2: Add lap functionality

```jsx
function Stopwatch() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState([]);
  const intervalRef = useRef(null);
  const lapStartRef = useRef(0); // track where this lap started

  const start = () => {
    if (running) return;
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setElapsed(e => e + 10);
    }, 10);
  };

  const stop = () => {
    if (!running) return;
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRunning(false);
  };

  const lap = () => {
    setLaps(prev => {
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
        <button onClick={start} disabled={running}>Start</button>
        <button onClick={stop} disabled={!running}>Stop</button>
        <button onClick={lap} disabled={!running}>Lap</button>
        <button onClick={reset}>Reset</button>
      </div>
      <LapList laps={laps} />
    </div>
  );
}
```

### Layer 3: Lap list component with memo

```jsx
const LapList = React.memo(function LapList({ laps }) {
  console.log('LapList rendered');

  if (laps.length === 0) return null;

  const fastest = Math.min(...laps.map(l => l.time));
  const slowest = Math.max(...laps.map(l => l.time));

  return (
    <div>
      {[...laps].reverse().map(lap => (
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
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(mil).padStart(3, '0')}`;
  };

  return (
    <div style={{
      color: isFastest ? 'green' : isSlowest ? 'red' : 'inherit'
    }}>
      <span>Lap {lap.id}</span>
      <span>{formatTime(lap.time)}</span>
      <span>{formatTime(lap.total)}</span>
    </div>
  );
});
```

---

### Layer 4: Precise timing with performance.now()

The `setInterval(fn, 10)` approach has drift — browser throttles timers, tabs deprioritize background intervals. For more accuracy:

```jsx
function Stopwatch() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const startTimeRef = useRef(0);   // when start was pressed
  const baseElapsedRef = useRef(0); // elapsed before last start
  const rafRef = useRef(null);      // requestAnimationFrame ID

  const tick = useCallback(() => {
    const now = performance.now();
    setElapsed(baseElapsedRef.current + (now - startTimeRef.current));
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(() => {
    if (running) return;
    startTimeRef.current = performance.now();
    setRunning(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [running, tick]);

  const stop = useCallback(() => {
    if (!running) return;
    cancelAnimationFrame(rafRef.current);
    baseElapsedRef.current = elapsed;
    setRunning(false);
  }, [running, elapsed]);

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ... render
}
```

`performance.now()` gives microsecond-precision timestamps. `requestAnimationFrame` syncs updates with the browser's repaint cycle (60fps) — no faster than useful for display, no drift.

---

## What To Observe

- Interval ID in ref: start/stop don't cause extra rerenders
- Functional update for elapsed: no stale closure, always increments correctly
- Multiple setRunning + setElapsed in reset = one render (batching)
- useEffect cleanup: clearInterval on unmount prevents dangling timer
- LapItem React.memo: existing laps don't rerender when a new lap is added
- lapStartRef: tracks lap start time without causing rerenders

---

## Internal React Explanation

### Why setInterval(10) drifts

Browsers throttle `setInterval` in background tabs (minimum 1000ms). In foreground, there's still ~1-2ms jitter per tick. Over a 10-minute session, this accumulates to several seconds of drift.

`performance.now()` measures wall clock time. `requestAnimationFrame` fires at the browser's repaint rate (60fps = 16ms intervals). The displayed time is always `now - startTime` — accurate to the millisecond regardless of timer jitter.

### Batching in reset()

```jsx
const reset = () => {
  clearInterval(intervalRef.current);  // no render
  intervalRef.current = null;          // no render
  setRunning(false);  // batched
  setElapsed(0);      // batched
  setLaps([]);        // batched
  lapStartRef.current = 0;             // no render
};
```

Three `setState` calls in one event handler → one render (React 18 automatic batching).

---

## Debugging Checklist

- [ ] Start then immediately unmount component — no interval should still run
- [ ] Rapid start/stop: no double-intervals started
- [ ] Lap button while running: correct lap time shown
- [ ] LapItem memo: adding a new lap doesn't rerender old lap items
- [ ] Reset while running: timer stopped, display shows 00:00.000
- [ ] React DevTools Profiler: verify single renders for batched operations

---

## Common Mistakes in This Project

**Mistake 1:** `setElapsed(elapsed + 10)` instead of `setElapsed(e => e + 10)` — stale closure, count stuck  
**Mistake 2:** Storing interval ID in state — extra rerenders on start/stop  
**Mistake 3:** No cleanup in useEffect — interval runs after unmount  
**Mistake 4:** `setRunning` + `setElapsed` separately in `reset` — causes two renders instead of one  
**Mistake 5:** Missing `key` on lap items — wrong animations on lap reorder  

---

## Interview Questions

1. Why is `setElapsed(e => e + 10)` necessary instead of `setElapsed(elapsed + 10)`?
2. Why store the interval ID in a ref rather than state?
3. How does `useEffect` cleanup prevent memory leaks in this project?
4. What is the advantage of `requestAnimationFrame` over `setInterval` for timing?
5. Why do the three `setState` calls in `reset()` cause only one render?

---

## Interview Answers

**1. Functional update necessity?**
The interval callback is created once and holds a stale closure where `elapsed = 0`. Using `elapsed + 10` would always add to 0. Functional update `e => e + 10` receives the actual current state at call time, bypassing the closure.

**2. Interval ID in ref?**
The interval ID doesn't need to cause a rerender — it's an implementation detail for cleanup. Storing in state would cause an extra render on start (when ID is assigned) and stop (when set to null). Ref stores it silently.

**3. Cleanup prevents memory leaks?**
Without cleanup, the interval keeps running after the component unmounts. Every 10ms it calls `setElapsed` on a component that no longer exists, trying to update dead state. The effect cleanup runs on unmount, calling `clearInterval` to stop the timer.

**4. requestAnimationFrame advantage?**
`setInterval(fn, 10)` has browser-imposed minimum intervals and drift in background tabs. `requestAnimationFrame` syncs with the browser's repaint cycle (60fps), fires reliably, and can be canceled exactly. Combined with `performance.now()` for absolute time measurement, it gives accurate elapsed time regardless of frame rate.

**5. Three setStates = one render?**
React 18 automatic batching collects all `setState` calls within the same event handler and flushes them in one render pass. All three updates are applied simultaneously — no intermediate states.

---

## Senior-Level Thinking

**The stopwatch demonstrates why refs exist.**

Every timer ID, animation frame ID, and timeout ID you'll ever use in React belongs in a ref. These are all implementation details — plumbing that manages the timer but has no UI representation. State is for data that drives the UI. Keeping the distinction sharp keeps component code clean.

**Precision matters in production.**

A stopwatch built with `setInterval(fn, 10)` will drift visibly over minutes. In a real product (fitness app, quiz timer, trading platform), this kind of drift is a bug. Always use `performance.now()` for time calculations and use state only for the computed display value.

---

## Revision Notes

- Interval ID → ref (no rerender needed)
- Elapsed time → state (drives display)
- Functional update for elapsed → no stale closure
- reset(): multiple setStates batch into one render
- useEffect cleanup: clearInterval on unmount
- lapStartRef: tracks lap start time without state
- requestAnimationFrame + performance.now() = accurate, drift-free timing

---

## Next Day Preview

**Week 3 begins: Day 15 — Expensive Filtering**

The first Week 3 topic: what happens when you filter/sort 10,000 items on every render. How `useMemo` fixes it. How to build a laggy UI deliberately and then fix it. Introduction to measuring UI responsiveness.
