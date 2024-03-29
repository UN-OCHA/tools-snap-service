module.exports = {
  env: {
    browser: false,
    es6: true,
  },
  extends: 'airbnb-base',
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {
    "no-plusplus": "off",
    "no-promise-executor-return": "off",
    "no-underscore-dangle": "off",
    "prefer-destructuring": "off",
    "consistent-return": "off",
    "max-len": [2, {
      code: 110,
      comments: 80,
      ignoreTrailingComments: true,
      ignoreUrls: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
    }],
  },
};
