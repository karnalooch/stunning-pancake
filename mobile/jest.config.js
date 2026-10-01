/** Jest configuration for 4VELO mobile; native transforms remain owned by jest-expo. */
const expoPreset = require('jest-expo/jest-preset');

// React Navigation's real URL parser imports these ESM-only packages. Narrowly
// extend every preset ignore rule: adding another rule would not override it.
// Match the final node_modules segment, including pnpm's isolated real paths.
const navigationEsmPath = String.raw`[/\\]node_modules[/\\](?:decode-uri-component|filter-obj|split-on-first)[/\\]`;
const transformIgnorePatterns = expoPreset.transformIgnorePatterns.map(
  (pattern) => `^(?!.*${navigationEsmPath}).*(?:${pattern})`,
);

module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns,
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  moduleNameMapper: {
    // Match Metro's app-owned React singleton. pnpm peer subtrees otherwise
    // load another React copy for Legend while the renderer uses the app copy.
    '^react$': require.resolve('react'),
    '^react/jsx-runtime$': require.resolve('react/jsx-runtime'),
    '^react/jsx-dev-runtime$': require.resolve('react/jsx-dev-runtime'),
    '^expo-secure-store$': '<rootDir>/__tests__/__mocks__/expo-secure-store.js',
    '^react-native-mmkv$': '<rootDir>/__tests__/__mocks__/react-native-mmkv.js',
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
  // Existing ratchet floors are unchanged.
  coverageThreshold: { global: { statements: 20, branches: 15, functions: 15, lines: 20 } },
};
