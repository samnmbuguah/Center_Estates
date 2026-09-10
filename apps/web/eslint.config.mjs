import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The ERP was migrated from a large dynamic Monitoring codebase. Keep the
    // migration debt visible without allowing it to block correctness checks.
    // New and touched code should prefer unknown/narrowed API row types and
    // event-driven state; these warnings are tracked down incrementally.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      // Design-system guard: prefer CSS variables over raw hex colours in
      // inline styles. Pure white/black are allowed (text on coloured chrome)
      // and SVG presentation attributes are intentionally excluded because
      // var() does not resolve there.
      "no-restricted-syntax": ["warn",
        {
          selector: "JSXAttribute[name.name='style'] Literal[value=/^#(?!(?:fff|ffffff|000|000000)$)(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
          message: "Use a design token (var(--...)) instead of a raw hex colour in inline styles.",
        },
        {
          selector: "JSXAttribute[name.name='sx'] Literal[value=/^#(?!(?:fff|ffffff|000|000000)$)(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
          message: "Use a design token (var(--...)) instead of a raw hex colour in sx styles.",
        },
      ],
    },
  },
  {
    files: ["jest.config.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    files: ["src/components/monitoring/**/*.{ts,tsx}"],
    rules: { "react/no-unescaped-entities": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "coverage/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
