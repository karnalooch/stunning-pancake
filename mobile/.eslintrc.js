module.exports = {
  root: true,
  extends: ['expo'],
  ignorePatterns: ['node_modules/', 'android/', 'ios/', '.expo/'],
  rules: {
    // Expo SDK packages are resolved at runtime; CI has them via expo install.
    'import/no-unresolved': [
      'error',
      { ignore: ['^expo-', '^@expo/'] },
    ],
  },
};
