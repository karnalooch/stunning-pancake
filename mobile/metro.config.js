const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const externalPnpmVirtualStore = process.env.EXPO_METRO_PNPM_VIRTUAL_STORE;
if (externalPnpmVirtualStore) {
  const resolvedVirtualStore = path.resolve(externalPnpmVirtualStore);
  if (!fs.existsSync(resolvedVirtualStore)) {
    throw new Error(
      `EXPO_METRO_PNPM_VIRTUAL_STORE does not exist: ${resolvedVirtualStore}`,
    );
  }

  // SDK 55's Metro file map cannot follow pnpm symlink targets that live
  // outside projectRoot/watchFolders. Windows release acceptance deliberately
  // moves pnpm's virtual store to a very short path to avoid CMake/Ninja path
  // limits, so expose only that verified store to Metro for those builds.
  config.watchFolders = Array.from(
    new Set([...(config.watchFolders ?? []), resolvedVirtualStore]),
  );
}

config.resolver = {
  ...config.resolver,
  blockList: [
    /.*\/android\/.*/,
    /.*\/ios\/.*/,
    /.*\.native-test.*/,
  ],
};

module.exports = config;
