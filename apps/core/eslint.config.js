import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "._*"] },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      // Fastify plugins and route handlers are async by contract even when they do not await.
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { arguments: false } }],
      // ADR 0005: the core has no network egress of its own. Only the Gate client may reach out.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "node:http", importNames: ["request", "get"], message: "Outbound HTTP goes through the Gate client." },
            { name: "node:https", importNames: ["request", "get"], message: "Outbound HTTP goes through the Gate client." },
            { name: "undici", message: "Outbound HTTP goes through the Gate client." },
            { name: "axios", message: "Outbound HTTP goes through the Gate client." },
          ],
        },
      ],
    },
  },
  { files: ["eslint.config.js", "tsup.config.ts", "vitest.config.ts"], extends: [tseslint.configs.disableTypeChecked] },
);
