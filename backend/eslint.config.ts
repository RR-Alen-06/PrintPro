import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
// @ts-expect-error - eslint-plugin-security does not provide TypeScript types
import security from 'eslint-plugin-security';
import globals from 'globals';
import type { Linter } from 'eslint';

interface SecurityPlugin {
  configs: {
    recommended: {
      rules: Linter.RulesRecord;
    };
  };
}

const typedSecurity = security as unknown as SecurityPlugin;
const rootDir = new URL('.', import.meta.url).pathname;

const config: Linter.Config[] = [
  {
    ignores: ["dist/**", "node_modules/**", "eslint.config.ts"]
  },
  {
    files: ["**/*.{ts,js}"],
    languageOptions: {
      parser: tsParser as unknown as Linter.Parser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.es2022
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: rootDir,
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin as unknown as Record<string, unknown>,
      security: security as unknown as Record<string, unknown>
    },
    rules: {
      // ── TypeScript recommended rules ────────────────────────────────
      ...tsPlugin.configs["recommended"].rules,

      // ── Security plugin rules ───────────────────────────────────────
      ...typedSecurity.configs.recommended.rules,
      "security/detect-object-injection": "off",

      // ── TypeScript overrides ────────────────────────────────────────
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_"
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "off",

      // ── General ─────────────────────────────────────────────────────
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-console": "off"
    }
  }
];

export default config;
