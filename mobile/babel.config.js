module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // `babel-preset-expo` already inlines `process.env.EXPO_PUBLIC_*` for app
    // bundles, and `app.config.js` bakes the same flags into
    // `Constants.expoConfig.extra` (the reliable release-build path consumed by
    // `e2eConfig`/`isVisionFixtures`). A manual `transform-inline-environment-
    // variables` plugin only duplicated that, defeated the runtime `extra`
    // fallback, and broke jest test isolation — so it was removed.
    plugins: ['react-native-reanimated/plugin'],
  };
};
