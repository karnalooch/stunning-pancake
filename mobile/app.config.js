export default ({ config }) => {
  return {
    ...config,
    "name": "mobile",
    "slug": "mobile",
    "version": "1.0.0",
    "updates": {
      "url": "https://u.expo.dev/e25228a6-071c-4421-a75f-7939ba464c8a"
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
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.sport.athlete",
      "googleServicesFile": "./GoogleService-Info.plist",
      "infoPlist": {
        "UIBackgroundModes": [
          "location",
          "fetch"
        ]
      }
    },
    "android": {
      "package": "com.sport.athlete",
      "googleServicesFile": "./google-services.json",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#000000"
      },
      "predictiveBackGestureEnabled": false,
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION"
      ]
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "extra": {
      "eas": {
        "projectId": "e25228a6-071c-4421-a75f-7939ba464c8a"
      },
      "EXPO_PUBLIC_API_URL": "https://docker-backend-production-123c.up.railway.app",
      "EXPO_PUBLIC_TELEMETRY_URL": "http://docker-telemetry-production.up.railway.app:8080"
    },
    "plugins": [
      "@react-native-firebase/app",
      "@react-native-firebase/crashlytics",
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow SPORT to use your location even in the background.",
          "isAndroidBackgroundLocationEnabled": true
        }
      ]
    ]
  };
};
