module.exports = {
  env: {
    browser: true,
    es2020: true,
    node: true,
    mocha: true,
    jquery: true
  },
  extends: [
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 11,
    sourceType: 'module',
  },
  rules: {
    'comma-dangle': 'off',
    'no-unused-vars': ['error', {
      varsIgnorePattern: '^(debug|log|tag)$'
    }]
  },
};
