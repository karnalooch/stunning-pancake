// Native proof: confirm the *real* `withAndroidCleartextTraffic` mod exported by
// the installed `expo-build-properties` package writes
// `application.$['android:usesCleartextTraffic'] = "true"` to the parsed
// AndroidManifest.json when enabled. This exercises the actual mod that runs
// during `expo prebuild`, not a TypeScript-only declaration in app.config.js.

import { withAndroidCleartextTraffic } from 'expo-build-properties/build/android';
import type { ExpoConfig } from 'expo/config';

type AndroidManifestJson = {
  manifest: {
    application: {
      $: Record<string, string>;
      [key: string]: unknown;
    }[];
  };
};

type ManifestModConfig = ExpoConfig & {
  mods?: {
    android?: {
      manifest?: (config: {
        modRequest: { platformProjectRoot?: string };
        modResults: AndroidManifestJson;
      }) => Promise<{
        modResults: AndroidManifestJson;
        modRequest: { platformProjectRoot?: string };
      }>;
    };
  };
};

const cloneManifest = (): AndroidManifestJson =>
  JSON.parse(
    JSON.stringify({
      manifest: {
        application: [
          {
            $: {
              'android:name': 'com.sport.athlete.MainApplication',
            },
          },
        ],
      },
    }),
  );

describe('expo-build-properties android cleartext plugin', () => {
  test('withAndroidCleartextTraffic sets android:usesCleartextTraffic="true" on <application>', async () => {
    const wrapped = withAndroidCleartextTraffic(
      {} as ExpoConfig,
      { android: { usesCleartextTraffic: true } },
    ) as unknown as ManifestModConfig;
    const manifestMod = wrapped.mods?.android?.manifest;
    expect(manifestMod).toBeDefined();

    const result = await manifestMod!({
      modRequest: {},
      modResults: cloneManifest(),
    });

    const mainApplication = result.modResults.manifest.application.find(
      (entry) => entry?.$?.['android:name']?.endsWith('.MainApplication'),
    );
    expect(mainApplication).toBeDefined();
    expect(mainApplication!.$['android:usesCleartextTraffic']).toBe('true');
  });

  test('withAndroidCleartextTraffic leaves the manifest untouched when the option is omitted', async () => {
    const wrapped = withAndroidCleartextTraffic(
      {} as ExpoConfig,
      { android: {} },
    ) as unknown as ManifestModConfig;
    const manifestMod = wrapped.mods?.android?.manifest;
    expect(manifestMod).toBeDefined();

    const manifest = cloneManifest();
    const result = await manifestMod!({
      modRequest: {},
      modResults: manifest,
    });

    const mainApplication = result.modResults.manifest.application.find(
      (entry) => entry?.$?.['android:name']?.endsWith('.MainApplication'),
    );
    expect(mainApplication).toBeDefined();
    expect(mainApplication!.$['android:usesCleartextTraffic']).toBeUndefined();
  });
});
