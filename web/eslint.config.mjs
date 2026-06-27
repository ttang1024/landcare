import next from "eslint-config-next";

// Flat config (ESLint 9). `eslint-config-next` already bundles the
// next, next/typescript, and core-web-vitals rule sets plus base ignores.
const config = [
  ...next,
  {
    ignores: [".next/**", "node_modules/**", "playwright-report/**", "test-results/**"],
  },
];

export default config;
