# Day 5 — Keys & Reconciliation

## Objective

Understand React's reconciliation algorithm in depth — specifically how `key` props affect it. The `key` prop is one of the most misunderstood concepts in React, causing both invisible performance bugs and deeply confusing UI behavior. Master this and you'll debug list bugs in seconds that stump other developers for hours.

---

## Real World Importance

- **Reordering todo items** causes inputs to show wrong values
- **Deleting a middle item** from a list causes remaining items to adopt wrong state
- **Adding items to the start** of a list causes every existing item to re-render
- **Animated list items** don't animate because React reuses DOM nodes in unexpected ways
- **Paginated tables** where changing pages doesn't reset item-level state

---

## Concepts Covered

- What the reconciliation algorithm actually does
- How React matches elements across renders using `type` and `key`
- Why index as key is dangerous
- What "remounting" vs "rerendering" means
- How key can be used intentionally to force a remount
- The performance difference between reuse and recreation

---

## Exercise Task

### Step 1 — Build a list with index keys

```jsx
function TodoList() {
  const [todos, setTodos] = useState([
    { id: 1, text: 'Buy groceries' },
    { id: 2, text: 'Walk the dog' },
    { id: 3, text: 'Read a book' },
  ]);

  const deleteFirst = () => {
    setTodos(prev => prev.slice(1));
  };

  return (
    <div>
      <button onClick={deleteFirst}>Delete First Item</button>
      {todos.map((todo, index) => (
        <TodoItem key={index} todo={todo} />
      ))}
    </div>
  );
}

function TodoItem({ todo }) {
  console.log(`TodoItem rendered: ${todo.text}`);
  return (
    <div>
      <span>{todo.text}</span>
      <input placeholder="Add note..." />
    </div>
  );
}
```

### Step 2 — Add notes to observe the bug

Type different text in each input (e.g., "note A", "note B", "note C"). Then click **Delete First Item**. 

Observe: the notes shift down incorrectly. "note A" disappears, "note B" stays where "note A" was. This is the **index key bug**.

### Step 3 — Fix with stable unique keys

```jsx
{todos.map(todo => (
  <TodoItem key={todo.id} todo={todo} />
))}
```

Repeat the experiment. Now deleting the first item correctly removes it and preserves the other notes.

### Step 4 — Understand the reorder case

Add a `reverse` function and a second button to the `TodoList` component from Step 1/3:

```jsx
function TodoList() {
  const [todos, setTodos] = useState([
    { id: 1, text: 'Buy groceries' },
    { id: 2, text: 'Walk the dog' },
    { id: 3, text: 'Read a book' },
  ]);

  const deleteFirst = () => setTodos(prev => prev.slice(1));
  const reverse = () => setTodos(prev => [...prev].reverse());

  return (
    <div>
      <button onClick={deleteFirst}>Delete First Item</button>
      <button onClick={reverse}>Reverse Order</button>
      {todos.map(todo => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </div>
  );
}
```

Type a note into each input. Click **Reverse Order**.

With index keys (`key={index}`): all 3 items rerender and the notes shift to wrong items — React treats every position as changed.
With id keys (`key={todo.id}`): React sees the same items in different positions and moves the DOM nodes efficiently — notes stay attached to their correct items.

### Step 5 — Intentional remount with key

```jsx
function ProfileEditor({ userId }) {
  return <UserForm key={userId} userId={userId} />;
}
```

When `userId` changes, the `key` changes, forcing `UserForm` to **unmount and remount** — completely resetting all its internal state. This is the correct way to reset a form when switching users.

---

## What To Observe

- Index key: deleting an item causes all subsequent items to rerender with wrong data
- Index key: uncontrolled input state (not managed by React) sticks to the DOM position
- ID key: deleting an item causes only that item's DOM node to be removed, others untouched
- ID key: reordering rerenders nothing (only DOM positions change)
- Changing `key` on a component forces it to unmount and remount entirely

---

## Internal React Explanation

### The reconciliation algorithm

When React rerenders a component, it needs to figure out what changed between the old element tree and the new one. It can't do a full tree diff (O(n³) complexity) — so it uses heuristics that make it O(n).

The two key heuristics:

**1. Same position + same type = update (reuse)**
If the element at position 0 in the old tree is `<TodoItem />` and position 0 in the new tree is `<TodoItem />`, React reuses the existing fiber (DOM node + component state).

**2. Different type = unmount + mount (recreate)**
If position 0 changes from `<div>` to `<span>`, React destroys the old fiber entirely and creates a fresh one.

### Where `key` fits in

For lists, React needs a way to match elements across renders when positions can change. Without keys, React matches by index position. With keys, React matches by key value:

```
Old tree:        New tree (after deleting item at index 0):
key=0: "Buy"    key=0: "Walk"  ← React sees key 0 still exists
key=1: "Walk"   key=1: "Read"  ← React sees key 1 still exists
key=2: "Read"   (key 2 is gone)
```

With index keys, React reuses the fiber at position 0 (which has "note A" typed in its input) but updates its props to "Walk". The input DOM node retains "note A" because React didn't recreate it — it just updated the prop. The note is wrong.

```
With ID keys:
Old tree:        New tree:
key=1: "Buy"    (gone)
key=2: "Walk"   key=2: "Walk"  ← React matches by key, no change
key=3: "Read"   key=3: "Read"  ← React matches by key, no change
```

React correctly removes key=1's fiber and leaves 2 and 3 completely untouched. Their DOM nodes, state, and inputs are preserved.

### Controlled vs uncontrolled state

This bug is most visible with **uncontrolled inputs** (where React doesn't manage the value). The input DOM node retains its user-typed value even when its surrounding component is "updated" by React.

With **controlled inputs** (`value={todo.note}`), React would update the displayed value to match state — making the index key bug show differently: the note text would appear to jump to the wrong item, not just visually stay put.

### What "remount" means

A remount is React:
1. Calling `componentWillUnmount` (class) or cleanup functions in `useEffect` (hooks)
2. Removing the DOM nodes from the document
3. Creating new fiber instances from scratch
4. Calling `componentDidMount` (class) or running `useEffect` (hooks) fresh

All component state is lost. Refs are reset. useEffect runs as if for the first time.

This is expensive but sometimes exactly what you want — like resetting a form when navigating to a different user's profile.

---

## Optimization Challenge

**Challenge 1:** Build an animated list where items slide in from the left when added. Use stable keys to ensure items aren't remounted unnecessarily when others are added.

**Challenge 2:** Build a tab system where switching tabs should reset the content component's scroll position and internal state. Use the `key` prop intentionally to force a remount.

**Challenge 3:** Profile a list of 50 items being reordered:
- First with index keys (measure rerender count)
- Then with stable ID keys (measure rerender count)
Document the difference.

---

## Why This Optimization Works

**Stable keys** allow React to:
1. Match elements across renders by identity, not position
2. Reuse existing fiber nodes when items persist (no DOM recreation)
3. Apply only the minimum necessary DOM operations (add/remove/move)

This reduces:
- Component function calls (rerenders)
- Virtual DOM reconciliation work
- Actual DOM mutations (the most expensive part)

The correctness benefit is equally important: stable keys ensure component state stays attached to the right data, preventing the note-shifting bug.

---

## Common Mistakes

**Mistake 1: Using array index as key "for simplicity"**

This works only when: (a) the list never reorders, (b) items are never inserted except at the end, (c) items are never deleted. In practice, one of these conditions eventually breaks. Use a stable ID from your data.

**Mistake 2: Using `Math.random()` as a key**

```jsx
key={Math.random()}
```

This changes every render, causing every item to remount every time. Maximum possible overhead. Never do this.

**Mistake 3: Using non-unique keys**

Duplicate keys within the same list cause unpredictable behavior. React logs a warning but attempts to continue — the results are undefined.

**Mistake 4: Putting key on the wrong element**

The `key` must go on the outermost element returned by `map`, not on a child inside it:

```jsx
// Wrong
items.map(item => <div><span key={item.id}>{item.name}</span></div>)

// Correct
items.map(item => <div key={item.id}><span>{item.name}</span></div>)
```

**Mistake 5: Not understanding that key forces remount**

Using `key` to "reset" a component is valid but has cost — everything unmounts and remounts. Don't use it where a prop change to reset state would work.

---

## Debugging Tools

### Visual key debugging

```jsx
function TodoItem({ todo, index }) {
  console.log(`Rendered: key would be ${index} or ${todo.id}`);
  return <div data-key-demo={todo.id}>{todo.text}</div>;
}
```

Inspect the DOM in DevTools. With index keys, watch how `data-key-demo` attributes jump around when you delete items.

### React DevTools — Component tree

In React DevTools, select a list item. Note the "key" shown in the component props. When you delete an item, watch whether the selected component disappears or if the key value changes on it.

### Count remounts vs rerenders

```jsx
function TodoItem({ todo }) {
  const mountCount = useRef(0);
  const renderCount = useRef(0);

  useEffect(() => {
    mountCount.current++;
    console.log(`MOUNTED: ${todo.text} (total mounts: ${mountCount.current})`);
    return () => console.log(`UNMOUNTED: ${todo.text}`);
  }, []);

  renderCount.current++;
  console.log(`Rendered: ${todo.text} (#${renderCount.current})`);

  return <div>{todo.text}</div>;
}
```

---

## Interview Questions

1. What is React's reconciliation algorithm and why is it O(n)?
2. What does the `key` prop tell React?
3. Why is using array index as a key a problem?
4. What is the difference between rerendering and remounting?
5. When is it acceptable to use array index as a key?
6. How can you intentionally use `key` to reset a component?
7. What happens to component state when a component remounts?
8. Why does deleting a middle list item cause wrong behavior with index keys?
9. What are the performance implications of keys on list operations?
10. What makes a "good" key?

---

## Interview Answers

**1. React's reconciliation algorithm?**
React compares the new element tree with the previous one to determine minimal DOM operations. It uses two heuristics to achieve O(n): (a) elements at the same position with the same type are updated in-place; (b) elements with different types cause unmount + remount. For lists, `key` is used to match elements across positions.

**2. What does key tell React?**
The `key` is a stable identifier that lets React match elements across renders regardless of position. If element with key="abc" moved from position 2 to position 0, React moves the corresponding fiber (and DOM node) rather than destroying and recreating it.

**3. Why is index key a problem?**
When items are deleted, inserted, or reordered, the index no longer maps consistently to the same data. React matches old and new elements by index, so it updates the wrong fibers — causing state from one item to bleed into another, especially for uncontrolled inputs.

**4. Rerender vs remount?**
Rerender: the component function is called again, producing new JSX. The existing fiber (DOM node, state) is preserved and updated. Remount: the fiber is destroyed and recreated from scratch — all state is lost, effects are re-run from the beginning.

**5. When is index key acceptable?**
When all three conditions hold: the list is static (never reordered), items are never deleted from anywhere except the end, and items are never inserted anywhere except the end. Simple static display lists often qualify.

**6. Intentional remount with key?**
Set the `key` prop to a value that changes when you want to reset: `<UserForm key={userId} />`. When `userId` changes, the key changes, React unmounts the old form (losing all input state) and mounts a fresh one. Clean reset without `useEffect` imperatively clearing state.

**7. State when remounting?**
All component state is destroyed. Local state (`useState`, `useReducer`) reverts to initial values. Context subscriptions are re-established. All effects re-run their setup functions. Any external side effects from the old instance should have been cleaned up in the effect cleanup function.

**8. Deleting middle item with index keys?**
After deletion, every item after the deleted one shifts down one position. The item that was at index 2 now appears at index 1. React finds the fiber at index 1 and updates its props to match the item that moved there — but the fiber retains its old internal state (input values, scroll position, etc.). The state from the old item 1 "bleeds into" the now-shifted item.

**9. Performance implications?**
With stable keys and a reorder operation: React moves existing DOM nodes (cheap) and may update some props. Without keys (index-based): React updates every item's props from the top, potentially rerendering all components. For large lists, stable keys dramatically reduce reconciliation work.

**10. What makes a good key?**
Stable across renders, unique within the sibling list, tied to the item's identity (not position). Typically a database ID, UUID, or some natural identifier from your data. Never a random value, never based on render-time calculations.

---

## Senior-Level Thinking

**Key as a reset mechanism is underused.**

Many developers fight with `useEffect` to reset form state when props change, writing complex logic with dep arrays. The simpler solution is often `key={entityId}` — when the entity changes, the form remounts fresh. No cleanup needed, no edge cases.

**The reconciliation algorithm shapes your data structure choices.**

If you're building a drag-and-drop list, you need stable IDs in your data — not just for correctness but for performance. An array of objects with IDs allows O(n) reconciliation. An array of anonymous objects reconciled by index requires O(n) rerenders even for a simple reorder.

**Fragments and keys.**

When rendering sibling elements in a `map` without a wrapping div, you can use Fragment with a key:

```jsx
items.map(item => (
  <React.Fragment key={item.id}>
    <dt>{item.term}</dt>
    <dd>{item.definition}</dd>
  </React.Fragment>
))
```

**The "key on wrong element" gotcha in real code.**

When you extract a list item into its own component, the `key` stays on the JSX in the parent's `map`, not on the root element of the child component. Developers sometimes move it "inside" when refactoring — breaking everything silently.

---

## Revision Notes

- `key` lets React match elements across renders by identity, not position
- Index key = match by position → breaks on delete/insert/reorder
- Stable key = match by identity → correct behavior + better performance
- Remount = fiber destroyed + recreated; rerender = fiber updated in-place
- `key` change forces remount — useful for intentional state reset
- Never use `Math.random()` as key — remounts everything every render
- Fragment with key: `<React.Fragment key={id}>` for multiple sibling elements

---

## Next Day Preview

**Day 6 — Controlled vs Uncontrolled Inputs**

The render performance difference between controlled and uncontrolled inputs. When each pattern is appropriate. Why form libraries like React Hook Form prefer uncontrolled inputs. How to measure input-triggered rerender count.
