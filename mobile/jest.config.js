/**
 * Jest configuration for SPORT Mobile App
 * Uses jest-expo preset for React Native / Expo compatibility.
 * 
 * Run: npm test
 * Watch: npm run test:watch
 * Coverage: npm run test:coverage
 */
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|react-native-reanimated|@legendapp/state)',
  ],
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
