import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { Shield, MapPin, LogOut, Trash2, Zap, QrCode, Activity } from 'lucide-react-native';
import { YStack, XStack, Text as TamaText, ScrollView, Switch, View, useTheme } from 'tamagui';
import { observer, useObservable } from '@legendapp/state/react';
import { AuthService, PrivacyService, UserProfile } from '../services/api';
import { ThemeService } from '../services/ThemeService';
import QRCode from 'react-native-qrcode-svg';
import { RetroCard } from '../components/RetroCard';
import { HD2DButton } from '../components/HD2DButton';

const ShieldIcon = Shield as any;
const MapPinIcon = MapPin as any;
const TrashIcon = Trash2 as any;
const ZapIcon = Zap as any;
const QrIcon = QrCode as any;
const LogOutIcon = LogOut as any;

interface Zone {
  id: string;
  properties?: { label?: string; radius?: number };
}

export const ProfileScreen = observer(
  ({ user, onLogout }: { user: UserProfile | null; onLogout: () => void }) => {
    const theme = useTheme();
    const state = useObservable({
      profile: user,
      zones: [] as Zone[],
      isIncognito: false,
      integritySensitivity: 0.5,
      showQR: false,
    });

    useEffect(() => {
      (async () => {
        try {
          const profile = await AuthService.getProfile();
          if (profile) state.profile.set(profile);
          const zones = await PrivacyService.getZones();
          state.zones.set(Array.isArray(zones) ? zones : zones?.features ?? []);
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

    const p = state.profile.get();
    const zones = state.zones.get() || [];
    const isIncognito = state.isIncognito.get();
    const integritySensitivity = state.integritySensitivity.get();
    const showQR = state.showQR.get();
    const isDark = ThemeService.themeMode.get() !== 'solar';

    return (
      <YStack flex={1} backgroundColor="$background" paddingTop="$10">
        {/* Header */}
        <XStack justifyContent="space-between" alignItems="center" paddingHorizontal="$4" marginBottom="$4">
          <TamaText fontFamily="$pixel" fontSize={24} color="$color">
            PROFILE_DATA
          </TamaText>
          <HD2DButton size="$2" label="REFRESH" onPress={() => state.profile.set(p ? { ...p } : null)} />
        </XStack>

        {/* Avatar + Identity */}
        <YStack alignItems="center" marginBottom="$6">
          <XStack gap="$6" alignItems="center" paddingHorizontal="$6">
            <View
              width={80}
              height={80}
              backgroundColor="$background"
              borderWidth={2}
              borderColor="$outlineColor"
              alignItems="center"
              justifyContent="center"
              shadowColor="black"
              shadowOffset={{ width: 4, height: 4 }}
              shadowOpacity={1}
              shadowRadius={0}
            >
              <TamaText color="$primary" fontSize={32} fontWeight="900" fontFamily="$pixel">
                {p?.username?.[0]?.toUpperCase() || '?'}
              </TamaText>
            </View>

            <YStack flex={1}>
              <TamaText color="$color" fontSize={20} fontWeight="900" fontFamily="$pixel">
                {p?.username || 'Athlete'}
              </TamaText>
              <TamaText color="$color" fontSize={10} opacity={0.6} fontFamily="$pixel">
                {p?.email || ''}
              </TamaText>
              <XStack gap="$2" marginTop="$2">
                <View backgroundColor="$primary" paddingVertical="$1" paddingHorizontal="$2" borderWidth={1} borderColor="black">
                  <TamaText color="black" fontSize={8} fontWeight="900" fontFamily="$pixel">
                    ID: {String(p?.id ?? '---').slice(0, 8)}
                  </TamaText>
                </View>
              </XStack>
            </YStack>
          </XStack>
        </YStack>

        <ScrollView paddingHorizontal="$4" paddingBottom="$10">
          {/* QR Identity */}
          <YStack gap="$2" marginBottom="$6">
            <TamaText color="$primary" fontSize={10} fontWeight="800" letterSpacing={1} fontFamily="$pixel">
              ATHLETE QR ID
            </TamaText>
            <RetroCard padding="$4" alignItems="center" borderColor={showQR ? '$primary' : '$outlineColor'}>
              {showQR ? (
                <YStack alignItems="center" gap="$4">
                  <View backgroundColor={isDark ? '#FFFFFF' : '#000000'} padding="$3" borderWidth={2} borderColor="black">
                    <QRCode
                      value={`sport:pilot:${p?.id || 'unknown'}`}
                      size={160}
                      color={isDark ? '#0A1628' : '#FFF8E7'}
                      backgroundColor={isDark ? '#FFFFFF' : '#000000'}
                    />
                  </View>
                  <TamaText color="$color" fontSize={8} textAlign="center" fontFamily="$pixel" opacity={0.7}>
                    Scan at check-points for identification.
                  </TamaText>
                  <HD2DButton label="HIDE_QR" onPress={() => state.showQR.set(false)} theme="red" />
                </YStack>
              ) : (
                <XStack justifyContent="space-between" alignItems="center" width="100%">
                  <XStack alignItems="center" gap="$3">
                    <QrIcon size={20} color={theme.primary.get()} />
                    <YStack>
                      <TamaText color="$color" fontWeight="700" fontSize={14} fontFamily="$pixel">Identity Scan</TamaText>
                      <TamaText color="$color" fontSize={10} opacity={0.6} fontFamily="$pixel">Show your athlete token</TamaText>
                    </YStack>
                  </XStack>
                  <HD2DButton label="REVEAL" onPress={() => state.showQR.set(true)} />
                </XStack>
              )}
            </RetroCard>
          </YStack>

          {/* Integrity Guard (admin only) */}
          {(p?.role === 'GLOBAL_OWNER' || p?.role === 'TENANT_ADMIN') && (
            <YStack gap="$2" marginBottom="$6">
              <TamaText color="$primary" fontSize={10} fontWeight="800" letterSpacing={1} fontFamily="$pixel">
                OPERATIONS CONTROL
              </TamaText>
              <RetroCard padding="$4" gap="$4">
                <XStack justifyContent="space-between" alignItems="center">
                  <XStack alignItems="center" gap="$3">
                    <ZapIcon size={20} color={theme.primary.get()} />
                    <YStack>
                      <TamaText color="$color" fontWeight="700" fontSize={14} fontFamily="$pixel">Integrity Guard</TamaText>
                      <TamaText color="$color" fontSize={10} opacity={0.6} fontFamily="$pixel">Anti-Cheat sensitivity</TamaText>
                    </YStack>
                  </XStack>
                  <TamaText color="$primary" fontWeight="900" fontFamily="$pixel">
                    {(integritySensitivity * 100).toFixed(0)}%
                  </TamaText>
                </XStack>
                <XStack gap="$2" marginTop="$2">
                  {[0.25, 0.5, 0.75, 1.0].map((val) => (
                    <HD2DButton
                      key={val}
                      flex={1}
                      size="$2"
                      label={val === 1.0 ? 'MAX' : `${val * 100}%`}
                      backgroundColor={integritySensitivity === val ? '$primary' : 'transparent'}
                      onPress={() => state.integritySensitivity.set(val)}
                    />
                  ))}
                </XStack>
              </RetroCard>
            </YStack>
          )}

          {/* Wearable — coming soon */}
          <YStack gap="$2" marginBottom="$6">
            <TamaText color="$primary" fontSize={10} fontWeight="800" letterSpacing={1} fontFamily="$pixel">
              WEARABLE ECOSYSTEM
            </TamaText>
            <RetroCard padding="$4" gap="$3">
              <XStack justifyContent="space-between" alignItems="center">
                <XStack alignItems="center" gap="$3">
                  <View width={20} height={20} backgroundColor="#FF6B35" borderWidth={1} borderColor="black" />
                  <TamaText color="$color" fontWeight="700" fontSize={14} fontFamily="$pixel">Strava</TamaText>
                </XStack>
                <TamaText color="$color" opacity={0.4} fontSize={10} fontFamily="$pixel">COMING SOON</TamaText>
              </XStack>
              <XStack justifyContent="space-between" alignItems="center">
                <XStack alignItems="center" gap="$3">
                  <View width={20} height={20} backgroundColor="#007CC3" borderWidth={1} borderColor="black" />
                  <TamaText color="$color" fontWeight="700" fontSize={14} fontFamily="$pixel">Garmin</TamaText>
                </XStack>
                <TamaText color="$color" opacity={0.4} fontSize={10} fontFamily="$pixel">COMING SOON</TamaText>
              </XStack>
            </RetroCard>
          </YStack>

          {/* Privacy — Incognito */}
          <YStack gap="$2" marginBottom="$6">
            <TamaText color="$color" opacity={0.5} fontSize={10} fontWeight="800" letterSpacing={1} fontFamily="$pixel">
              PRIVACY SETTINGS
            </TamaText>
            <RetroCard padding="$4">
              <XStack justifyContent="space-between" alignItems="center">
                <XStack alignItems="center" gap="$3">
                  <ShieldIcon size={20} color={theme.primary.get()} />
                  <YStack>
                    <TamaText color="$color" fontWeight="700" fontSize={14} fontFamily="$pixel">Incognito Mode</TamaText>
                    <TamaText color="$color" fontSize={10} opacity={0.6} fontFamily="$pixel">Hide from rankings</TamaText>
                  </YStack>
                </XStack>
                <Switch size="$2" checked={isIncognito} onCheckedChange={(val) => state.isIncognito.set(val)}>
                  <Switch.Thumb backgroundColor="$primary" />
                </Switch>
              </XStack>
            </RetroCard>
          </YStack>

          {/* Theme Toggle */}
          <YStack gap="$2" marginBottom="$6">
            <TamaText color="$color" opacity={0.5} fontSize={10} fontWeight="800" letterSpacing={1} fontFamily="$pixel">
              APPEARANCE
            </TamaText>
            <RetroCard padding="$4">
              <XStack justifyContent="space-between" alignItems="center">
                <XStack alignItems="center" gap="$3">
                  <ZapIcon size={20} color={ThemeService.themeMode.get() === 'solar' ? '#FF4500' : '#D4A373'} />
                  <YStack>
                    <TamaText color="$color" fontWeight="700" fontSize={14} fontFamily="$pixel">Solar Mode</TamaText>
                    <TamaText color="$color" fontSize={10} opacity={0.6} fontFamily="$pixel">High-noon 12:1 contrast</TamaText>
                  </YStack>
                </XStack>
                <Switch
                  size="$2"
                  checked={ThemeService.themeMode.get() === 'solar'}
                  onCheckedChange={() => ThemeService.toggleTheme()}
                >
                  <Switch.Thumb backgroundColor="$primary" />
                </Switch>
              </XStack>
            </RetroCard>
          </YStack>

          {/* Privacy Zones */}
          <YStack gap="$2" marginBottom="$6">
            <XStack justifyContent="space-between" alignItems="center">
              <TamaText color="$color" opacity={0.5} fontSize={10} fontWeight="800" letterSpacing={1} fontFamily="$pixel">
                PRIVACY ZONES
              </TamaText>
              <TamaText color="$color" opacity={0.4} fontSize={8} fontFamily="$pixel">(via settings)</TamaText>
            </XStack>

            {zones.map((zone: Zone) => (
              <RetroCard key={zone.id} padding="$4" flexDirection="row" justifyContent="space-between" alignItems="center">
                <XStack alignItems="center" gap="$3">
                  <MapPinIcon size={20} color={theme.primary.get()} />
                  <YStack>
                    <TamaText color="$color" fontWeight="700" fontSize={14} fontFamily="$pixel">
                      {zone.properties?.label || 'Zone'}
                    </TamaText>
                    <TamaText color="$color" fontSize={10} opacity={0.6} fontFamily="$pixel">
                      {zone.properties?.radius || 200}m radius
                    </TamaText>
                  </YStack>
                </XStack>
                <HD2DButton label="X" size="$2" theme="red" onPress={() => handleDeleteZone(zone.id)} />
              </RetroCard>
            ))}
            {zones.length === 0 && (
              <TamaText color="$color" fontSize={10} textAlign="center" marginTop="$4" fontFamily="$pixel" opacity={0.4}>
                NO_PRIVACY_ZONES_DEFINED
              </TamaText>
            )}
          </YStack>

          {/* Logout */}
          <YStack gap="$2" marginTop="$4" paddingBottom="$10">
            <HD2DButton theme="red" label="LOGOUT_SESSION" onPress={onLogout} height={50} />
          </YStack>

          <TamaText textAlign="center" fontSize={8} color="$color" opacity={0.3} paddingVertical="$2" fontFamily="$pixel">
            HD-2D GAMING FUSION v4.0 · DEEP SEA EDITION
          </TamaText>
        </ScrollView>
      </YStack>
    );
  },
);
