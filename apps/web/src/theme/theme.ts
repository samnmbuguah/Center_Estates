import { createTheme, ThemeOptions } from '@mui/material/styles';
import { getMuiPalette } from './tokens';

export const getTheme = (mode: 'light' | 'dark') => {
  const palette = getMuiPalette(mode);

  const themeOptions: ThemeOptions = {
    palette,
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: { fontSize: '2rem', fontWeight: 800, lineHeight: 1.2 },
      h2: { fontSize: '1.75rem', fontWeight: 800, lineHeight: 1.3 },
      h3: { fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.4 },
      h4: { fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.4 },
      h5: { fontSize: '1.125rem', fontWeight: 700, lineHeight: 1.5 },
      h6: { fontSize: '1rem', fontWeight: 700, lineHeight: 1.5 },
      subtitle1: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.5 },
      subtitle2: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.5 },
      body1: { fontSize: '1rem', fontWeight: 500, lineHeight: 1.5 },
      body2: { fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.5 },
      button: { fontSize: '0.875rem', fontWeight: 700, textTransform: 'none' },
      caption: { fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.4 },
      overline: { fontSize: '0.8125rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1.4 },
    },
    spacing: 8,
    components: {
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 8, textTransform: 'none', fontWeight: 600 },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: mode === 'light'
              ? '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)'
              : '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
          },
        },
      },
      MuiChip: { styleOverrides: { root: { borderRadius: 6 } } },
      MuiTextField: {
        styleOverrides: {
          root: { '& .MuiOutlinedInput-root': { borderRadius: 8 } },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRight: `1px solid ${palette.divider}`,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: mode === 'light'
              ? '0 1px 3px rgba(0,0,0,0.1)'
              : '0 1px 3px rgba(0,0,0,0.4)',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: palette.divider,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 12,
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
      MuiTable: {
        styleOverrides: {
          root: {
            borderCollapse: 'separate',
            borderSpacing: 0,
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            '& th': {
              fontWeight: 700,
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: palette.text.secondary,
              borderBottom: `1px solid ${palette.divider}`,
            },
          },
        },
      },
      MuiTableBody: {
        styleOverrides: {
          root: {
            '& tr:hover': {
              backgroundColor: mode === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.04)',
            },
            '& tr': {
              borderBottom: `1px solid ${palette.divider}`,
            },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          root: {
            fontSize: '0.875rem',
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontSize: '0.875rem',
          },
        },
      },
      MuiSkeleton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            fontSize: '0.75rem',
            borderRadius: 6,
          },
        },
      },
      MuiFab: {
        styleOverrides: {
          root: {
            borderRadius: 12,
          },
        },
      },
    },
  };

  return createTheme(themeOptions);
};

export default getTheme;
