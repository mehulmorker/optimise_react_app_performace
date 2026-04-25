import { useState } from "react";

export function TodoList() {
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

function TodoItem({ todo }) {
  console.log(`TodoItem rendered: ${todo.text}`);
  return (
    <div>
      <span>{todo.text}</span>
      <input placeholder="Add note..." />
    </div>
  );
}
