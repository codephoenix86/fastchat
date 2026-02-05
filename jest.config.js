module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',

  // Enable parallel test execution
  maxWorkers: '50%', // Use 50% of available CPU cores

  moduleNameMapper: {
    // root aliases
    '^@$': '<rootDir>/src',
    '^@/(.*)$': '<rootDir>/src/$1',

    '^@root$': '<rootDir>',
    '^@root/(.*)$': '<rootDir>/$1',

    '^@uploads$': '<rootDir>/uploads',
    '^@uploads/(.*)$': '<rootDir>/uploads/$1',

    // src subfolders
    '^@config$': '<rootDir>/src/config',
    '^@config/(.*)$': '<rootDir>/src/config/$1',

    '^@constants$': '<rootDir>/src/constants',
    '^@constants/(.*)$': '<rootDir>/src/constants/$1',

    '^@controllers$': '<rootDir>/src/controllers',
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',

    '^@docs$': '<rootDir>/docs',
    '^@docs/(.*)$': '<rootDir>/docs/$1',

    '^@middlewares$': '<rootDir>/src/middlewares',
    '^@middlewares/(.*)$': '<rootDir>/src/middlewares/$1',

    '^@models$': '<rootDir>/src/models',
    '^@models/(.*)$': '<rootDir>/src/models/$1',

    '^@repositories$': '<rootDir>/src/repositories',
    '^@repositories/(.*)$': '<rootDir>/src/repositories/$1',

    '^@routes$': '<rootDir>/src/routes',
    '^@routes/(.*)$': '<rootDir>/src/routes/$1',

    '^@services$': '<rootDir>/src/services',
    '^@services/(.*)$': '<rootDir>/src/services/$1',

    '^@sockets$': '<rootDir>/src/sockets',
    '^@sockets/(.*)$': '<rootDir>/src/sockets/$1',

    '^@tests$': '<rootDir>/tests',
    '^@tests/(.*)$': '<rootDir>/tests/$1',

    '^@utils$': '<rootDir>/src/utils',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',

    '^@errors$': '<rootDir>/src/errors',
    '^@errors/(.*)$': '<rootDir>/src/errors/$1',
  },

  collectCoverageFrom: [
    'src/**/*.js',
    '!docs/**',
    '!src/config/index.js',
    '!src/constants/index.js',
    '!src/controllers/index.js',
    '!src/middlewares/index.js',
    '!src/middlewares/validators/index.js',
    '!src/models/index.js',
    '!src/repositories/index.js',
    '!src/routes/**',
    '!src/services/index.js',
    '!src/sockets/index.js',
    '!src/sockets/handlers/index.js',
    '!src/utils/index.js',
  ],

  testMatch: ['<rootDir>/tests/**/*.test.js'],
  verbose: true,
  testTimeout: 30000, // Increased for in-memory DB

  // Better cleanup between tests
  clearMocks: true,
  restoreMocks: true,

  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Isolation between test files
  testEnvironmentOptions: {
    NODE_ENV: 'test',
  },
}
