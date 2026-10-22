import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["@/modules/*/*"],
          message: "Import a feature module through its public API: @/modules/<feature>.",
        }],
      }],
    },
  },
  {
    ignores: [".next/**", ".open-next/**", ".wrangler/**", "freebuff-sites-build/**", "freebuff.open-next.config.ts", "coverage/**", "node_modules/**", "public/sw.js"],
  },
];

export default config;
