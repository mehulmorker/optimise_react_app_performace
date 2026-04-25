import React, { useCallback, useState } from "react";

export function TaskList() {
  const [completedCount, setCompletedCount] = useState(0);
  const [prefix, setPrefix] = useState("Task");

  const tasks = ["Write tests", "Review PR", "Deploy", "Update docs"];

  const handleComplete = useCallback((task) => {
    console.log(`${prefix} completed: ${task}`);
    setCompletedCount((c) => c + 1);
  }, [prefix]);

  console.log("handleComplete reference:", handleComplete);
  return (
    <div>
      <p>Completed: {completedCount}</p>
      <button onClick={() => setPrefix(`Test${Math.random()}`)}>Prefix</button>
      {tasks.map((task) => (
        <TaskItem key={task} task={task} onComplete={handleComplete} />
      ))}
    </div>
  );
}

const TaskItem = React.memo(function TaskItem({ task, onComplete }) {
  console.log(`TaskItem rendered: ${task}`);
  return (
    <div>
      {task}
      <button onClick={() => onComplete(task)}>Done</button>
    </div>
  );
});
