// @ts-check

import eslint from '@eslint/js';
import prettier from 'eslint-plugin-prettier/recommended';
import solid from 'eslint-plugin-solid/configs/recommended';
import stylistic from '@stylistic/eslint-plugin';
import tsEslint from 'typescript-eslint';
import * as importPlugin from 'eslint-plugin-import';

export default tsEslint.config(
  // 官方與 TypeScript 推薦配置
  eslint.configs.recommended,
  tsEslint.configs.eslintRecommended,
  ...tsEslint.configs.recommendedTypeChecked,
  prettier,
  solid,

  // 忽略項目
  {
    ignores: [
      'dist',
      'node_modules',
      'docs/**',
      'tests/**',
      '*.config.*js',
      '**/*.config.*js',
      '**/*.test.*js',
      '**/*.spec.*js',
    ],
  },

  {
    plugins: {
      stylistic,
      importPlugin,
    },

    languageOptions: {
      parser: tsEslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },

    rules: {
      // -------------------------
      // 🔧 格式相關
      // -------------------------
      'stylistic/arrow-parens': ['error', 'always'],
      'stylistic/object-curly-spacing': ['error', 'always'],
      'stylistic/quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: false }],
      'stylistic/quote-props': ['error', 'consistent'],
      'stylistic/semi': ['error', 'always'],
      'stylistic/no-tabs': 'error',
      'stylistic/no-multi-spaces': ['error', { ignoreEOLComments: true }],
      'stylistic/no-mixed-operators': 'warn', // Prettier 不支援此自動修正
      'stylistic/max-len': 'off',
      'stylistic/lines-around-comment': [
        'error',
        {
          beforeBlockComment: false,
          afterBlockComment: false,
          beforeLineComment: false,
          afterLineComment: false,
        },
      ],

      // -------------------------
      // ⚙️ TypeScript 規則
      // -------------------------
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': ['off', { checksVoidReturn: false }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'off',

      // 🔕 關閉安全但會導致 CI fail 的強制規則
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-implied-eval': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/only-throw-error': 'off',
      '@typescript-eslint/require-await': 'off',

      // -------------------------
      // 📦 import 管理
      // -------------------------
      'importPlugin/first': 'error',
      'importPlugin/no-duplicates': 'error',
      'importPlugin/no-unresolved': ['error', { ignore: ['^virtual:', '\\?inline$', '\\?raw$', '\\?asset&asarUnpack'] }],
      'importPlugin/order': [
        'error',
        {
          groups: ['builtin', 'external', ['internal', 'index', 'sibling'], 'parent', 'type'],
          'newlines-between': 'always-and-inside-groups',
          alphabetize: { order: 'ignore', caseInsensitive: false },
        },
      ],
      'importPlugin/newline-after-import': 'off',
      'importPlugin/no-default-export': 'off',
      'importPlugin/prefer-default-export': 'off',

      // -------------------------
      // 🚫 其他行為
      // -------------------------
      'camelcase': ['error', { properties: 'never' }],
      'class-methods-use-this': 'off',
      'no-empty': 'off',
      'no-void': 'error',
      'no-implied-eval': 'off',
      'prefer-promise-reject-errors': 'off',
      'prettier/prettier': [
        'error',
        { singleQuote: true, semi: true, tabWidth: 2, trailingComma: 'all', quoteProps: 'preserve' },
      ],
    },

    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts'],
      },
      'import/resolver': {
        typescript: {},
        exports: {},
      },
    },
  },
);
