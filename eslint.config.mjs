import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import { defineConfig, globalIgnores } from 'eslint/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({
  baseDirectory: rootDir,
  recommendedConfig: js.configs.recommended,
});

export default defineConfig([
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    files: ['e2e/**/*.js'],
    languageOptions: {
      globals: {
        module: 'readonly',
        process: 'readonly',
        require: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // Archive payloads are versioned external JSON with several historical shapes.
    files: ['src/app/archive/**/page.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'e2e/node_modules/**',
    'e2e/playwright-report/**',
    'e2e/test-results/**',
    'cloudflare-worker/dist/**',
    'graphify-out/**',
  ]),
]);
