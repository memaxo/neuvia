/**
 * @type {import("eslint").Linter.Config}
 */
module.exports = {
    $schema: "https://json.schemastore.org/eslintrc",
    root: true,
    extends: [
      "next/core-web-vitals",
      "plugin:@typescript-eslint/recommended",
      "prettier",
      "plugin:tailwindcss/recommended"
    ],
    plugins: ["tailwindcss", "@typescript-eslint"],
    rules: {
      "@next/next/no-html-link-for-pages": "error",
      "@next/next/no-img-element": "error",
      "@next/next/no-async-client-component": "error",
      "@next/next/no-typos": "error",
      "@next/next/no-sync-scripts": "error",
      "react/jsx-key": "error",
      "tailwindcss/no-custom-classname": "off",
      "@typescript-eslint/no-unused-vars": ["error", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],
      "@typescript-eslint/no-explicit-any": "warn"
    },
    settings: {
      tailwindcss: {
        callees: ["cn"],
        config: "tailwind.config.js"
      },
      next: {
        rootDir: ["./"]
      }
    },
    overrides: [
      {
        files: ["*.ts", "*.tsx"],
        parser: "@typescript-eslint/parser"
      }
    ],
    ignorePatterns: [
      "node_modules/",
      ".next/",
      "out/",
      "public/",
      "**/*.config.js",
      "**/*.config.mjs"
    ]
}