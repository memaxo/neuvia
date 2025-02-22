/**
 * @type {import("eslint").Linter.Config}
 */
module.exports = {
  $schema: 'https://json.schemastore.org/eslintrc',
  root: true,
  extends: [
    'next/core-web-vitals',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'plugin:tailwindcss/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:jsx-a11y/recommended',
    'plugin:promise/recommended',
    'plugin:jest/recommended',
    'plugin:@tanstack/query/recommended',
  ],
  plugins: [
    'tailwindcss',
    '@typescript-eslint',
    'import',
    'jsx-a11y',
    'simple-import-sort',
    'promise',
    'jest',
    '@tanstack/query'
  ],
  parserOptions: {
    tsconfigRootDir: __dirname,
  },
  rules: {
    // Next.js specific rules
    '@next/next/no-html-link-for-pages': 'error',
    '@next/next/no-img-element': 'error',
    '@next/next/no-async-client-component': 'error',
    '@next/next/no-typos': 'error',
    '@next/next/no-sync-scripts': 'error',

    // React specific rules
    'react/jsx-key': 'error',
    'react/display-name': 'warn',
    'react/jsx-no-bind': 'warn',
    'react/no-danger': 'error',
    'react/jsx-sort-props': 'warn',
    'react/jsx-no-useless-fragment': 'warn',
    'react/no-array-index-key': 'warn',

    // React Hooks rules (included via next/core-web-vitals)
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // Basic TypeScript rules (non type-aware)
    '@typescript-eslint/no-unused-vars': [
      'warn', // Downgraded to warning
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/consistent-type-imports': 'warn', // Downgraded to warning

    // Tailwind rules
    'tailwindcss/no-contradicting-classname': 'error',

    // Import and module rules
    'import/no-unresolved': 'error',
    'import/named': 'error',
    'import/namespace': 'error',
    'import/default': 'error',
    'import/export': 'error',
    'import/order': ['error', { 
      'alphabetize': { 
        'order': 'asc', 
        'caseInsensitive': true 
      },
      'groups': [
        'builtin',
        'external',
        'internal',
        'parent',
        'sibling',
        'index'
      ],
      'newlines-between': 'always'
    }],
    'import/newline-after-import': 'error',
    'import/no-duplicates': 'error',
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: [
          'test/**/*',
          'tests/**/*',
          '**/*.test.ts',
          '**/*.test.tsx',
          '**/*.spec.ts',
          '**/*.spec.tsx',
          'vitest.config.ts',
          'tailwind.config.js',
          'postcss.config.js'
        ]
      }
    ],
    'import/no-cycle': 'warn',
    'import/no-self-import': 'error',
    'import/no-useless-path-segments': 'error',

    // Core JavaScript rules
    'no-console': 'warn',
    'no-debugger': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': 'error',
    'object-shorthand': 'error',
    'prefer-template': 'error',
    'jsx-quotes': ['error', 'prefer-double'],

    // Accessibility rules
    'jsx-a11y/anchor-is-valid': 'error',
    'jsx-a11y/alt-text': 'error',
    'jsx-a11y/no-static-element-interactions': 'warn',

    // Promise rules
    'promise/always-return': 'error',
    'promise/no-return-wrap': 'error',
    'promise/catch-or-return': 'error',
    'promise/no-nesting': 'warn',
    'promise/prefer-await-to-then': 'warn',

    // TanStack Query rules
    '@tanstack/query/exhaustive-deps': 'error',
    '@tanstack/query/stable-query-client': 'error',

    // Jest rules
    'jest/no-disabled-tests': 'warn',
    'jest/no-focused-tests': 'error',
    'jest/no-identical-title': 'error',
    'jest/valid-expect': 'error',

    // Restricted imports
    'no-restricted-imports': [
      'error',
      {
        'paths': [
          {
            'name': 'lodash',
            'message': 'Please use lodash-es or individual lodash modules instead.'
          }
        ]
      }
    ]
  },
  settings: {
    tailwindcss: {
      callees: ['cn'],
      config: 'tailwind.config.js',
    },
    next: {
      rootDir: ['./'],
    },
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx']
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json'
      }
    }
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
      rules: {
        '@typescript-eslint/no-floating-promises': 'warn',
        '@typescript-eslint/strict-boolean-expressions': 'warn',
        '@typescript-eslint/no-misused-promises': 'warn',
      }
    },
    {
      files: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
      extends: ['plugin:jest/recommended'],
    }
  ],
  ignorePatterns: [
    'node_modules/',
    '.next/',
    'out/',
    'public/',
    '**/*.config.js',
    '**/*.config.mjs',
  ],
  // Add note about max-warnings usage
  // To use max-warnings in your scripts, add: eslint . --max-warnings=50
}
