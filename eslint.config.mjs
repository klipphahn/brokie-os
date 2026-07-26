import next from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      "shopify-theme/**"
    ]
  },
  ...next,
  {
    rules: {
      // Newer React-compiler-era rule (eslint-plugin-react-hooks v6). The
      // existing codebase widely uses the `useEffect(() => { load(); }, [])`
      // data-loading pattern, so surface it as a warning instead of failing
      // the lint gate. Revisit if/when these effects are refactored.
      "react-hooks/set-state-in-effect": "warn"
    }
  }
];

export default config;
