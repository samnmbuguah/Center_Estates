"use client";

import Link from "next/link";

/**
 * Shared brand logo — a consistent "CE" monogram badge + optional wordmark.
 * Used across sidebar, topbar, login and marketing so the mark never drifts.
 */
export function BrandLogo({
  size = "sm",
  showWordmark = true,
  href,
  dark = true,
}: {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  href?: string;
  dark?: boolean;
}) {
  const dims = { sm: 30, md: 38, lg: 48 };
  const d = dims[size];
  const wordmarkColor = dark ? "#ffffff" : "var(--text)";
  const subColor = dark ? "#ef4444" : "var(--muted)";

  const inner = (
    <>
      <div
        aria-hidden="true"
        style={{
          width: d,
          height: d,
          borderRadius: Math.round(d * 0.28),
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(145deg, #e52e2e, #b91c1c)",
          boxShadow: `0 ${Math.round(d * 0.12)}px ${Math.round(d * 0.3)}px rgba(229,46,46,0.35)`,
          color: "#fff",
          fontWeight: 900,
          fontSize: Math.round(d * 0.42),
          letterSpacing: "-0.02em",
        }}
      >
        <svg viewBox="0 0 48 48" role="img" aria-label="Center Estates" width={d} height={d} style={{ display: "block" }}>
          <path d="M6 28c0-10 8-18 18-18s18 8 18 18L24 44 6 28Z" fill="#d51f29" />
          <path d="M17 12 24 7l7 5v24l-7 5-7-5V12Z" fill="#727285" />
          <path d="M21 14h6v4h-6zm0 7h6v4h-6zm0 7h6v4h-6zm0 7h6v4h-6z" fill="#fff" />
        </svg>
      </div>
      {showWordmark && (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1, minWidth: 0, marginLeft: 2 }}>
          <span style={{ fontSize: size === "lg" ? 18 : 15, fontWeight: 900, color: wordmarkColor, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
            Center Estates
          </span>
          <span style={{ fontSize: size === "lg" ? 10 : 9, fontWeight: 800, color: subColor, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap", marginTop: -1 }}>
            Estate ERP
          </span>
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", minWidth: 0 }}>
        {inner}
      </Link>
    );
  }
  return <div style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>{inner}</div>;
}
