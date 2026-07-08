module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  setupFiles: ['<rootDir>/jest.setup.js'],
};
