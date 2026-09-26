const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver = {
  ...config.resolver,
  blockList: [
    /.*\/android\/.*/,
    /.*\/ios\/.*/,
    /.*\.native-test.*/,
  ],
};

module.exports = config;
