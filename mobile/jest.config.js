/**
 * Jest configuration for 4VELO mobile
 * Uses jest-expo preset for React Native / Expo compatibility.
 * 
 * Run: npm test
 * Watch: npm run test:watch
 * Coverage: npm run test:coverage
 */
module.exports = {
  preset: 'jest-expo',
  // Do not override jest-expo's transformIgnorePatterns. SDK 55's preset owns
  // React Native/Expo transformation and is pnpm-aware; the historical custom
  // node_modules regex broke as soon as workspaces moved to isolated linking.
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  moduleNameMapper: {
    '^expo-secure-store$': '<rootDir>/__tests__/__mocks__/expo-secure-store.js',
    '^@4velo/api-client$': '<rootDir>/../packages/api-client/src/index.ts',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/__tests__/__mocks__/fileMock.js',
  },
  collectCoverageFrom: [
    'src/services/**/*.{ts,tsx}',
    'src/bootstrap/**/*.{ts,tsx}',
    'src/screens/**/*.{ts,tsx}',
    '!src/services/**/*.d.ts',
  ],
  // Ratchet baseline (current ~24% lines). Raise these as coverage grows;
  // floors are set below current to gate against regression, not to block.
  coverageThreshold: {
    global: {
      statements: 20,
      branches: 15,
      functions: 15,
      lines: 20,
    },
  },
};
