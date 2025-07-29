module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
