import { createTheme } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'indigo',
  primaryShade: { light: 6, dark: 5 },
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontFamilyMonospace: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',

  headings: {
    fontFamily: '"Inter", sans-serif',
    fontWeight: '700',
    sizes: {
      h1: { fontSize: '30px', lineHeight: '1.25', fontWeight: '800' },
      h2: { fontSize: '24px', lineHeight: '1.3',  fontWeight: '700' },
      h3: { fontSize: '19px', lineHeight: '1.35', fontWeight: '600' },
      h4: { fontSize: '16px', lineHeight: '1.4',  fontWeight: '600' },
    },
  },

  defaultRadius: 'md',
  cursorType: 'pointer',

  spacing: {
    xs: '8px',
    sm: '12px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },

  components: {
    Card: {
      defaultProps: { radius: 'lg', padding: 'xl' },
      styles: {
        root: {
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)',
          transition: 'box-shadow 200ms ease, transform 200ms ease',
        },
      },
    },

    Button: {
      defaultProps: { radius: 'md' },
      styles: {
        root: {
          fontWeight: 600,
          letterSpacing: '-0.01em',
          transition: 'all 150ms ease',
        },
      },
    },

    TextInput: {
      styles: {
        input: {
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          transition: 'border-color 150ms ease, box-shadow 150ms ease',
        },
      },
    },

    PasswordInput: {
      styles: {
        input: {
          background: 'var(--surface)',
          border: '1px solid var(--border)',
        },
      },
    },

    Select: {
      styles: {
        input: {
          background: 'var(--surface)',
          border: '1px solid var(--border)',
        },
      },
    },

    Badge: {
      defaultProps: { radius: 'sm' },
      styles: {
        root: { fontWeight: 600, letterSpacing: '0.02em' },
      },
    },

    Table: {
      defaultProps: {
        verticalSpacing: 'sm',
        horizontalSpacing: 'md',
        highlightOnHover: true,
      },
      styles: {
        th: {
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--text-tertiary)',
        },
        td: {
          fontSize: '13px',
          color: 'var(--text-primary)',
          borderBottom: '1px solid var(--border-subtle)',
        },
      },
    },

    Modal: {
      defaultProps: { radius: 'xl', overlayProps: { blur: 6, opacity: 0.4 } },
      styles: {
        content: { background: 'var(--surface)' },
        header: {
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        },
      },
    },

    Drawer: {
      styles: {
        content: { background: 'var(--surface)' },
        header: {
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        },
      },
    },

    NavLink: {
      styles: {
        root: {
          borderRadius: '8px',
          fontWeight: 500,
          transition: 'background 150ms ease, color 150ms ease',
        },
        label: { fontSize: '13.5px' },
      },
    },

    Tabs: {
      styles: {
        tab: {
          fontWeight: 600,
          fontSize: '13px',
          transition: 'color 150ms ease',
        },
      },
    },

    Tooltip: {
      defaultProps: {
        radius: 'md',
        color: 'dark',
        withArrow: true,
        arrowSize: 6,
      },
    },

    Notification: {
      styles: {
        root: {
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          borderRadius: '12px',
        },
      },
    },

    Progress: {
      defaultProps: { radius: 'xl' },
      styles: {
        root: { background: 'var(--surface-tertiary)' },
      },
    },

    Avatar: {
      defaultProps: { radius: 'md' },
    },

    Menu: {
      styles: {
        dropdown: {
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          borderRadius: '12px',
        },
        item: {
          fontSize: '13.5px',
          borderRadius: '8px',
          transition: 'background 120ms ease',
        },
      },
    },
  },

  other: {
    surfaceColor: '#F8FAFC',
  },
});