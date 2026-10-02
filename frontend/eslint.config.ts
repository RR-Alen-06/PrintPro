import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
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
    ignores: ["dist/**", "node_modules/**", "eslint.config.ts", "vite.config.ts"]
  },

  // ── TypeScript + React files ────────────────────────────────────────
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: tsParser as unknown as Linter.Parser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2020,
        ...globals.node
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        },
        projectService: true,
        tsconfigRootDir: rootDir,
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin as unknown as Record<string, unknown>,
      react: react as unknown as Record<string, unknown>,
      "react-hooks": reactHooks as unknown as Record<string, unknown>,
      security: security as unknown as Record<string, unknown>
    },
    rules: {
      // ── TypeScript recommended rules ────────────────────────────────
      ...tsPlugin.configs["recommended"].rules,

      // ── React ───────────────────────────────────────────────────────
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/no-unescaped-entities": "off",

      // ── React Hooks ─────────────────────────────────────────────────
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/exhaustive-deps": "off",

      // ── Security ────────────────────────────────────────────────────
      ...typedSecurity.configs.recommended.rules,
      "security/detect-object-injection": "off",

      // ── TypeScript overrides ────────────────────────────────────────
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_"
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-require-imports": "off",

      // ── General ─────────────────────────────────────────────────────
      "no-unused-vars": "off",       // superseded by @typescript-eslint/no-unused-vars
      "no-undef": "off",             // TypeScript handles this; causes false positives with TS types
      "no-console": "off"
    },
    settings: {
      react: {
        version: "detect"
      }
    }
  }
];

export default config;
