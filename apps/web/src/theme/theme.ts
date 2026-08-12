import { createTheme, ThemeOptions } from '@mui/material/styles';

/**
 * Center Estates MUI Theme Configuration
 * 
 * This theme provides:
 * - Light and dark mode support with semantic color tokens
 * - WCAG-compliant contrast ratios
 * - Consistent 8px grid spacing
 * - Brand colors (CeEst Red #dc2626)
 * - Typography hierarchy
 */

export const getTheme = (mode: 'light' | 'dark') => {
  const themeOptions: ThemeOptions = {
    palette: {
      mode,
      primary: {
        main: '#dc2626', // CeEst Brand Red
        light: '#ef4444',
        dark: '#b91c1c',
        contrastText: '#ffffff',
      },
      secondary: {
        main: '#0f172a', // Slate 900
        light: '#334155',
        dark: '#020617',
        contrastText: '#ffffff',
      },
      background: {
        default: mode === 'light' ? '#f8fafc' : '#0f172a',
        paper: mode === 'light' ? '#ffffff' : '#1e293b',
      },
      text: {
        primary: mode === 'light' ? '#000000' : '#ffffff',
        secondary: mode === 'light' ? '#0f172a' : '#f8fafc',
        disabled: mode === 'light' ? '#1e293b' : '#e2e8f0',
      },
      divider: mode === 'light' ? '#cbd5e1' : '#334155',
      info: {
        main: mode === 'light' ? '#1e3a8a' : '#3b82f6',
      },
      success: {
        main: '#16a34a',
      },
      warning: {
        main: '#d97706',
      },
      error: {
        main: mode === 'light' ? '#b91c1c' : '#ef4444',
      },
    },
    shape: {
      borderRadius: 8,
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: {
        fontSize: '2rem',
        fontWeight: 800,
        lineHeight: 1.2,
      },
      h2: {
        fontSize: '1.75rem',
        fontWeight: 800,
        lineHeight: 1.3,
      },
      h3: {
        fontSize: '1.5rem',
        fontWeight: 700,
        lineHeight: 1.4,
      },
      h4: {
        fontSize: '1.25rem',
        fontWeight: 700,
        lineHeight: 1.4,
      },
      h5: {
        fontSize: '1.125rem',
        fontWeight: 700,
        lineHeight: 1.5,
      },
      h6: {
        fontSize: '1rem',
        fontWeight: 700,
        lineHeight: 1.5,
      },
      subtitle1: {
        fontSize: '1rem',
        fontWeight: 600,
        lineHeight: 1.5,
      },
      subtitle2: {
        fontSize: '0.875rem',
        fontWeight: 600,
        lineHeight: 1.5,
      },
      body1: {
        fontSize: '1rem',
        fontWeight: 500,
        lineHeight: 1.5,
      },
      body2: {
        fontSize: '0.875rem',
        fontWeight: 500,
        lineHeight: 1.5,
      },
      button: {
        fontSize: '0.875rem',
        fontWeight: 700,
        textTransform: 'none',
      },
      caption: {
        fontSize: '0.8125rem',
        fontWeight: 600,
        lineHeight: 1.4,
      },
      overline: {
        fontSize: '0.8125rem',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        lineHeight: 1.4,
      },
    },
    spacing: 8, // Base spacing unit (8px grid)
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            textTransform: 'none',
            fontWeight: 600,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: mode === 'light'
              ? '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)'
              : '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 6,
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
            },
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRight: `1px solid ${mode === 'light' ? '#e2e8f0' : '#334155'}`,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: mode === 'light'
              ? '0 1px 3px rgba(0,0,0,0.1)'
              : '0 1px 3px rgba(0,0,0,0.3)',
          },
        },
      },
    },
  };

  return createTheme(themeOptions);
};

export default getTheme;
