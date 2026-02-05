const prettier = require('eslint-plugin-prettier')
const eslintConfigPrettier = require('eslint-config-prettier')

module.exports = [
  // Ignore patterns
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/logs/**',
      '**/uploads/**',
      '**/*.min.js',
      '.husky/**',
    ],
  },

  // Main config
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        // Node.js globals
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        Buffer: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        global: 'readonly',

        // Jest globals (for test files)
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        jest: 'readonly',
      },
    },
    plugins: {
      prettier,
    },
    rules: {
      // Prettier integration
      ...eslintConfigPrettier.rules,
      'prettier/prettier': 'error',

      // ============================================
      // BEST PRACTICES
      // ============================================

      // Variables
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-undef': 'error',
      'no-var': 'error', // Use let/const instead
      'prefer-const': 'error', // Use const when variable is never reassigned
      'no-const-assign': 'error',

      // Comparison
      eqeqeq: ['error', 'always'], // Require === and !==
      'no-eq-null': 'error',

      // Errors
      'no-throw-literal': 'error', // Throw Error objects only
      'no-unreachable': 'error',
      'no-unsafe-finally': 'error',

      // Code quality
      'no-duplicate-imports': 'error',
      'no-lonely-if': 'warn',
      'no-else-return': 'warn',
      'no-useless-return': 'warn',
      'no-useless-catch': 'warn',
      'no-useless-concat': 'warn',
      'prefer-template': 'warn', // Use template literals over string concatenation
      'prefer-arrow-callback': 'warn',

      // Console
      'no-console': 'warn', // Warn but don't error

      // Async/await
      'no-async-promise-executor': 'error',
      'require-await': 'warn',
      'no-return-await': 'error',

      // Best practices
      curly: ['error', 'all'], // Require curly braces for all control statements
      'default-case': 'warn',
      'default-case-last': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-param-reassign': 'warn',
      'no-self-compare': 'error',
      'no-sequences': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-loop-func': 'error',

      // ============================================
      // SECURITY
      // ============================================
      'no-new-require': 'error',
      'no-path-concat': 'error',

      // ============================================
      // NODE.JS SPECIFIC
      // ============================================
      'handle-callback-err': 'error',
      'no-mixed-requires': 'warn',
      'no-process-exit': 'warn',

      // ============================================
      // STYLE (handled by Prettier, but some logic rules)
      // ============================================
      'no-nested-ternary': 'warn',
      'no-unneeded-ternary': 'warn',
      'prefer-exponentiation-operator': 'warn',
      'prefer-numeric-literals': 'warn',
      'prefer-object-spread': 'warn',

      // ============================================
      // TURN OFF (handled by Prettier or too strict)
      // ============================================
      'no-shadow': 'off', // Can be too restrictive
      'consistent-return': 'off', // Can be too strict
    },
  },
]
