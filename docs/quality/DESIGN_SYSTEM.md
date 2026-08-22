# Center Estates interface design system

This document is the colour and component contract for the authenticated ERP.
Marketing pages may use richer campaign treatments, but application workspaces
must use these semantic roles so light and dark themes remain predictable.

## Palette

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| Application background | `#f8fafc` | `#071524` | Page canvas |
| Raised surface | `#ffffff` | `#162c44` | Cards, menus and dialogs |
| Default surface | `#ffffff` | `#112234` | Panels and tables |
| Sunken surface | `#f1f5f9` | `#0b1727` | Navigation rails and grouped controls |
| Primary text | `#0f172a` | `#f8fafc` | Headings, values and body text |
| Secondary text | `#334155` | `#d5deea` | Supporting copy and labels |
| Muted text | `#64748b` | `#aab8cb` | Metadata only; never critical instructions |
| Brand action | `#dc2626` | `#ef4444` | Primary actions and active indicators |
| Text link | `#b91c1c` | `#fecaca` | Small links on workspace surfaces |
| Focus ring | `#2563eb` | `#93c5fd` | Keyboard focus visibility |

Brand red is deliberately not used for body copy in dark mode. Small links use
the lighter link token to retain WCAG AA contrast against navy surfaces.

## Implementation rules

1. Use semantic CSS variables such as `var(--text-primary)`,
   `var(--surface-raised)` and `var(--border-color)`. Do not put literal black,
   white or slate colours in module components.
2. MUI components use palette roles (`text.primary`, `background.paper`,
   `divider`, `primary.main`) rather than literal colours in `sx` props.
3. Status colours communicate status only. Every status also has a text label;
   colour is never the only signal.
4. Normal text and controls target WCAG AA contrast of at least 4.5:1. Large
   display text targets at least 3:1.
5. Every interactive control needs a visible keyboard focus state in both
   themes. Motion must respect `prefers-reduced-motion`.
6. Workspace navigation has two levels: workflow group and page. View controls
   inside a page must not visually compete with the workspace navigation.

## Verification

`tests/e2e/platform.spec.ts` checks real module-navigation and Facility dashboard
foreground/background pairs in both themes. Add a selector there whenever a new
shared visual primitive is introduced.
