import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      ".next/**",
      ".agents/**",
      ".github/agents/**",
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "src/lib/api/generated/**"
    ]
  }
];

export default eslintConfig;
