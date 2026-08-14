"use client";

import { Fragment, type ReactNode } from "react";

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} style={{ background: "var(--surface-3)", padding: "1px 5px", borderRadius: 4 }}>{part.slice(1, -1)}</code>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

/** Render the small markdown subset QM uses without injecting provider HTML. */
export function QmMarkdown({ text }: { text: string }) {
  return (
    <div style={{ lineHeight: 1.65, fontSize: "0.875rem", overflowWrap: "anywhere" }}>
      {text.split("\n").map((raw, index) => {
        const line = raw.trim();
        if (!line) return <div key={index} style={{ height: 6 }} aria-hidden="true" />;
        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        if (heading) {
          const size = heading[1].length === 1 ? "1.08rem" : heading[1].length === 2 ? "1rem" : ".92rem";
          return <div key={index} style={{ margin: "8px 0 3px", fontSize: size, fontWeight: 850 }}>{inline(heading[2])}</div>;
        }
        const bullet = line.match(/^[-*]\s+(.+)$/);
        if (bullet) return <div key={index} style={{ display: "flex", gap: 8, margin: "2px 0" }}><span aria-hidden="true">•</span><span>{inline(bullet[1])}</span></div>;
        const numbered = line.match(/^(\d+)\.\s+(.+)$/);
        if (numbered) return <div key={index} style={{ display: "flex", gap: 8, margin: "2px 0" }}><span>{numbered[1]}.</span><span>{inline(numbered[2])}</span></div>;
        return <div key={index} style={{ margin: "3px 0" }}>{inline(line)}</div>;
      })}
    </div>
  );
}
