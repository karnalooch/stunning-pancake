import React, { useEffect } from 'react';
import { Alert, Linking, View } from 'react-native';
import { observer, useObservable } from '@legendapp/state/react';
import { AuthService, PrivacyService, UserProfile, WearableService } from '../services/api';
import QRCode from 'react-native-qrcode-svg';

import { Column } from '../components/Column';
import { Row } from '../components/Row';
import { ScrollContainer } from '../components/ScrollContainer';
import { GameCard } from '../components/GameCard';
import { PixelText } from '../components/PixelText';
import { ArcadeButton } from '../components/ArcadeButton';
import { colors as tokens } from '@tokens/generated/restyle-colors';

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
        state.stravaStatus.set(status.strava as any);
        state.garminStatus.set(status.garmin as any);
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
      <Column flex={1} style={{ backgroundColor: tokens.octopath.background, paddingTop: 40 }}>
        <Row justifyContent="space-between" alignItems="center" paddingHorizontal={16} style={{ marginBottom: 16 }}>
          <PixelText size="lg" color="primary" shadow>CHARACTER_SHEET</PixelText>
          <ArcadeButton size="sm" variant="ghost" label="REFRESH" fullWidth={false} onPress={() => state.profile.set(p ? { ...p } : null)} />
        </Row>

        {/* Avatar + Identity */}
        <Column alignItems="center" style={{ marginBottom: 24 }}>
          <Row gap={24} alignItems="center" paddingHorizontal={24}>
            <View
              style={{
                width: 80,
                height: 80,
                backgroundColor: tokens.octopath.surface,
                borderWidth: 3,
                borderColor: tokens.semantic.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PixelText color="primary" size="2xl" shadow>
                {p?.username?.[0]?.toUpperCase() || '?'}
              </PixelText>
            </View>

            <Column flex={1}>
              <PixelText color="text" size="lg" shadow>
                {p?.username || 'Pilot'}
              </PixelText>
              <PixelText color="muted" size="xs" style={{ marginTop: 4 }}>
                {p?.email || ''}
              </PixelText>
              <Row gap={8} style={{ marginTop: 12 }}>
                <View style={{ backgroundColor: tokens.semantic.primary, paddingVertical: 4, paddingHorizontal: 8, borderWidth: 2, borderColor: tokens.primitive.pixelBlack }}>
                  <PixelText color="inverse" size="xs" style={{ fontSize: 8 }}>
                    ID: {String(p?.id ?? '---').slice(0, 8)}
                  </PixelText>
                </View>
              </Row>
            </Column>
          </Row>
        </Column>

        <ScrollContainer paddingHorizontal={16} showsVerticalScrollIndicator={false} style={{ paddingBottom: 40 }}>
          {/* QR Identity */}
          <Column gap={8} style={{ marginBottom: 24 }}>
            <PixelText color="primary" size="xs" shadow>PILOT_TOKEN_QR</PixelText>
            <GameCard variant="metal" padding={16} style={{ alignItems: 'center' }}>
              {showQR ? (
                <Column alignItems="center" gap={16}>
                  <View style={{ backgroundColor: '#FFFFFF', padding: 12, borderWidth: 4, borderColor: tokens.primitive.pixelBlack }}>
                    <QRCode
                      value={`sport:pilot:${p?.id || 'unknown'}`}
                      size={160}
                      color={tokens.primitive.pixelBlack}
                      backgroundColor="#FFFFFF"
                    />
                  </View>
                  <PixelText color="muted" size="xs" style={{ fontSize: 8, textAlign: 'center' }}>
                    SCAN AT CHECKPOINTS FOR VERIFICATION
                  </PixelText>
                  <ArcadeButton label="HIDE QR" onPress={() => state.showQR.set(false)} variant="danger" size="sm" />
                </Column>
              ) : (
                <Row justifyContent="space-between" alignItems="center" style={{ width: '100%' }}>
                  <Column>
                    <PixelText color="text" size="sm" shadow>IDENTITY SCAN</PixelText>
                    <PixelText color="muted" size="xs" style={{ fontSize: 8, marginTop: 4 }}>SHOW ATHLETE TOKEN</PixelText>
                  </Column>
                  <ArcadeButton label="REVEAL" onPress={() => state.showQR.set(true)} variant="secondary" size="sm" fullWidth={false} />
                </Row>
              )}
            </GameCard>
          </Column>

          {/* Wearables */}
          <Column gap={8} style={{ marginBottom: 24 }}>
            <PixelText color="primary" size="xs" shadow>WEARABLE_LINK</PixelText>
            <GameCard variant="dark" padding={16}>
              <Column gap={16}>
                <Row justifyContent="space-between" alignItems="center">
                  <Row alignItems="center" gap={12}>
                    <View style={{ width: 24, height: 24, backgroundColor: tokens.semantic.error, borderWidth: 2, borderColor: tokens.primitive.pixelBlack }} />
                    <Column>
                      <PixelText color="text" size="sm" shadow>STRAVA</PixelText>
                      {state.stravaStatus.connected.get() && (
                        <PixelText color="success" size="xs" style={{ fontSize: 8, marginTop: 4 }}>
                          LINKED · {state.stravaStatus.last_sync?.get() || 'NO SYNC'}
                        </PixelText>
                      )}
                    </Column>
                  </Row>
                  <ArcadeButton
                    size="sm"
                    label={state.stravaStatus.connected.get() ? 'SYNC' : 'CONNECT'}
                    variant={state.stravaStatus.connected.get() ? 'success' : 'secondary'}
                    fullWidth={false}
                    onPress={state.stravaStatus.connected.get() ? handleSyncWearables : handleConnectStrava}
                  />
                </Row>

                <Row justifyContent="space-between" alignItems="center">
                  <Row alignItems="center" gap={12}>
                    <View style={{ width: 24, height: 24, backgroundColor: tokens.octopath.buttonBlueBg, borderWidth: 2, borderColor: tokens.primitive.pixelBlack }} />
                    <Column>
                      <PixelText color="text" size="sm" shadow>GARMIN</PixelText>
                      {state.garminStatus.connected.get() && (
                        <PixelText color="success" size="xs" style={{ fontSize: 8, marginTop: 4 }}>
                          LINKED · {state.garminStatus.last_sync?.get() || 'NO SYNC'}
                        </PixelText>
                      )}
                    </Column>
                  </Row>
                  <ArcadeButton
                    size="sm"
                    label={state.garminStatus.connected.get() ? 'SYNC' : 'CONNECT'}
                    variant={state.garminStatus.connected.get() ? 'success' : 'secondary'}
                    fullWidth={false}
                    onPress={state.garminStatus.connected.get() ? handleSyncWearables : handleConnectGarmin}
                  />
                </Row>

                {(state.stravaStatus.connected.get() || state.garminStatus.connected.get()) && (
                  <View style={{ marginTop: 8 }}>
                    <ArcadeButton
                      label="SYNC ALL WEARABLES"
                      variant="success"
                      size="sm"
                      onPress={handleSyncWearables}
                    />
                  </View>
                )}
              </Column>
            </GameCard>
          </Column>

          {/* Privacy Zones */}
          <Column gap={8} style={{ marginBottom: 24 }}>
            <PixelText color="muted" size="xs">PRIVACY_ZONES</PixelText>
            <Column gap={12}>
              {zones.map((zone: Zone) => (
                <GameCard key={zone.id} variant="metal" padding={12}>
                  <Row justifyContent="space-between" alignItems="center">
                    <Column>
                      <PixelText color="text" size="sm" shadow>
                        {zone.properties?.label || 'ZONE'}
                      </PixelText>
                      <PixelText color="muted" size="xs" style={{ fontSize: 8, marginTop: 4 }}>
                        {zone.properties?.radius || 200}M RADIUS
                      </PixelText>
                    </Column>
                    <ArcadeButton label="DEL" variant="danger" size="sm" fullWidth={false} onPress={() => handleDeleteZone(zone.id)} />
                  </Row>
                </GameCard>
              ))}
              {zones.length === 0 && (
                <PixelText color="muted" size="xs" style={{ fontSize: 8, textAlign: 'center', marginTop: 12 }}>
                  NO_PRIVACY_ZONES_DEFINED
                </PixelText>
              )}
            </Column>
          </Column>

          {/* Logout */}
          <Column gap={8} style={{ marginTop: 16, paddingBottom: 40 }}>
            <ArcadeButton variant="danger" label="ABORT SESSION" onPress={onLogout} size="lg" />
          </Column>
        </ScrollContainer>
      </Column>
    );
  },
);
