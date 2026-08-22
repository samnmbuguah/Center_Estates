/**
 * Center Estates Design Tokens
 * 
 * Single source of truth for all colors, spacing, and typography.
 * Used by both MUI theme and CSS variables.
 * 
 * Color palette:
 * - Brand: Red (#dc2626) — primary CTA, active states
 * - Neutrals: Slate scale (#f8fafc → #020617) — backgrounds, text, borders
 * - Semantic: Green (success), Amber (warning), Red (error), Blue (info)
 */

// ─── BRAND COLORS ───
export const brand = {
  primary: '#dc2626',
  primaryHover: '#b91c1c',
  primaryLight: '#fee2e2',
  primaryDark: '#991b1b',
} as const;

// ─── NEUTRAL SCALE (Slate) ───
export const slate = {
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
  950: '#020617',
} as const;

// ─── SEMANTIC COLORS ───
export const semantic = {
  success: { main: '#16a34a', light: '#dcfce7', dark: '#15803d' },
  warning: { main: '#d97706', light: '#fef3c7', dark: '#b45309' },
  error: { main: '#dc2626', light: '#fee2e2', dark: '#b91c1c' },
  info: { main: '#2563eb', light: '#dbeafe', dark: '#1d4ed8' },
} as const;

// ─── LIGHT THEME ───
export const lightTheme = {
  bg: {
    app: slate[50],
    surface: '#ffffff',
    sidebar: slate[900],
    sidebarHover: slate[800],
    muted: slate[100],
  },
  text: {
    primary: slate[900],
    secondary: slate[600],
    muted: slate[400],
    inverse: '#ffffff',
    onBrand: '#ffffff',
  },
  border: {
    default: slate[200],
    subtle: slate[100],
    strong: slate[300],
  },
  brand: brand.primary,
} as const;

// ─── DARK THEME ───
export const darkTheme = {
  bg: {
    app: slate[950],
    surface: slate[800],
    sidebar: '#000000',
    sidebarHover: slate[900],
    muted: slate[700],
  },
  text: {
    primary: slate[50],
    secondary: slate[300],
    muted: slate[500],
    inverse: slate[900],
    onBrand: '#ffffff',
  },
  border: {
    default: slate[700],
    subtle: slate[700],
    strong: slate[600],
  },
  brand: '#ef4444', // Lighter red for dark mode
} as const;

// ─── MUI THEME PALETTE ───
export function getMuiPalette(mode: 'light' | 'dark') {
  const t = mode === 'light' ? lightTheme : darkTheme;
  return {
    mode,
    primary: {
      main: t.brand,
      light: mode === 'light' ? '#ef4444' : '#f87171',
      dark: mode === 'light' ? '#b91c1c' : '#dc2626',
      contrastText: '#ffffff',
    },
    secondary: {
      main: slate[900],
      light: slate[700],
      dark: slate[950],
      contrastText: '#ffffff',
    },
    background: {
      default: t.bg.app,
      paper: t.bg.surface,
    },
    text: {
      primary: t.text.primary,
      secondary: t.text.secondary,
      disabled: t.text.muted,
    },
    divider: t.border.default,
    info: { main: semantic.info.main },
    success: { main: semantic.success.main },
    warning: { main: semantic.warning.main },
    error: { main: semantic.error.main },
  };
}
