import React, { useCallback, useMemo, useState } from "react";

// Each todo has a stable ID, text, and completion status
const createTodo = (text) => ({
  id: Date.now() + Math.random(), // stable unique ID
  text,
  completed: false,
});

export function TodoApp() {
  const [todos, setTodos] = useState([
    createTodo("Buy groceries"),
    createTodo("Walk the dog"),
    createTodo("Write tests"),
  ]);

  const [filter, setFilter] = useState("all"); // 'all' | 'active' | 'completed'
  const [newTodoText, setNewTodoText] = useState("");

  console.log("TodoApp rendered");

  const addTodo = () => {
    if (!newTodoText.trim()) return;
    setTodos((prev) => [...prev, createTodo(newTodoText)]);
    setNewTodoText("");
  };

  const toggleTodo = useCallback((id) => {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo,
      ),
    );
  }, []);

  const deleteTodo = useCallback((id) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  }, []);

  // Filter computed inline (intentionally unoptimized)
  const filteredTodos = useMemo(
    () =>
      todos.filter((todo) => {
        if (filter === "active") return !todo.completed;
        if (filter === "completed") return todo.completed;
        return true;
      }),
    [todos, filter],
  );

  return (
    <div>
      <h1>Todo App</h1>

      {/* Input for new todo */}
      <div>
        <input
          value={newTodoText}
          onChange={(e) => setNewTodoText(e.target.value)}
          placeholder="New todo..."
          onKeyDown={(e) => e.key === "Enter" && addTodo()}
        />
        <button onClick={addTodo}>Add</button>
      </div>

      {/* Filter buttons */}
      <div>
        {["all", "active", "completed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ fontWeight: filter === f ? "bold" : "normal" }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Todo list */}
      {filteredTodos.map((todo) => (
        <TodoItem
          key={todo.id} // intentionally bad key for now
          todo={todo}
          onToggle={toggleTodo}
          onDelete={deleteTodo}
        />
      ))}

      <p>
        Total: {todos.length} | Active:{" "}
        {todos.filter((t) => !t.completed).length}
      </p>
    </div>
  );
}

const TodoItem = React.memo(function TodoItem({ todo, onToggle, onDelete }) {
  console.log(`TodoItem rendered: ${todo.text}`);
  return (
    <div style={{ textDecoration: todo.completed ? "line-through" : "none" }}>
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
