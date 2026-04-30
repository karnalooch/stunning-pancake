import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import * as Updates from 'expo-updates';
import { User, Shield, MapPin, LogOut, Trash2, Plus, Zap, Activity, QrCode } from 'lucide-react-native';
import { YStack, XStack, Text as TamaText, Button as TamaButton, H2, Paragraph, ScrollView, Switch, Circle, View } from 'tamagui';
import { observer, useObservable } from '@legendapp/state/react';
import { AuthService, PrivacyService } from '../services/api';
import { ThemeService } from '../services/ThemeService';
import QRCode from 'react-native-qrcode-svg';

const ShieldIcon = Shield as any;
const PlusIcon = Plus as any;
const MapPinIcon = MapPin as any;
const TrashIcon = Trash2 as any;
const LogOutIcon = LogOut as any;
const ZapIcon = Zap as any;
const ActivityIcon = Activity as any;
const QrIcon = QrCode as any;

export const ProfileScreen = observer(({ user: initialUser, onLogout }: { user: any, onLogout: () => void }) => {
  const state = useObservable({
    user: initialUser || null,
    zones: [] as any[],
    isIncognito: false,
    integritySensitivity: 0.5,
    showQR: false,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const profile = await AuthService.getProfile();
        if (profile) {
          state.user.set(profile);
        }
        const zoneData = await PrivacyService.getZones();
        state.zones.set(Array.isArray(zoneData) ? zoneData : (zoneData.features || []));
      } catch (e) {
        console.error("Profile fetch failed:", e);
      }
    };
    fetchData();
  }, []);

  const handleDeleteZone = async (id: string) => {
    Alert.alert("Delete Zone", "Are you sure you want to remove this privacy zone?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await PrivacyService.deleteZone(id);
        state.zones.set(prev => prev.filter((z: any) => z.id !== id));
      }}
    ]);
  };

  const user = state.user.get();
  const zones = state.zones.get() || [];
  const isIncognito = state.isIncognito.get();
  const integritySensitivity = state.integritySensitivity.get();
  const showQR = state.showQR.get();

  const handleRefresh = async () => {
    try {
      const profile = await AuthService.getProfile();
      if (profile && (profile.email || profile.username)) {
        state.user.set(profile);
      }
    } catch (e) {
      console.error("Refresh failed", e);
    }
  };

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop="$10">
      <XStack justifyContent="space-between" alignItems="center" paddingHorizontal="$4" marginBottom="$4">
        <TamaText fontFamily="$pixel" fontSize={24} color="$color">PROFILE_DATA</TamaText>
        <HD2DButton size="$2" label="REFRESH" onPress={handleRefresh} />
      </XStack>

      <YStack alignItems="center" marginBottom="$6">
        <XStack gap="$6" alignItems="center" paddingHorizontal="$6">
          <View 
            width={80} 
            height={80} 
            backgroundColor="$background" 
            borderWidth={2} 
            borderColor="$hd2d.outlineColor"
            alignItems="center"
            justifyContent="center"
            shadowColor="black"
            shadowOffset={{ width: 4, height: 4 }}
            shadowOpacity={1}
            shadowRadius={0}
          >
            <TamaText color="$primary" fontSize={32} fontWeight="900" fontFamily="$pixel">
              {user?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
            </TamaText>
          </View>
          
          <YStack flex={1}>
            <TamaText color="$color" fontSize={20} fontWeight="900" fontFamily="$pixel">{user?.username || user?.email || 'Sportowiec'}</TamaText>
            <TamaText color="$color" fontSize={10} opacity={0.6} fontFamily="$pixel">{user?.email || 'No email provided'}</TamaText>
            <XStack gap="$2" marginTop="$2">
              <View backgroundColor="$primary" paddingVertical="$1" paddingHorizontal="$2" borderWidth={1} borderColor="black">
                <TamaText color="black" fontSize={8} fontWeight="900" fontFamily="$pixel">ID: {user?.id?.substring(0, 8) || 'PENDING'}</TamaText>
              </View>
              {user?.is_premium && (
                <View backgroundColor="$accent" paddingVertical="$1" paddingHorizontal="$2" borderWidth={1} borderColor="black">
                  <TamaText color="black" fontSize={8} fontWeight="900" fontFamily="$pixel">PREMIUM_STATUS</TamaText>
                </View>
              )}
            </XStack>
          </YStack>
        </XStack>
      </YStack>

      <ScrollView paddingHorizontal="$4" paddingBottom="$10">
        {/* Athlete QR Section */}
        <YStack gap="$2" marginBottom="$6">
          <TamaText color="$primary" fontSize={10} fontWeight="800" letterSpacing={1} fontFamily="$pixel">ATHLETE QR ID</TamaText>
          <RetroCard 
            padding="$4" 
            alignItems="center"
            borderColor={showQR ? "$primary" : "$hd2d.outlineColor"}
          >
            {showQR ? (
              <YStack alignItems="center" gap="$4">
                <View backgroundColor="white" padding="$3" borderWidth={2} borderColor="black">
                  <QRCode 
                    value={`sport_v1:pilot:${user?.id || 'unknown'}`} 
                    size={160}
                    color="#0B0E14"
                    backgroundColor="white"
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

        {(user?.role === 'GLOBAL_OWNER' || user?.role === 'TENANT_ADMIN' || user?.role === 'TENANT_MODERATOR') && (
          <YStack gap="$2" marginBottom="$6">
            <TamaText color="$primary" fontSize={10} fontWeight="800" letterSpacing={1} fontFamily="$pixel">OPERATIONS CONTROL</TamaText>
            <RetroCard backgroundColor="rgba(212, 163, 115, 0.05)" padding="$4" gap="$4">
              <XStack justifyContent="space-between" alignItems="center">
                <XStack alignItems="center" gap="$3">
                  <ZapIcon size={20} color={theme.primary.get()} />
                  <YStack>
                    <TamaText color="$color" fontWeight="700" fontSize={14} fontFamily="$pixel">Integrity Guard</TamaText>
                    <TamaText color="$color" fontSize={10} opacity={0.6} fontFamily="$pixel">Anti-Cheat sensitivity</TamaText>
                  </YStack>
                </XStack>
                <TamaText color="$primary" fontWeight="900" fontFamily="$pixel">{(integritySensitivity * 100).toFixed(0)}%</TamaText>
              </XStack>
              
              <XStack gap="$2" marginTop="$2">
                {[0.25, 0.5, 0.75, 1.0].map((val) => (
                  <HD2DButton 
                    key={val}
                    flex={1} 
                    size="$2" 
                    label={val === 1.0 ? 'MAX' : `${(val * 100)}%`}
                    backgroundColor={integritySensitivity === val ? "$primary" : "transparent"}
                    onPress={() => state.integritySensitivity.set(val)}
                  />
                ))}
              </XStack>
            </RetroCard>
          </YStack>
        )}

        <YStack gap="$2" marginBottom="$6">
          <TamaText color="$primary" fontSize={10} fontWeight="800" letterSpacing={1} fontFamily="$pixel">WEARABLE ECOSYSTEM</TamaText>
          <RetroCard padding="$4" gap="$4">
            <XStack justifyContent="space-between" alignItems="center">
              <XStack alignItems="center" gap="$3">
                <ZapIcon size={20} color="#FF6B35" />
                <YStack>
                  <TamaText color="$color" fontWeight="700" fontSize={14} fontFamily="$pixel">Strava</TamaText>
                  <TamaText color="$color" fontSize={10} opacity={0.6} fontFamily="$pixel">Sync activities</TamaText>
                </YStack>
              </XStack>
              <HD2DButton 
                label="CONNECT" 
                onPress={() => Alert.alert("OAuth Redirect", "Redirecting to Strava...")}
              />
            </XStack>

            <XStack justifyContent="space-between" alignItems="center">
              <XStack alignItems="center" gap="$3">
                <View backgroundColor="#007CC3" width={20} height={20} borderWidth={1} borderColor="black" />
                <YStack>
                  <TamaText color="$color" fontWeight="700" fontSize={14} fontFamily="$pixel">Garmin</TamaText>
                  <TamaText color="$color" fontSize={10} opacity={0.6} fontFamily="$pixel">Direct watch sync</TamaText>
                </YStack>
              </XStack>
              <HD2DButton 
                label="CONNECT"
                onPress={() => Alert.alert("OAuth Redirect", "Redirecting to Garmin...")}
              />
            </XStack>
          </RetroCard>
        </YStack>

        <YStack gap="$2" marginBottom="$6">
          <TamaText color="$color" opacity={0.5} fontSize={10} fontWeight="800" letterSpacing={1} fontFamily="$pixel">PRIVACY SETTINGS</TamaText>
          <RetroCard padding="$4">
            <XStack justifyContent="space-between" alignItems="center">
              <XStack alignItems="center" gap="$3">
                <ShieldIcon size={20} color={theme.primary.get()} />
                <YStack>
                  <TamaText color="$color" fontWeight="700" fontSize={14} fontFamily="$pixel">Incognito Mode</TamaText>
                  <TamaText color="$color" fontSize={10} opacity={0.6} fontFamily="$pixel">Hide from rankings</TamaText>
                </YStack>
              </XStack>
              <Switch 
                size="$2" 
                checked={isIncognito} 
                onCheckedChange={(val) => state.isIncognito.set(val)}
              >
                <Switch.Thumb backgroundColor="$primary" />
              </Switch>
            </XStack>
          </RetroCard>
        </YStack>

        <YStack gap="$2" marginBottom="$6">
          <TamaText color="$color" opacity={0.5} fontSize={10} fontWeight="800" letterSpacing={1} fontFamily="$pixel">APPEARANCE</TamaText>
          <RetroCard padding="$4">
            <XStack justifyContent="space-between" alignItems="center">
              <XStack alignItems="center" gap="$3">
                <ZapIcon size={20} color={ThemeService.themeMode.get() === 'solar' ? "#FF0000" : "#D4A373"} />
                <YStack>
                  <TamaText color="$color" fontWeight="700" fontSize={14} fontFamily="$pixel">Solar Mode</TamaText>
                  <TamaText color="$color" fontSize={10} opacity={0.6} fontFamily="$pixel">High-noon contrast</TamaText>
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

        <YStack gap="$2" marginBottom="$6">
          <XStack justifyContent="space-between" alignItems="center">
            <TamaText color="$color" opacity={0.5} fontSize={10} fontWeight="800" letterSpacing={1} fontFamily="$pixel">PRIVACY ZONES</TamaText>
            <HD2DButton size="$2" label="+" onPress={() => {}} circular />
          </XStack>
          
          {zones.map((zone: any) => (
            <RetroCard key={zone.id} padding="$4" flexDirection="row" justifyContent="space-between" alignItems="center">
              <XStack alignItems="center" gap="$3">
                <MapPinIcon size={20} color={theme.primary.get()} />
                <YStack>
                  <TamaText color="$color" fontWeight="700" fontSize={14} fontFamily="$pixel">{zone.properties?.label || 'Unnamed Zone'}</TamaText>
                  <TamaText color="$color" fontSize={10} opacity={0.6} fontFamily="$pixel">{zone.properties?.radius || 200}m radius</TamaText>
                </YStack>
              </XStack>
              <HD2DButton label="X" size="$2" theme="red" onPress={() => handleDeleteZone(zone.id)} />
            </RetroCard>
          ))}
          {zones.length === 0 && (
            <TamaText color="$color" fontSize={10} textAlign="center" marginTop="$4" fontFamily="$pixel" opacity={0.4}>NO_PRIVACY_ZONES</TamaText>
          )}
        </YStack>

        <YStack gap="$2" marginTop="$4" paddingBottom="$10">
          <HD2DButton 
            theme="red" 
            label="LOGOUT_SESSION" 
            onPress={onLogout}
            height={50}
          />
        </YStack>

        <TamaText textAlign="center" fontSize={8} color="$color" opacity={0.4} paddingVertical="$2" fontFamily="$pixel">
          SOLAR_READY HUD v3.0 // ENGINE: HD-2D
        </TamaText>
        <TamaText textAlign="center" fontSize={7} color="$color" opacity={0.3} fontFamily="$pixel">
          BUILD: {Updates.updateId?.substring(0, 8) || 'DEV'}
        </TamaText>
      </ScrollView>
    </YStack>

  );
});
