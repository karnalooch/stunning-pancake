/* eslint-env node */
const fs = require('fs');
const path = require('path');
const releaseVersion = require('../version.json');

try {
  require('dotenv').config({ path: path.resolve(__dirname, '.env') });
} catch {
  // dotenv optional — E2E vars may come from the shell environment
}

const resolvePublicRuntimeExtra = () => ({
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_TELEMETRY_URL: process.env.EXPO_PUBLIC_TELEMETRY_URL,
});

const resolveE2eExtra = () => ({
  EXPO_PUBLIC_E2E_AUTO_LOGIN: process.env.EXPO_PUBLIC_E2E_AUTO_LOGIN,
  EXPO_PUBLIC_E2E_SKIP_ONBOARDING: process.env.EXPO_PUBLIC_E2E_SKIP_ONBOARDING,
  EXPO_PUBLIC_E2E_EMAIL: process.env.EXPO_PUBLIC_E2E_EMAIL,
  EXPO_PUBLIC_E2E_PASSWORD: process.env.EXPO_PUBLIC_E2E_PASSWORD,
  EXPO_PUBLIC_E2E_GPS_RECOVERY: process.env.EXPO_PUBLIC_E2E_GPS_RECOVERY,
  // Vision parity harness — render deterministic mock data for screenshot diff.
  EXPO_PUBLIC_VISION_FIXTURES: process.env.EXPO_PUBLIC_VISION_FIXTURES,
});

const assertReleaseSafePublicEnv = () => {
  if (process.env.EAS_BUILD_PROFILE !== 'production') return;

  const forbidden = [
    'EXPO_PUBLIC_E2E_AUTO_LOGIN',
    'EXPO_PUBLIC_E2E_SKIP_ONBOARDING',
    'EXPO_PUBLIC_E2E_EMAIL',
    'EXPO_PUBLIC_E2E_PASSWORD',
    'EXPO_PUBLIC_E2E_GPS_RECOVERY',
    'EXPO_PUBLIC_VISION_FIXTURES',
    'EXPO_PUBLIC_LLM_API_KEY',
  ].filter((key) => {
    const value = process.env[key];
    return value != null && value !== '' && value !== 'false';
  });

  if (forbidden.length > 0) {
    throw new Error(
      `Production mobile config contains forbidden public test/secret variables: ${forbidden.join(', ')}`,
    );
  }
};

// Security boundary: EAS_BUILD_PROFILE is the authoritative signal for enabling
// Android cleartext. EAS CLI sets it to the selected profile name (matching a key
// in eas.json "build") before this module is evaluated. We register the
// `expo-build-properties` config plugin exclusively for the `pilot-local`
// artifact (which talks to backend/telemetry over `adb reverse` localhost).
// The plugin then sets `android:usesCleartextTraffic="true"` on the Android
// manifest <application> element at prebuild time. Railway profiles
// (development, preview, production) and any default / unset resolution skip
// the plugin entirely, so the Android 9+ default — cleartext disabled — stays
// in force regardless of EXPO_PUBLIC_API_URL. Evaluated per-call so tests can
// mutate process.env between resolutions.
const isPilotLocalBuild = () =>
  process.env.EAS_BUILD_PROFILE === 'pilot-local';

// Firebase gating is shared for the plugins, but Google Services files are
// platform-specific. A tracked Android google-services.json must never make the
// iOS config point at a missing GoogleService-Info.plist (and vice versa).
// EXPO_PUBLIC_ENABLE_FIREBASE="false" remains an explicit build-wide opt-out.
const resolveFirebaseConfig = () => {
  const firebaseAllowed = process.env.EXPO_PUBLIC_ENABLE_FIREBASE !== 'false';
  const hasAndroidGoogleServices = fs.existsSync(
    path.resolve(__dirname, './google-services.json'),
  );
  const hasIosGoogleServices = fs.existsSync(
    path.resolve(__dirname, './GoogleService-Info.plist'),
  );

  return {
    enableFirebase:
      firebaseAllowed && (hasAndroidGoogleServices || hasIosGoogleServices),
    enableAndroidGoogleServices: firebaseAllowed && hasAndroidGoogleServices,
    enableIosGoogleServices: firebaseAllowed && hasIosGoogleServices,
  };
};

export default ({ config }) => {
  assertReleaseSafePublicEnv();

  const {
    enableFirebase,
    enableAndroidGoogleServices,
    enableIosGoogleServices,
  } = resolveFirebaseConfig();

  return {
    ...config,
    "name": "4VELO",
    "slug": "mobile",
    "scheme": "fourvelo",
    "version": releaseVersion.version,
    "updates": {
      "url": "https://u.expo.dev/e25228a6-071c-4421-a75f-7939ba464c8a"
    },
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#f8faf0"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.sport.athlete",
      "googleServicesFile": enableIosGoogleServices ? "./GoogleService-Info.plist" : undefined,
      "infoPlist": {
        "UIBackgroundModes": [
          "location",
          "fetch"
        ]
      }
    },
    "android": {
      "package": "com.sport.athlete",
      "googleServicesFile": enableAndroidGoogleServices ? "./google-services.json" : undefined,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#f8faf0"
      },
      "predictiveBackGestureEnabled": false,
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION"
      ],
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "extra": {
      "eas": {
        "projectId": "e25228a6-071c-4421-a75f-7939ba464c8a"
      },
      ...Object.fromEntries(
        Object.entries({ ...resolvePublicRuntimeExtra(), ...resolveE2eExtra() }).filter(
          ([, value]) => value != null && value !== '',
        ),
      ),
    },
    "plugins": [
      ...(enableFirebase ? [
        "@react-native-firebase/app",
        "@react-native-firebase/crashlytics"
      ] : []),
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow 4VELO to use your location even in the background.",
          "isAndroidBackgroundLocationEnabled": true
        }
      ],
      [
        "expo-secure-store",
        {
          "configureAndroidBackup": true
        }
      ],
      "expo-font",
      "@maplibre/maplibre-react-native",
      ...(isPilotLocalBuild() ? [
        [
          "expo-build-properties",
          {
            "android": {
              "usesCleartextTraffic": true
            }
          }
        ]
      ] : [])
    ]
  };
};