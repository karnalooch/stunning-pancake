import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { PushService } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerDevicePushToken(): Promise<string | null> {
  const { status: currentStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = currentStatus;
  if (currentStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const pushToken = await Notifications.getExpoPushTokenAsync();
  const token = pushToken.data;
  if (!token) return null;

  const platform: 'android' | 'ios' = Platform.OS === 'ios' ? 'ios' : 'android';
  await PushService.registerToken(token, platform, true);
  return token;
}
