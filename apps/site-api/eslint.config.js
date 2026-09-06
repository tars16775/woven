import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "._*"] },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: { "@typescript-eslint/consistent-type-imports": "error", "@typescript-eslint/require-await": "off", "@typescript-eslint/no-floating-promises": "error" },
  },
);
