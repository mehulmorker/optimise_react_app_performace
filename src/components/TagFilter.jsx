import React, { useMemo, useState } from "react";

/**
 * Here when count is change, it cause re render, that also calculate the
 * filtered tags function again. if there were 10000 tags then on every render it
 * will slow down re render. it is also waste as count has nothing to do with
 * filtererd tags. to avoid heavy computation, we use useMemo which trigger function only when
 * it's dep change.
 */

export function TagFilter() {
  const [search, setSearch] = useState("");
  const [count, setCount] = useState(0);

  const allTags = ["React", "Vue", "Angular"];

  //   const filteredTags = allTags.filter((tag) =>
  //     tag.toLowerCase().includes(search.toLowerCase()),
  //   );

  const filteredTags = useMemo(() => {
    return allTags.filter((tag) =>
      tag.toLowerCase().includes(search.toLowerCase()),
    );
  }, [search]);

  return (
    <>
      <input value={search} onChange={(e) => setSearch(e.target.value)} />
      <button onClick={() => setCount((c) => c + 1)}>Count {count}</button>
      <TagList tags={filteredTags} />
    </>
  );
}

const TagList = React.memo(function TagList({ tags }) {
  console.log("TagList rendered, count:", tags.length);
  return (
    <div>
      {tags.map((t) => (
        <span key={t}>{t}</span>
      ))}
    </div>
  );
});
