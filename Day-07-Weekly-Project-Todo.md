# Day 7 — Weekly Review Project: Optimized Todo App

## Objective

Consolidate everything from Week 1 by building a **performance-optimized Todo App** from scratch. Every concept applies here: proper keys, React.memo, useCallback, useMemo, and the correct input pattern. This is your first benchmark — you'll build it unoptimized first, measure the problem, then fix it systematically.

---

## Real World Importance

Todo apps are the "Hello World" of React, but most implementations are full of performance bugs. This project is your first production-grade example of applying optimizations deliberately — not cargo-culting, but understanding why each one is needed.

---

## Concepts Applied

- `React.memo` — prevent todo item rerenders
- `useCallback` — stable handlers passed to memo'd items
- `useMemo` — filtered/sorted list computation
- Proper keys — stable IDs, not index
- Controlled vs uncontrolled — input for new todo only, typed per-item notes
- Render logging — verify each optimization actually works

---

## Exercise Task

Build the app in two passes: **broken first**, then **optimized**.

---

### Pass 1: Build the unoptimized version

#### Step 1 — Setup data structure

```jsx
// Each todo has a stable ID, text, and completion status
const createTodo = (text) => ({
  id: Date.now() + Math.random(), // stable unique ID
  text,
  completed: false,
});
```

#### Step 2 — Build the parent component

```jsx
function TodoApp() {
  const [todos, setTodos] = useState([
    createTodo('Buy groceries'),
    createTodo('Walk the dog'),
    createTodo('Write tests'),
  ]);
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'completed'
  const [newTodoText, setNewTodoText] = useState('');

  console.log('TodoApp rendered');

  // Handlers defined inline (intentionally unoptimized for now)
  const addTodo = () => {
    if (!newTodoText.trim()) return;
    setTodos(prev => [...prev, createTodo(newTodoText)]);
    setNewTodoText('');
  };

  const toggleTodo = (id) => {
    setTodos(prev =>
      prev.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const deleteTodo = (id) => {
    setTodos(prev => prev.filter(todo => todo.id !== id));
  };

  // Filter computed inline (intentionally unoptimized)
  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  return (
    <div>
      <h1>Todo App</h1>

      {/* Input for new todo */}
      <div>
        <input
          value={newTodoText}
          onChange={e => setNewTodoText(e.target.value)}
          placeholder="New todo..."
          onKeyDown={e => e.key === 'Enter' && addTodo()}
        />
        <button onClick={addTodo}>Add</button>
      </div>

      {/* Filter buttons */}
      <div>
        {['all', 'active', 'completed'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ fontWeight: filter === f ? 'bold' : 'normal' }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Todo list */}
      {filteredTodos.map((todo, index) => (
        <TodoItem
          key={index}  // intentionally bad key for now
          todo={todo}
          onToggle={toggleTodo}
          onDelete={deleteTodo}
        />
      ))}

      <p>Total: {todos.length} | Active: {todos.filter(t => !t.completed).length}</p>
    </div>
  );
}

function TodoItem({ todo, onToggle, onDelete }) {
  console.log(`TodoItem rendered: ${todo.text}`);
  return (
    <div style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo.id)}
      />
      <span>{todo.text}</span>
      <button onClick={() => onDelete(todo.id)}>Delete</button>
    </div>
  );
}
```

#### Step 3 — Observe the problems

1. Type a character in the "new todo" input. Count how many TodoItem console logs appear.
2. Toggle a todo. Count how many other todos rerender.
3. Delete the middle todo. Observe the key warning and potential state issues.
4. Add a `notes` input (uncontrolled) to each TodoItem. Type a note in item 1. Delete item 1. Watch item 2's note jump up.

These are the bugs. Document them before fixing.

---

### Pass 2: Fix all problems systematically

#### Fix 1 — Correct keys

```jsx
{filteredTodos.map(todo => (
  <TodoItem key={todo.id} ... />
))}
```

**Verify:** Delete the middle todo. Notes stay attached to the correct items.

#### Fix 2 — Stable handlers with useCallback

```jsx
const toggleTodo = useCallback((id) => {
  setTodos(prev =>
    prev.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    )
  );
}, []); // no deps needed — uses functional update

const deleteTodo = useCallback((id) => {
  setTodos(prev => prev.filter(todo => todo.id !== id));
}, []);
```

#### Fix 3 — Memoize filtered list

```jsx
const filteredTodos = useMemo(() =>
  todos.filter(todo => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  }),
[todos, filter]);
```

**Verify:** The filter computation only re-runs when `todos` or `filter` changes, not when `newTodoText` changes.

#### Fix 4 — Memoize stats

```jsx
const stats = useMemo(() => ({
  total: todos.length,
  active: todos.filter(t => !t.completed).length,
  completed: todos.filter(t => t.completed).length,
}), [todos]);
```

#### Fix 5 — Memoize TodoItem

```jsx
const TodoItem = React.memo(function TodoItem({ todo, onToggle, onDelete }) {
  console.log(`TodoItem rendered: ${todo.text}`);
  return (
    <div style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo.id)}
      />
      <span>{todo.text}</span>
      <input placeholder="Add note..." /> {/* uncontrolled — no rerenders */}
      <button onClick={() => onDelete(todo.id)}>Delete</button>
    </div>
  );
});
```

**Verify:** Type in the "new todo" input — no TodoItem rerenders. Toggle one todo — only that todo rerenders (because its `todo` prop changed). Other todos skip.

#### Fix 6 — Move newTodo input to its own component

```jsx
const TodoInput = React.memo(function TodoInput({ onAdd }) {
  const [text, setText] = useState('');

  const handleAdd = () => {
    if (!text.trim()) return;
    onAdd(text);
    setText('');
  };

  return (
    <div>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
        placeholder="New todo..."
      />
      <button onClick={handleAdd}>Add</button>
    </div>
  );
});
```

Now typing in the input only rerenders `TodoInput`, not `TodoApp` or any `TodoItem`.

The `onAdd` handler in `TodoApp`:

```jsx
const addTodo = useCallback((text) => {
  setTodos(prev => [...prev, createTodo(text)]);
}, []);
```

---

## What To Observe (Before vs After)

| Action | Before | After |
|--------|--------|-------|
| Type in new todo input | All N TodoItems rerender | 0 TodoItems rerender |
| Toggle one todo | All N TodoItems rerender | Only the toggled item rerenders |
| Change filter | All N TodoItems rerender | Only items that appear/disappear rerender |
| Delete middle item | Notes shift (key bug) | Notes stay correct |
| Add new todo | All existing items rerender | 0 existing items rerender |

---

## Internal React Explanation

### Why "new todo input" was causing all items to rerender

`newTodoText` state was in `TodoApp`. Every character typed → `setNewTodoText` → `TodoApp` rerenders → all `TodoItem` elements re-evaluated → without memo, all re-render.

After moving input state to `TodoInput`, typing only rerenders `TodoInput`. `TodoApp` doesn't even know typing is happening.

This is **state locality** — the concept from Day 25 previewed here. State should live as close to where it's used as possible.

### Why functional setState removes dependencies

```jsx
// Before: needs 'todos' in deps
const addTodo = useCallback((text) => {
  setTodos([...todos, createTodo(text)]);
}, [todos]); // recreates whenever todos changes!

// After: no deps needed
const addTodo = useCallback((text) => {
  setTodos(prev => [...prev, createTodo(text)]);
}, []); // stable forever
```

Functional updates let you modify state based on its previous value without reading it from the closure. No closure capture = no dep = stable reference = memo never breaks.

---

## Debugging Checklist

Before submitting this as "optimized," verify each of these:

- [ ] Typing in new todo input: zero TodoItem logs in console
- [ ] Toggling todo A: only "TodoItem rendered: [A's text]" appears
- [ ] Changing filter: only items changing visibility rerender
- [ ] Deleting first item: notes on remaining items are correct
- [ ] React DevTools Profiler shows expected bailouts

---

## Common Mistakes in This Project

**Mistake 1:** Adding `todos` to `useCallback` deps (use functional updates instead)  
**Mistake 2:** Putting `newTodoText` in `TodoApp` state instead of extracting to `TodoInput`  
**Mistake 3:** Using index as key (breaks note persistence on delete)  
**Mistake 4:** `React.memo` without stable handler props (memo fails silently)  
**Mistake 5:** Over-memoizing: the filter buttons don't need memo (they're cheap)

---

## Interview Questions

1. Why does moving input state to a child component prevent parent rerenders?
2. Why can `addTodo` use an empty deps array with `useCallback`?
3. If you have `React.memo` on `TodoItem` but pass an inline function, what happens?
4. Why is the `useMemo` on filtered todos important when there are many items?
5. What is "state locality" and how does it relate to this project?

---

## Interview Answers

**1. Moving input state prevents parent rerenders?**
`setState` for the input's `text` is now inside `TodoInput`. When it updates, only `TodoInput` rerenders. `TodoApp` is never told about the change, so it doesn't rerender, and none of its children (including other `TodoItem` components) are affected.

**2. Empty deps for addTodo?**
Because the callback uses `setTodos(prev => ...)` — a functional update that receives the latest state as an argument rather than reading it from the closure. No closure capture of `todos` = no dependency = stable reference on every render.

**3. Memo + inline function?**
Memo fails. Every render creates a new function object. The shallow comparison sees a new `onToggle`/`onDelete` reference and re-renders all items. Must use `useCallback` for the handlers.

**4. Why useMemo on filter?**
Without it, the filter runs on every render, including typing in the new-todo input (if that input caused a parent rerender). With it, filtering only runs when `todos` or `filter` changes — skipping all unrelated rerenders.

**5. State locality?**
The principle that state should live as close to its consumers as possible. Lifting state higher than necessary causes rerenders to cascade down unnecessarily. In this project, `newTodoText` was "too high" in `TodoApp` — moving it to `TodoInput` scoped the rerenders to just that component.

---

## Senior-Level Thinking

**This app is a microcosm of every large React app.**

Every enterprise React app has the same set of problems: global state that causes too many rerenders, handlers defined too high, expensive derivations not memoized. The patterns you applied here scale directly to 100-component apps.

**The optimization order matters.**

Always: (1) fix state placement first, (2) then add memo, (3) then add useCallback/useMemo. Fixing state placement often makes memo unnecessary. Adding memo to fix misplaced-state problems is backwards.

**Know when to stop.**

This todo app is fully optimized for its complexity. A real app with thousands of todos would also need virtualization (Day 18). Know the ceiling of these techniques and when you need the next-level tool.

---

## Revision Notes

- State as close to consumers as possible = fewer cascade rerenders
- Functional setState updates = no dependency on current state in callbacks
- `React.memo` + `useCallback` + `useMemo` work as a system — weak link breaks the chain
- Proper keys = correctness + performance (matching by identity, not position)
- Uncontrolled notes on each item = zero rerenders during note typing
- Always verify optimizations with render logs or DevTools Profiler

---

## Next Day Preview

**Day 8 — setState Batching**

Week 2 begins with how React handles multiple `setState` calls in the same event handler. The surprising difference between `setState(n + 1)` called twice vs `setState(n => n + 1)` called twice.
