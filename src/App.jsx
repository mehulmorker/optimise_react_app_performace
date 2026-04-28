import { SearchDebounced, SearchOptimized, SearchWithLag } from "./components/SearchWithlag";
import { ControlledForm } from "./components/ControlledForm";
import { Counter } from "./components/Counter";
import { Dashboard } from "./components/Dashboard";
// import { InfiniteLoop1 } from "./components/InfiniteLoop";
import LiveMarkdown from "./components/LiveMarkdown";
import Parent from "./components/Parent";
import { ProductList } from "./components/ProductList";
import { ProductSearch } from "./components/ProductSearch";
import { RefVsState } from "./components/RefVsState";
import { StaleCounter } from "./components/StaleCounter";
import { Stopwatch } from "./components/Stopwatch";
import StopWatchPro from "./components/StopWatchPro";
import { TagFilter } from "./components/TagFilter";
import { TaskList } from "./components/TaskList";
import { TodoApp } from "./components/TodoApp";
import { TodoList } from "./components/TodoList";
import { UncontrolledForm } from "./components/UncontrolledForm";

function App() {
  return (
    <>
      {/* <Parent /> */}
      {/* <ProductList/> */}
      {/* <TaskList/> */}
      {/* <Dashboard/> */}
      {/* <TagFilter /> */}
      {/* <TodoList /> */}
      {/* <ControlledForm/> */}
      {/* <UncontrolledForm/> */}
      {/* <LiveMarkdown/>  */}
      {/* <TodoApp/> */}
      {/* <Counter/> */}
      {/* <InfiniteLoop1/> */}
      {/* <StaleCounter/> */}
      {/* <RefVsState/> */}
      {/* <Stopwatch/> */}
      {/* <StopWatchPro/> */}
      {/* Day 16 — useDeferredValue */}
      {/* <SearchWithLag/> */}
      {/* <SearchOptimized /> */}
      <SearchDebounced/>
      
      {/* <ProductSearch/> */}

    </>
  );
}

export default App;
