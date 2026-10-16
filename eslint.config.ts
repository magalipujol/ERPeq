import eslintReact from '@eslint-react/eslint-plugin'
import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import playwright from 'eslint-plugin-playwright'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import vitest from '@vitest/eslint-plugin'

export default defineConfig(
  globalIgnores(['dist', 'playwright-report', 'test-results', 'herramientas']),

  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
  },

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Núcleo de ESLint
      'eqeqeq': ['error', 'always'],
      'no-console': 'error',
      'no-alert': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'off', // la reemplaza @typescript-eslint/no-implied-eval
      'no-new-func': 'error',
      'no-param-reassign': 'error',
      'no-return-assign': 'error',
      'no-self-compare': 'error',
      'no-sequences': 'error',
      'no-template-curly-in-string': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unneeded-ternary': 'error',
      'no-useless-concat': 'error',
      'no-useless-rename': 'error',
      'no-useless-return': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-const': 'error',
      'prefer-template': 'error',
      'radix': 'error',
      'curly': ['error', 'multi-line'],

      // typescript-eslint, más allá de strict + stylistic
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-shadow': 'error',
      // `_` marca a propósito lo que no se usa (p. ej. fixtures de Playwright pedidos solo por su efecto).
      '@typescript-eslint/no-unused-vars': ['error', {
        args: 'all', argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'all', ignoreRestSiblings: false,
      }],
      '@typescript-eslint/no-unnecessary-qualifier': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/promise-function-async': 'error',
      '@typescript-eslint/require-array-sort-compare': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      // Números en `${}` son seguros; strict los prohíbe y obliga a envolver todo en String().
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/strict-boolean-expressions': ['error', {
        allowString: true,
        allowNumber: false,
        allowNullableObject: true,
        allowNullableBoolean: false,
        allowNullableString: true,
        allowNullableNumber: false,
        allowAny: false,
      }],
    },
  },

  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      eslintReact.configs['strict-type-checked'],
      eslintReact.configs['disable-conflict-eslint-plugin-react-hooks'],
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.strict,
    ],
    languageOptions: { globals: globals.browser },
  },

  {
    files: ['src/**/*.test.ts'],
    extends: [vitest.configs.all],
    rules: {
      // Solo tiene sentido en pruebas asíncronas, donde un expect puede no ejecutarse nunca.
      'vitest/prefer-expect-assertions': ['error', { onlyFunctionsWithAsyncKeyword: true }],
      // Los relojes falsos se arman y desarman en hooks.
      'vitest/no-hooks': ['error', { allow: ['beforeEach', 'afterEach'] }],
    },
  },

  {
    files: ['tests/**/*.ts'],
    extends: [playwright.configs['flat/recommended']],
    languageOptions: { globals: globals.node },
    rules: {
      'playwright/no-conditional-in-test': 'error',
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-force-option': 'error',
      'playwright/no-raw-locators': 'error',
      'playwright/prefer-web-first-assertions': 'error',
      'playwright/prefer-to-have-count': 'error',
      'playwright/prefer-to-have-length': 'error',
      'playwright/require-top-level-describe': 'off',
    },
  },

  {
    files: ['*.config.{ts,cjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
    extends: [tseslint.configs.disableTypeChecked],
  },
)
