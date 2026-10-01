import path from 'node:path';

const config = require('../../jest.config') as {
  transformIgnorePatterns: string[]; moduleNameMapper: Record<string, string>;
};
const preset = require('jest-expo/jest-preset') as { transformIgnorePatterns: string[] };
const ignored = (file: string, patterns = config.transformIgnorePatterns) => patterns.some((pattern) => new RegExp(pattern).test(file));

describe('Jest app singleton and narrow navigation ESM transforms', () => {
  test.each(['decode-uri-component', 'filter-obj', 'split-on-first'])('transforms real %s under direct and pnpm paths', (name) => {
    for (const file of [`/repo/node_modules/${name}/index.js`, `/repo/node_modules/.pnpm/${name}@1.0.0/node_modules/${name}/index.js`]) {
      expect(ignored(file)).toBe(false);
    }
  });
  test('preserves Expo decisions for all unrelated packages', () => {
    for (const name of ['react-native', 'expo', '@react-navigation/native', 'lodash', 'decode-uri-component-extra']) {
      for (const file of [`/repo/node_modules/${name}/index.js`, `/repo/node_modules/.pnpm/pkg@1.0.0/node_modules/${name}/index.js`]) {
        expect(ignored(file)).toBe(ignored(file, preset.transformIgnorePatterns));
      }
    }
    expect(ignored('/repo/node_modules/lodash/index.js')).toBe(true);
  });
  test('maps hooks and JSX to the same app-owned React installation', () => {
    const appReact = path.dirname(require.resolve('react/package.json'));
    for (const key of ['^react$', '^react/jsx-runtime$', '^react/jsx-dev-runtime$']) {
      expect(config.moduleNameMapper[key]).toBeDefined();
      expect(path.dirname(config.moduleNameMapper[key]!)).toBe(appReact);
    }
  });
});
