module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/integration/**/*.integration.test.cjs'],
  transform: {},
  modulePathIgnorePatterns: ['<rootDir>/.kilo/', '<rootDir>/.superpowers/'],
  testTimeout: 30000,
  reporters: ['default'],
};
