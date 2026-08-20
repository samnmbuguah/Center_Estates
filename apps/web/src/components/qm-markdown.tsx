"use client";

import { Fragment, type ReactNode } from "react";

function inline(text: string): ReactNode[] {
  // Split on bold, code, and italic markdown
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|_[^_]+_)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={index} style={{ fontWeight: 700, color: "inherit" }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={index}
          style={{
            background: "rgba(15, 23, 42, 0.08)",
            padding: "2px 6px",
            borderRadius: 4,
            fontSize: "0.82em",
            fontFamily: "monospace",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if ((part.startsWith("*") && part.endsWith("*") && part.length > 2) || (part.startsWith("_") && part.endsWith("_") && part.length > 2)) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

/** Render cleanly styled markdown for Quartermaster and Companion AI */
export function QmMarkdown({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split("\n");
  const renderedElements: ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      renderedElements.push(<div key={`space-${i}`} style={{ height: 6 }} aria-hidden="true" />);
      continue;
    }

    // Divider or ASCII underline (e.g. "====", "----", "____", "***")
    if (/^[=\-_*]{3,}$/.test(line)) {
      renderedElements.push(
        <hr
          key={`hr-${i}`}
          style={{
            margin: "8px 0",
            border: "none",
            borderTop: "1px solid rgba(148, 163, 184, 0.25)",
          }}
        />
      );
      continue;
    }

    // Markdown Headings (# through ######)
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const content = heading[2];
      const fontSize =
        level === 1
          ? "1.1rem"
          : level === 2
          ? "1.02rem"
          : level === 3
          ? "0.95rem"
          : "0.88rem";
      const color = level <= 2 ? "#0f172a" : "#334155";

      renderedElements.push(
        <div
          key={`h-${i}`}
          style={{
            margin: "10px 0 4px",
            fontSize,
            fontWeight: 800,
            color,
            lineHeight: 1.3,
          }}
        >
          {inline(content)}
        </div>
      );
      continue;
    }

    // Check if next line is underline heading (e.g. Title\n====)
    if (i + 1 < lines.length && /^[=\-]{3,}$/.test(lines[i + 1].trim())) {
      renderedElements.push(
        <div
          key={`h-underlined-${i}`}
          style={{
            margin: "10px 0 4px",
            fontSize: "1.05rem",
            fontWeight: 800,
            color: "#0f172a",
            borderBottom: "1.5px solid rgba(13, 148, 136, 0.3)",
            paddingBottom: 4,
          }}
        >
          {inline(line)}
        </div>
      );
      i++; // Skip underline line
      continue;
    }

    // Bullet points (-, *, +, •)
    const bullet = line.match(/^[-*+•]\s+(.+)$/);
    if (bullet) {
      renderedElements.push(
        <div
          key={`bullet-${i}`}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            margin: "3px 0",
            paddingLeft: 4,
          }}
        >
          <span
            style={{
              color: "#0d9488",
              fontWeight: 800,
              lineHeight: 1.4,
              userSelect: "none",
            }}
            aria-hidden="true"
          >
            •
          </span>
          <span style={{ flex: 1 }}>{inline(bullet[1])}</span>
        </div>
      );
      continue;
    }

    // Numbered list
    const numbered = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (numbered) {
      renderedElements.push(
        <div
          key={`num-${i}`}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            margin: "3px 0",
            paddingLeft: 4,
          }}
        >
          <span
            style={{
              color: "#0d9488",
              fontWeight: 700,
              fontSize: "0.85em",
              minWidth: 16,
              userSelect: "none",
            }}
          >
            {numbered[1]}.
          </span>
          <span style={{ flex: 1 }}>{inline(numbered[2])}</span>
        </div>
      );
      continue;
    }

    // Blockquote
    const quote = line.match(/^>\s*(.+)$/);
    if (quote) {
      renderedElements.push(
        <div
          key={`quote-${i}`}
          style={{
            margin: "6px 0",
            padding: "6px 12px",
            borderLeft: "3px solid #0d9488",
            background: "rgba(13, 148, 136, 0.06)",
            borderRadius: "0 6px 6px 0",
            fontSize: "0.85rem",
            color: "#334155",
            fontStyle: "italic",
          }}
        >
          {inline(quote[1])}
        </div>
      );
      continue;
    }

    // Regular paragraph / metric line
    renderedElements.push(
      <div key={`p-${i}`} style={{ margin: "3px 0", lineHeight: 1.6 }}>
        {inline(line)}
      </div>
    );
  }

  return (
    <div
      style={{
        lineHeight: 1.65,
        fontSize: "0.875rem",
        overflowWrap: "anywhere",
        color: "inherit",
      }}
    >
      {renderedElements}
    </div>
  );
}
