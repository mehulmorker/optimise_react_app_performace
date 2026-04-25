# Day 25 — State Locality

## Objective

Master the most impactful React architecture principle: keep state as close as possible to where it's used. Lifting state too high causes cascade rerenders that `React.memo` and `useCallback` can only patch over. Moving state down is the architectural fix that makes optimization unnecessary.

---

## Real World Importance

- App-level count state that causes the entire UI to rerender on every increment
- Modal open/close state that lives in the app root
- Search query state that lives three levels above the search component
- Form field state that lives in a parent page component
- Hover/focus states stored globally

---

## Concepts Covered

- State locality: place state where it's used
- Lifting state too high: how it causes cascade rerenders
- Moving state down: the architectural refactor
- The "children as prop" composition pattern (avoiding context)
- Colocating related state with its component
- When lifting state IS correct (genuinely shared state)

---

## Exercise Task

### Step 1 — The "state too high" problem

```jsx
function App() {
  const [count, setCount] = useState(0); // ← lives at App level
  const [username, setUsername] = useState('Alice');
  const [theme, setTheme] = useState('light');

  console.log('App rendered'); // renders on EVERY count change

  return (
    <div>
      <Header username={username} theme={theme} /> {/* rerenders on count change! */}
      <Sidebar />
      <MainContent />
      <Counter count={count} onIncrement={() => setCount(c => c + 1)} />
    </div>
  );
}

function Header({ username, theme }) {
  console.log('Header rendered'); // rerenders on count change — has nothing to do with count!
  return <header>{username} - {theme}</header>;
}

function Counter({ count, onIncrement }) {
  return (
    <div>
      <p>{count}</p>
      <button onClick={onIncrement}>+</button>
    </div>
  );
}
```

Click increment. `App`, `Header`, `Sidebar`, `MainContent` all rerender — even though only `Counter` cares about `count`.

### Step 2 — Move state down to Counter

```jsx
function Counter() {
  const [count, setCount] = useState(0); // ← moved into Counter

  console.log('Counter rendered');

  return (
    <div>
      <p>{count}</p>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  );
}

function App() {
  const [username, setUsername] = useState('Alice');
  const [theme, setTheme] = useState('light');

  console.log('App rendered'); // no longer rerenders on count change

  return (
    <div>
      <Header username={username} theme={theme} />
      <Sidebar />
      <MainContent />
      <Counter /> {/* manages its own count state */}
    </div>
  );
}
```

Click increment. ONLY `Counter` rerenders. `App`, `Header`, `Sidebar`, `MainContent` are completely unaffected. No memo, no useCallback needed.

### Step 3 — The real-world form example

```jsx
// BAD: Form state in the page
function ProductPage() {
  const [product, setProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState(''); // ← used only in search
  const [filterCategory, setFilterCategory] = useState('All'); // ← used only in filter

  // Product page rerenders on every character typed in search!
  return (
    <div>
      <ProductHeader product={product} /> {/* rerenders on search! */}
      <SearchBar query={searchQuery} onChange={setSearchQuery} />
      <FilterPanel category={filterCategory} onChange={setFilterCategory} />
      <ProductList query={searchQuery} category={filterCategory} />
    </div>
  );
}
```

```jsx
// GOOD: Each piece of state lives where it's used
function ProductPage() {
  const [product, setProduct] = useState(null);

  return (
    <div>
      <ProductHeader product={product} />
      <ProductSearch /> {/* self-contained search + filter + results */}
    </div>
  );
}

function ProductSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');

  return (
    <>
      <SearchBar query={searchQuery} onChange={setSearchQuery} />
      <FilterPanel category={filterCategory} onChange={setFilterCategory} />
      <ProductList query={searchQuery} category={filterCategory} />
    </>
  );
}
```

### Step 4 — The "children as prop" composition trick

This pattern avoids lifting state AND avoids context:

```jsx
// Problem: ExpensivePanel rerenders when count changes
function App() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
      <ExpensivePanel /> {/* rerenders because App rerenders */}
    </div>
  );
}

// Solution: "lift the static content above the state"
function Counter({ children }) {
  const [count, setCount] = useState(0); // state is here

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
      {children} {/* ExpensivePanel is passed from outside — not in Counter's scope */}
    </div>
  );
}

function App() {
  return (
    <Counter>
      <ExpensivePanel /> {/* created in App's scope, not affected by Counter's state */}
    </Counter>
  );
}
```

`<ExpensivePanel />` is created as JSX in `App`, which doesn't have `count` state. When `count` changes, only `Counter` rerenders. `children` is the same JSX element reference (from `App`'s render) — `ExpensivePanel` doesn't rerender.

This is compositional state isolation — no memo, no useCallback, no useMemo needed.

### Step 5 — When to lift state (genuine shared state)

Some state genuinely belongs higher:

```jsx
// CORRECT: Theme must be shared — lifting is right
function App() {
  const [theme, setTheme] = useState('light'); // multiple children need this
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <Header />
      <Sidebar />
      <Main />
    </ThemeContext.Provider>
  );
}

// WRONG: Lifting a counter just because it "might be needed"
// (premature lifting)
function App() {
  const [tabCount, setTabCount] = useState(0); // only used in TabBar!
  return (
    <>
      <Header />
      <TabBar count={tabCount} onUpdate={setTabCount} />
      <Content />
    </>
  );
}
```

---

## What To Observe

- State too high: every state change rerenders ancestors and siblings unnecessarily
- State moved down: only the owning component and its descendants rerender
- Children as prop: static sibling content isolated from dynamic state
- No memo needed: architectural fix eliminates the problem at the source
- Form state in page: page rerenders on every keystroke (use controlled components in child)

---

## Internal React Explanation

### How renders cascade

When `App`'s state changes:
1. `App` rerenders
2. React evaluates all of `App`'s JSX children
3. `Header`, `Sidebar`, `MainContent`, `Counter` are all re-evaluated
4. Without `React.memo`: all of them rerender
5. With `React.memo`: they bail out if props haven't changed — but React still evaluates the JSX to compare

The issue: React evaluates all of `App`'s render output. Even with `React.memo` on children, React still creates the element objects for comparison. With state locality, React never even gets to step 2 for `App`'s unrelated children.

### The "children as prop" mechanism

```jsx
// In App (count state doesn't exist here):
<Counter>
  <ExpensivePanel />
</Counter>
```

`<ExpensivePanel />` is a JSX element created in `App`. When `Counter`'s `count` changes:

1. `Counter` rerenders
2. `Counter`'s render returns: `<div>{children}</div>`
3. `children` is the same `<ExpensivePanel />` element from `App`
4. React reconciles: same type, same reference → no rerender for ExpensivePanel

The key: JSX elements passed as `children` are created in the parent's scope, not the child's scope. They only re-create when the parent re-renders — not when the child's state changes.

### The "state lifting" decision

**Lift state when:**
- Multiple unrelated components need to read the same state
- Multiple unrelated components need to update the same state
- State represents shared application concerns (auth, theme, cart)

**Don't lift state when:**
- Only one component uses it
- Sibling components need it — consider a common parent, but keep it as low as possible
- You're lifting "just in case" — YAGNI

---

## Optimization Challenge

**Challenge 1:** Refactor this component to eliminate all unnecessary rerenders without using `React.memo`:

```jsx
function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState([]);

  return (
    <div>
      <TopBar
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        notifications={notifications}
      />
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(s => !s)}
      />
      <TabPanel
        active={activeTab}
        onChange={setActiveTab}
      />
      <ContentArea
        tab={activeTab}
        query={searchQuery}
      />
    </div>
  );
}
```

Move each piece of state down into the component that uses it. Which states genuinely need to be shared?

**Challenge 2:** Apply the "children as prop" pattern to a modal:

```jsx
// Currently: modal state in App causes entire app to rerender on open/close
function App() {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <>
      <ComplexExpensiveUI />
      <button onClick={() => setModalOpen(true)}>Open</button>
      {modalOpen && <Modal onClose={() => setModalOpen(false)} />}
    </>
  );
}
```

Refactor so `ComplexExpensiveUI` doesn't rerender when the modal opens.

---

## Why This Optimization Works

State locality eliminates the root cause:

- No state change in unrelated components' ancestor → no cascade rerender
- No cascade rerender → no memo needed to bail out
- Simpler code: no `useCallback`, no `React.memo`, no `useMemo` for props stabilization

It's always better to prevent a problem architecturally than to patch it with memoization.

---

## Common Mistakes

**Mistake 1: Lifting state "for future needs"**

Don't lift state to a parent because you think another child might need it someday. Lift it when you actually need to share it. Premature lifting is the source of most cascade rerender problems.

**Mistake 2: Fixing cascade rerenders with memo instead of architecture**

Adding `React.memo` to 10 components because their parent has too many state updates is the wrong fix. The fix is to move the state down. Memo is appropriate when architectural fixes aren't possible (third-party components, legacy code).

**Mistake 3: Conflating "one component can access this" with "it lives there"**

Just because `Header` accesses a counter doesn't mean the counter state lives in `App`. If only `Counter` renders the count and `Header` doesn't, the count lives in `Counter`. If `Header` shows the count, it needs to be lifted to their common parent.

**Mistake 4: Not using the children prop**

Many developers reach for context or state lifting when the children composition pattern would be simpler. If component A has state and component B is static, `<A>{B}</A>` isolates them with zero overhead.

**Mistake 5: Lifting state too low**

The opposite problem: state in a grandchild that needs to be in the grandparent. This causes prop drilling. Find the common ancestor and lift exactly to that level.

---

## Debugging Tools

### Identify over-lifted state

Instrument every component with render logs. If `Header` logs when you click increment (unrelated), `count` state is lifted too high.

### React DevTools "Why did this render?"

Shows "state changed" for the component that owns state, "parent rendered" for components that rerender because their parent did. If you see "parent rendered" for components that don't use the changed state, that state is lifted too high.

---

## Interview Questions

1. What is state locality and why does it matter?
2. What problem does lifting state too high cause?
3. What is the "children as prop" composition pattern?
4. How does the children prop prevent rerenders?
5. When should you lift state vs keep it local?
6. How does state locality compare to `React.memo` as an optimization strategy?
7. What is "colocated state"?
8. How do you decide where state "should" live?
9. What is the difference between state lifting for sharing vs state lifting for architecture?
10. Can the children prop be used to avoid context?

---

## Interview Answers

**1. State locality?**
The principle that state should live as close to where it's used as possible. If only `Counter` needs `count`, the count state belongs in `Counter`, not in `App`. This minimizes the scope of rerenders when state changes.

**2. State too high causes?**
When state lives higher than needed, every state change causes the owning component to rerender. All of its children (and their subtrees) are re-evaluated. Siblings and cousins of the intended consumer get unnecessary rerenders.

**3. Children as prop?**
Instead of rendering a static component inside a component with changing state, pass it as `children` from a parent scope that doesn't have that state. The children JSX is created in the outer scope — it only rerenders when the outer scope rerenders, not when the inner component's state changes.

**4. How children prop prevents rerenders?**
`children` JSX elements are created in the parent's scope. When the inner component's state changes, the inner component rerenders, but `children` holds the same element reference (from the parent's last render). React sees the same type/props → bails out → no rerender for the children.

**5. Lift vs keep local?**
Keep local if only one component uses it. Lift to the nearest common ancestor if multiple sibling components need it. Lift to context/global store if truly application-wide (theme, auth, cart). The rule: as low as correct, never lower, never higher than needed.

**6. State locality vs React.memo?**
State locality is architectural — prevents the problem. `React.memo` is a patch — detects the problem and bails out. Locality is always better: no overhead, simpler code, eliminates the issue entirely. Memo is for when locality isn't possible (third-party code, genuinely shared state).

**7. Colocated state?**
State and the UI that uses it are in the same component (or as close as possible). The form field state lives in the field component. The modal open state lives in the modal trigger component. Colocation = maximum locality.

**8. Where should state live?**
Ask: "Who needs to read this state?" and "Who needs to write this state?" The state should live in the lowest common ancestor of all readers and writers. If only one component reads and writes it, it lives there. If two siblings need it, it lives in their parent.

**9. Lifting for sharing vs architecture?**
Lifting for sharing: a genuine decision driven by data access needs. Two components share state. Lifting for architecture: a mistake driven by organization preferences or "just in case." Never lift for architecture alone — only lift when sharing is necessary.

**10. Children prop to avoid context?**
Yes. Context provides a way to pass data through the tree without prop drilling. The children composition pattern provides an alternative: restructure so the component consuming the data is instantiated in the scope that has it, then passed as children to the intermediate components. For many cases, this is simpler than context.

---

## Senior-Level Thinking

**State locality is the first optimization, not the last.**

When you see performance issues in a React app, the diagnostic order should be:
1. Is state lifted higher than needed? → Move it down
2. Are there unnecessary rerenders of expensive subtrees? → children composition
3. Are there expensive computations running too often? → useMemo
4. Are there unstable prop references? → useCallback / useMemo for objects
5. Is the DOM too large? → virtualization

Most apps with performance issues skip to step 3-4 and miss the architectural fixes in 1-2 that would make 3-4 unnecessary.

**The composition pattern scales.**

The "children as prop" pattern works at any depth. An `AnimationController` that manages complex state can wrap stable content:

```jsx
<AnimationController>
  <StaticNavbar />
  <StaticContent />
  <AnimationTarget />
</AnimationController>
```

`StaticNavbar` and `StaticContent` never rerender due to animation state.

---

## Revision Notes

- State locality = state lives as close to its consumers as possible
- Too-high state → cascade rerenders on every state change
- Move state down → only the owning component's subtree rerenders
- Children as prop: `<A>{B}</A>` — B is created in outer scope, doesn't rerender on A's state
- Lift state only when genuinely shared between multiple consumers
- Architecture first → memo second (not the other way)
- "Who reads and writes this?" → state lives in their lowest common ancestor

---

## Next Day Preview

**Day 26 — Smart vs Dumb Components**

The container/presentational pattern: separating logic from UI. How custom hooks extract stateful logic. The benefits for testing, reuse, and preventing accidental coupling that causes rerenders.
