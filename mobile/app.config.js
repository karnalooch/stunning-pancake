/* eslint-env node */
const fs = require('fs');
const path = require('path');

try {
  require('dotenv').config({ path: path.resolve(__dirname, '.env') });
} catch {
  // dotenv optional — E2E vars may come from the shell environment
}

const e2eExtra = {
  EXPO_PUBLIC_E2E_AUTO_LOGIN: process.env.EXPO_PUBLIC_E2E_AUTO_LOGIN,
  EXPO_PUBLIC_E2E_SKIP_ONBOARDING: process.env.EXPO_PUBLIC_E2E_SKIP_ONBOARDING,
  EXPO_PUBLIC_E2E_EMAIL: process.env.EXPO_PUBLIC_E2E_EMAIL,
  EXPO_PUBLIC_E2E_PASSWORD: process.env.EXPO_PUBLIC_E2E_PASSWORD,
  EXPO_PUBLIC_E2E_GPS_RECOVERY: process.env.EXPO_PUBLIC_E2E_GPS_RECOVERY,
  // Vision parity harness — render deterministic mock data for screenshot diff.
  EXPO_PUBLIC_VISION_FIXTURES: process.env.EXPO_PUBLIC_VISION_FIXTURES,
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

// Firebase plugin gating: Google Services file must exist on disk AND the build
// must not be the isolated pilot-local artifact. pilot-local sets
// EXPO_PUBLIC_ENABLE_FIREBASE="false" so the dev-client APK does not pull
// Firebase/Crashlytics into a build whose only consumer is the home lab. Default
// resolution (no EAS profile) also disables Firebase unless the file is present
// AND the env flag is not explicitly "false" — keeps local `expo start` free of
// Firebase init in a sandbox without google-services.json. Evaluated per-call so
// tests can mutate process.env between resolutions.
const isFirebaseEnabled = () => {
  if (process.env.EXPO_PUBLIC_ENABLE_FIREBASE === 'false') return false;
  const hasAndroidGoogleServices = fs.existsSync(path.resolve(__dirname, './google-services.json'));
  const hasIosGoogleServices = fs.existsSync(path.resolve(__dirname, './GoogleService-Info.plist'));
  return hasAndroidGoogleServices || hasIosGoogleServices;
};

export default ({ config }) => {
  const enableFirebase = isFirebaseEnabled();

  return {
    ...config,
    "name": "4VELO",
    "slug": "mobile",
    "scheme": "fourvelo",
    "version": "0.2.0-rc.1",
    "updates": {
      "url": "https://u.expo.dev/e25228a6-071c-4421-a75f-7939ba464c8a",
      "channel": "production"
    },
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#f8faf0"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.sport.athlete",
      "googleServicesFile": enableFirebase ? "./GoogleService-Info.plist" : undefined,
      "infoPlist": {
        "UIBackgroundModes": [
          "location",
          "fetch"
        ]
      }
    },
    "android": {
      "package": "com.sport.athlete",
      "googleServicesFile": enableFirebase ? "./google-services.json" : undefined,
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
      "EXPO_PUBLIC_API_URL": "https://backend-production-55c7.up.railway.app",
      "EXPO_PUBLIC_TELEMETRY_URL": "https://docker-telemetry-production-123c.up.railway.app",
      ...Object.fromEntries(
        Object.entries(e2eExtra).filter(([, value]) => value != null && value !== ''),
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
