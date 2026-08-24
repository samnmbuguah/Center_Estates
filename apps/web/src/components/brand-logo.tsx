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
  brandName = "CeEst",
  tagline = "Estate ERP",
  logoUrl,
  primaryColor = "#e52e2e",
}: {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  href?: string;
  dark?: boolean;
  brandName?: string;
  tagline?: string;
  logoUrl?: string;
  primaryColor?: string;
}) {
  const dims = { sm: 30, md: 38, lg: 48 };
  const d = dims[size];
  const wordmarkColor = dark ? "#ffffff" : "var(--text)";
  const subColor = dark ? "#ef4444" : "var(--muted)";
  const customLogo = Boolean(logoUrl);

  const inner = (
    <>
      <div
        style={{
          width: customLogo ? Math.round(d * 3.8) : d,
          height: d,
          borderRadius: Math.round(d * 0.28),
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          background: customLogo ? "#ffffff" : `linear-gradient(145deg, ${primaryColor}, #7f1d1d)`,
          boxShadow: `0 ${Math.round(d * 0.12)}px ${Math.round(d * 0.3)}px rgba(229,46,46,0.35)`,
          color: "#fff",
          fontWeight: 900,
          fontSize: Math.round(d * 0.42),
          letterSpacing: "-0.02em",
        }}
      >
        <img src={logoUrl || "/center-estates-logo.png"} alt={brandName} width={customLogo ? Math.round(d * 3.8) : d} height={d} loading="eager" decoding="async" style={{ width: "100%", height: "100%", objectFit: customLogo ? "contain" : "cover", objectPosition: "center", borderRadius: "inherit", display: "block", background: "#fff" }} />
      </div>
      {showWordmark && !customLogo && (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1, minWidth: 0, marginLeft: 2 }}>
          <span style={{ fontSize: size === "lg" ? 18 : 15, fontWeight: 900, color: wordmarkColor, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
            {brandName}
          </span>
          <span style={{ fontSize: size === "lg" ? 10 : 9, fontWeight: 800, color: subColor, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap", marginTop: -1 }}>
            {tagline}
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
