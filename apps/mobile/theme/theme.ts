/**
 * Design tokens — light mode default with brand colors: white, red, black, grey.
 * High contrast for outdoor/glare readability. Large touch targets (44pt min).
 *
 * WCAG 2.1 AA compliance targets:
 *   - Normal text: 4.5:1 minimum contrast ratio
 *   - Large text (>=18pt bold or >=24pt): 3:1 minimum
 *   - Touch targets: minimum 44x44pt
 *   - Focus indicators: 2px outline
 */
export const MIN_TOUCH_SIZE = 44;

/** Align with desktop brand: Center Estates navy + cyan primary, red for danger only. */
export const colors = {
  bg: "#f8fafc",
  surface: "#ffffff",
  surfaceAlt: "#f1f5f9",
  surface3: "#e2e8f0",
  border: "#cbd5e1",
  borderStrong: "#94a3b8",
  text: "#0f172a",
  textMuted: "#334155",
  textHighContrast: "#000000",
  faint: "#64748b",
  primary: "#0284c7",
  primary2: "#00a3ff",
  primaryText: "#ffffff",
  steel: "#374151",
  success: "#16a34a",
  successText: "#ffffff",
  warning: "#d97706",
  warningText: "#ffffff",
  danger: "#dc2626",
  dangerText: "#ffffff",
  accentRed: "#d92d2d",
  inside: "#16a34a",
  outside: "#dc2626",
  unknown: "#6b7280",
  highContrast: {
    bg: "#ffffff",
    surface: "#f0f1f4",
    surfaceAlt: "#e4e5e9",
    text: "#000000",
    textMuted: "#374151",
    primary: "#0369a1",
    primaryText: "#ffffff",
    border: "#9ca3af",
    borderStrong: "#6b7280",
  },
} as const;

export const reducedMotion = {
  scale: "0.95" as const,
  duration: 0 as const,
};

export const gradients = {
  amber: ["#0284c7", "#00a3ff"] as const,
  hero: ["#f1f5f9", "#ffffff"] as const,
  danger: ["#dc2626", "#ef4444"] as const,
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20 } as const;

export const typography = {
  title: { fontSize: 24, fontWeight: "800" as const, color: colors.text, letterSpacing: -0.4 },
  heading: { fontSize: 17, fontWeight: "700" as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
} as const;
