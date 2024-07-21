// .eslintrc.js
module.exports = {
    env: {
      browser: true,
      es2021: true,
      webextensions: true,
      node: true,
      jest: true,
    },
    extends: [
      'eslint:recommended',
      'plugin:prettier/recommended',
    ],
    parserOptions: {
      ecmaVersion: 12,
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'multi-line'],
      'prefer-const': 'error',
    },
  };