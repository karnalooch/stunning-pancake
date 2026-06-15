const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const { transformer, resolver } = config;

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};
config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
  blockList: [
    /.*\/android\/.*/,
    /.*\/ios\/.*/,
    /.*\.native-test.*/,
  ],
  extraNodeModules: {
    ...resolver.extraNodeModules,
    '@tokens': path.resolve(__dirname, '../packages/tokens'),
  },
};

config.watchFolders = [
  ...(config.watchFolders || []),
  path.resolve(__dirname, '..'),
  path.resolve(__dirname, '../packages/tokens'),
  path.resolve(__dirname, '../packages/api-client'),
];

module.exports = config;
