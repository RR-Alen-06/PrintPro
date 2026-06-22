const security = require('eslint-plugin-security');

module.exports = [
  {
    ignores: ["node_modules/**", "dist/**"]
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        console: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        Buffer: "readonly",
        Date: "readonly",
        Math: "readonly",
        Error: "readonly",
        parseInt: "readonly",
        parseFloat: "readonly",
        JSON: "readonly"
      }
    },
    plugins: {
      security: security
    },
    rules: {
      ...security.configs.recommended.rules,
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-console": "warn"
    }
  }
];
