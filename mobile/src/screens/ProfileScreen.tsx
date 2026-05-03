import React, { useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import { YStack, XStack, ScrollView, View } from 'tamagui';
import { observer, useObservable } from '@legendapp/state/react';
import { AuthService, PrivacyService, UserProfile, WearableService } from '../services/api';
import QRCode from 'react-native-qrcode-svg';

import { GameCard } from '../components/arcade/GameCard';
import { PixelText } from '../components/arcade/PixelText';
import { ArcadeButton } from '../components/arcade/ArcadeButton';

interface Zone {
  id: string;
  properties?: { label?: string; radius?: number };
}

export const ProfileScreen = observer(
  ({ user, onLogout }: { user: UserProfile | null; onLogout: () => void }) => {
    const state = useObservable({
      profile: user,
      zones: [] as Zone[],
      showQR: false,
      stravaStatus: { connected: false, last_sync: null as string | null },
      garminStatus: { connected: false, last_sync: null as string | null },
      wearablesLoading: false,
    });

    const fetchWearableStatus = async () => {
      try {
        const status = await WearableService.getStatus();
        state.stravaStatus.set(status.strava);
        state.garminStatus.set(status.garmin);
      } catch (e) {
        console.warn('[Profile] Wearable status failed:', e);
      }
    };

    useEffect(() => {
      (async () => {
        try {
          const profile = await AuthService.getProfile();
          if (profile) state.profile.set(profile);
          const zones = await PrivacyService.getZones();
          state.zones.set(Array.isArray(zones) ? zones : zones?.features ?? []);
          await fetchWearableStatus();
        } catch (e) {
          console.warn('[Profile] Fetch failed:', e);
        }
      })();
    }, []);

    const handleDeleteZone = (id: string) => {
      Alert.alert('Delete Zone', 'Remove this privacy zone?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await PrivacyService.deleteZone(id);
              const current = state.zones.get();
              state.zones.set(current.filter((z: Zone) => z.id !== id));
            } catch (e) {
              console.warn('[Profile] Delete zone failed:', e);
            }
          },
        },
      ]);
    };

    const handleConnectStrava = async () => {
      try {
        const { auth_url } = await WearableService.getStravaAuthUrl();
        Linking.openURL(auth_url).catch(() => {
          Alert.alert('Error', 'Could not open Strava authorization.');
        });
        setTimeout(fetchWearableStatus, 5000);
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'Failed to get Strava auth URL.');
      }
    };

    const handleConnectGarmin = async () => {
      try {
        const { auth_url } = await WearableService.getGarminAuthUrl();
        Linking.openURL(auth_url).catch(() => {
          Alert.alert('Error', 'Could not open Garmin authorization.');
        });
        setTimeout(fetchWearableStatus, 5000);
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'Failed to get Garmin auth URL.');
      }
    };

    const handleSyncWearables = async () => {
      state.wearablesLoading.set(true);
      try {
        const result = await WearableService.sync();
        await fetchWearableStatus();
        const imported = (result?.results?.STRAVA || 0) + (result?.results?.GARMIN || 0);
        if (imported > 0) {
          Alert.alert('Sync Complete', `Imported ${imported} new activities.`);
        } else {
          Alert.alert('Sync Complete', 'No new activities found.');
        }
      } catch (e: any) {
        Alert.alert('Sync Failed', e?.message || 'Could not sync.');
      } finally {
        state.wearablesLoading.set(false);
      }
    };

    const p = state.profile.get();
    const zones = state.zones.get() || [];
    const showQR = state.showQR.get();

    return (
      <YStack flex={1} backgroundColor="#0B1D33" paddingTop="$10">
        <XStack justifyContent="space-between" alignItems="center" paddingHorizontal="$4" marginBottom="$4">
          <PixelText size={18} color="#D4A373" shadow>CHARACTER_SHEET</PixelText>
          <ArcadeButton size="sm" variant="ghost" label="REFRESH" fullWidth={false} onPress={() => state.profile.set(p ? { ...p } : null)} />
        </XStack>

        {/* Avatar + Identity */}
        <YStack alignItems="center" marginBottom="$6">
          <XStack gap="$6" alignItems="center" paddingHorizontal="$6">
            <View
              width={80}
              height={80}
              backgroundColor="#2B303A"
              borderWidth={3}
              borderColor="#D4A373"
              alignItems="center"
              justifyContent="center"
            >
              <PixelText color="#D4A373" size={32} shadow>
                {p?.username?.[0]?.toUpperCase() || '?'}
              </PixelText>
            </View>

            <YStack flex={1}>
              <PixelText color="#FFFFFF" size={18} shadow>
                {p?.username || 'Pilot'}
              </PixelText>
              <PixelText color="#9CA3AF" size={10} style={{ marginTop: 4 }}>
                {p?.email || ''}
              </PixelText>
              <XStack gap="$2" marginTop="$3">
                <View backgroundColor="#D4A373" paddingVertical={4} paddingHorizontal={8} borderWidth={2} borderColor="#000000">
                  <PixelText color="#000000" size={8}>
                    ID: {String(p?.id ?? '---').slice(0, 8)}
                  </PixelText>
                </View>
              </XStack>
            </YStack>
          </XStack>
        </YStack>

        <ScrollView paddingHorizontal="$4" paddingBottom="$10" showsVerticalScrollIndicator={false}>
          {/* QR Identity */}
          <YStack gap="$2" marginBottom="$6">
            <PixelText color="#D4A373" size={10} shadow>PILOT_TOKEN_QR</PixelText>
            <GameCard variant="metal" padding={16} alignItems="center">
              {showQR ? (
                <YStack alignItems="center" gap="$4">
                  <View backgroundColor="#FFFFFF" padding={12} borderWidth={4} borderColor="#000000">
                    <QRCode
                      value={`sport:pilot:${p?.id || 'unknown'}`}
                      size={160}
                      color="#000000"
                      backgroundColor="#FFFFFF"
                    />
                  </View>
                  <PixelText color="#9CA3AF" size={8} style={{ textAlign: 'center' }}>
                    SCAN AT CHECKPOINTS FOR VERIFICATION
                  </PixelText>
                  <ArcadeButton label="HIDE QR" onPress={() => state.showQR.set(false)} variant="red" size="sm" />
                </YStack>
              ) : (
                <XStack justifyContent="space-between" alignItems="center" width="100%">
                  <YStack>
                    <PixelText color="#FFFFFF" size={12} shadow>IDENTITY SCAN</PixelText>
                    <PixelText color="#9CA3AF" size={8} style={{ marginTop: 4 }}>SHOW ATHLETE TOKEN</PixelText>
                  </YStack>
                  <ArcadeButton label="REVEAL" onPress={() => state.showQR.set(true)} variant="blue" size="sm" fullWidth={false} />
                </XStack>
              )}
            </GameCard>
          </YStack>

          {/* Wearables */}
          <YStack gap="$2" marginBottom="$6">
            <PixelText color="#D4A373" size={10} shadow>WEARABLE_LINK</PixelText>
            <GameCard variant="dark" padding={16}>
              <YStack gap="$4">
                <XStack justifyContent="space-between" alignItems="center">
                  <XStack alignItems="center" gap="$3">
                    <View width={24} height={24} backgroundColor="#FC4C02" borderWidth={2} borderColor="#000000" />
                    <YStack>
                      <PixelText color="#FFFFFF" size={12} shadow>STRAVA</PixelText>
                      {state.stravaStatus.connected.get() && (
                        <PixelText color="#7BA05B" size={8} style={{ marginTop: 4 }}>
                          LINKED · {state.stravaStatus.last_sync?.get() || 'NO SYNC'}
                        </PixelText>
                      )}
                    </YStack>
                  </XStack>
                  <ArcadeButton
                    size="sm"
                    label={state.stravaStatus.connected.get() ? 'SYNC' : 'CONNECT'}
                    variant={state.stravaStatus.connected.get() ? 'green' : 'blue'}
                    fullWidth={false}
                    onPress={state.stravaStatus.connected.get() ? handleSyncWearables : handleConnectStrava}
                  />
                </XStack>

                <XStack justifyContent="space-between" alignItems="center">
                  <XStack alignItems="center" gap="$3">
                    <View width={24} height={24} backgroundColor="#007CC3" borderWidth={2} borderColor="#000000" />
                    <YStack>
                      <PixelText color="#FFFFFF" size={12} shadow>GARMIN</PixelText>
                      {state.garminStatus.connected.get() && (
                        <PixelText color="#7BA05B" size={8} style={{ marginTop: 4 }}>
                          LINKED · {state.garminStatus.last_sync?.get() || 'NO SYNC'}
                        </PixelText>
                      )}
                    </YStack>
                  </XStack>
                  <ArcadeButton
                    size="sm"
                    label={state.garminStatus.connected.get() ? 'SYNC' : 'CONNECT'}
                    variant={state.garminStatus.connected.get() ? 'green' : 'blue'}
                    fullWidth={false}
                    onPress={state.garminStatus.connected.get() ? handleSyncWearables : handleConnectGarmin}
                  />
                </XStack>

                {(state.stravaStatus.connected.get() || state.garminStatus.connected.get()) && (
                  <View style={{ marginTop: 8 }}>
                    <ArcadeButton
                      label="SYNC ALL WEARABLES"
                      variant="green"
                      size="sm"
                      onPress={handleSyncWearables}
                    />
                  </View>
                )}
              </YStack>
            </GameCard>
          </YStack>

          {/* Privacy Zones */}
          <YStack gap="$2" marginBottom="$6">
            <PixelText color="#9CA3AF" size={10}>PRIVACY_ZONES</PixelText>
            <YStack gap="$3">
              {zones.map((zone: Zone) => (
                <GameCard key={zone.id} variant="metal" padding={12}>
                  <XStack justifyContent="space-between" alignItems="center">
                    <YStack>
                      <PixelText color="#FFFFFF" size={12} shadow>
                        {zone.properties?.label || 'ZONE'}
                      </PixelText>
                      <PixelText color="#9CA3AF" size={8} style={{ marginTop: 4 }}>
                        {zone.properties?.radius || 200}M RADIUS
                      </PixelText>
                    </YStack>
                    <ArcadeButton label="DEL" variant="red" size="sm" fullWidth={false} onPress={() => handleDeleteZone(zone.id)} />
                  </XStack>
                </GameCard>
              ))}
              {zones.length === 0 && (
                <PixelText color="#9CA3AF" size={8} style={{ textAlign: 'center', marginTop: 12 }}>
                  NO_PRIVACY_ZONES_DEFINED
                </PixelText>
              )}
            </YStack>
          </YStack>

          {/* Logout */}
          <YStack gap="$2" marginTop="$4" paddingBottom="$10">
            <ArcadeButton variant="red" label="ABORT SESSION" onPress={onLogout} size="lg" />
          </YStack>
        </ScrollView>
      </YStack>
    );
  },
);
  },
);
