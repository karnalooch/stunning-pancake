import { withProjectBuildGradle } from '@expo/config-plugins';

const withCustomMavenRepos = (config) => {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      const contents = config.modResults.contents;
      const transistorMaven = "maven { url 'https://customer-ra.transistorsoft.com/dist/android/maven' }";
      
      if (!contents.includes('customer-ra.transistorsoft.com')) {
        config.modResults.contents = contents.replace(
          /allprojects\s*\{\s*repositories\s*\{/,
          `allprojects {
    repositories {
        ${transistorMaven}`
        );
      }
    }
    return config;
  });
};

export default ({ config }) => {
  return withCustomMavenRepos({
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
    "newArchEnabled": false,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "package": "com.sport.athlete",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#000000"
      },
      "predictiveBackGestureEnabled": false
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "extra": {
      "eas": {
        "projectId": "e25228a6-071c-4421-a75f-7939ba464c8a"
      }
    },
    "plugins": [
      "@sentry/react-native",
      [
        "react-native-background-geolocation",
        {
          "license": process.env.BACKGROUND_GEOLOCATION_LICENSE || ""
        }
      ]
    ]
  });
};
