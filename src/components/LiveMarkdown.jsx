import React, { useState } from "react";
import DOMPurify from "dompurify";

function parseMarkdown(markdown) {
  // very basic example
  //   if (text.startsWith("# ")) {
  //     return `<h1>${text.slice(2)}</h1>`;
  //   }
  const clean = DOMPurify.sanitize(markdown);
  return clean;
}

export function LiveMarkdown() {
  const [markdown, setMarkdown] = useState("# Hello");

  return (
    <div style={{ display: "flex", gap: "20px" }}>
      <textarea
        rows="10"
        cols="30"
        value={markdown}
        onChange={(e) => setMarkdown(e.target.value)}
      />

      <div
        dangerouslySetInnerHTML={{
          __html: parseMarkdown(markdown),
        }}
      />
    </div>
  );
}

export default LiveMarkdown;
