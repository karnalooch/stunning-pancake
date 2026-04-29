import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import * as Updates from 'expo-updates';
import { User, Shield, MapPin, LogOut, Trash2, Plus, Zap, Activity } from 'lucide-react-native';
import { YStack, XStack, Text as TamaText, Button as TamaButton, H2, Paragraph, ScrollView, Switch, Circle } from 'tamagui';
import { observer, useObservable } from '@legendapp/state/react';
import { AuthService, PrivacyService } from '../services/api';

const ShieldIcon = Shield as any;
const PlusIcon = Plus as any;
const MapPinIcon = MapPin as any;
const TrashIcon = Trash2 as any;
const LogOutIcon = LogOut as any;
const ZapIcon = Zap as any;
const ActivityIcon = Activity as any;

export const ProfileScreen = observer(({ user: initialUser, onLogout }: { user: any, onLogout: () => void }) => {
  const state = useObservable({
    user: initialUser || null,
    zones: [] as any[],
    isIncognito: false,
    integritySensitivity: 0.5,
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
        <TamaText fontWeight="900" fontSize={28} color="white">Profile</TamaText>
        <TamaButton size="$2" chromeless onPress={handleRefresh}>
          <TamaText color="$blue10" fontSize={12} fontWeight="700">REFRESH</TamaText>
        </TamaButton>
      </XStack>

      <YStack alignItems="center" marginBottom="$8">
        <Circle size={100} backgroundColor="$gray1" borderWidth={1} borderColor="$gray4" marginBottom="$4">
          <TamaText color="white" fontSize={42} fontWeight="900">
            {user?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
          </TamaText>
        </Circle>
        <TamaText color="white" fontSize={22} fontWeight="900">{user?.username || user?.email || 'Pilot'}</TamaText>
        <TamaText color="$gray10" fontSize={14} marginTop="$1">{user?.email || 'No email provided'}</TamaText>
        {!user && <TamaText color="$red10" fontSize={12} marginTop="$2">Data Sync Error</TamaText>}
      </YStack>

      <ScrollView paddingHorizontal="$4" paddingBottom="$10">
        {(user?.role === 'GLOBAL_OWNER' || user?.role === 'TENANT_ADMIN' || user?.role === 'TENANT_MODERATOR') && (
          <YStack gap="$2" marginBottom="$6">
            <TamaText color="$blue10" fontSize={10} fontWeight="800" letterSpacing={1}>OPERATIONS CONTROL</TamaText>
            <YStack backgroundColor="rgba(59, 130, 246, 0.1)" padding="$4" borderRadius="$4" gap="$4">
              <XStack justifyContent="space-between" alignItems="center">
                <XStack alignItems="center" gap="$3">
                  <ZapIcon size={20} color="#3B82F6" />
                  <YStack>
                    <TamaText color="white" fontWeight="700" fontSize={14}>Integrity Guard</TamaText>
                    <TamaText color="$gray10" fontSize={11}>Anti-Cheat sensitivity level</TamaText>
                  </YStack>
                </XStack>
                <TamaText color="$blue10" fontWeight="900">{(integritySensitivity * 100).toFixed(0)}%</TamaText>
              </XStack>
              
              <XStack gap="$2" marginTop="$2">
                {[0.25, 0.5, 0.75, 1.0].map((val) => (
                  <TamaButton 
                    key={val}
                    flex={1} 
                    size="$2" 
                    backgroundColor={integritySensitivity === val ? "$blue10" : "$gray2"}
                    onPress={() => state.integritySensitivity.set(val)}
                  >
                    <TamaText color="white" fontSize={10} fontWeight="700">
                      {val === 1.0 ? 'MAX' : `${(val * 100)}%`}
                    </TamaText>
                  </TamaButton>
                ))}
              </XStack>
            </YStack>
          </YStack>
        )}

        <YStack gap="$2" marginBottom="$6">
          <TamaText color="$gray10" fontSize={10} fontWeight="800" letterSpacing={1}>PRIVACY SETTINGS</TamaText>
          <XStack justifyContent="space-between" alignItems="center" backgroundColor="$gray1" padding="$4" borderRadius="$4">
            <XStack alignItems="center" gap="$3">
              <ShieldIcon size={20} color="#00D1FF" />
              <YStack>
                <TamaText color="white" fontWeight="700" fontSize={14}>Incognito Mode</TamaText>
                <TamaText color="$gray10" fontSize={11}>Hide from leaderboards</TamaText>
              </YStack>
            </XStack>
            <Switch 
              size="$2" 
              checked={isIncognito} 
              onCheckedChange={(val) => state.isIncognito.set(val)}
            >
              <Switch.Thumb />
            </Switch>


          </XStack>
        </YStack>

        <YStack gap="$2" marginBottom="$6">
          <XStack justifyContent="space-between" alignItems="center">
            <TamaText color="$gray10" fontSize={10} fontWeight="800" letterSpacing={1}>PRIVACY ZONES</TamaText>
            <TamaButton size="$2" circular icon={PlusIcon} backgroundColor="$blue10" />
          </XStack>
          
          {zones.map((zone: any) => (
            <XStack key={zone.id} justifyContent="space-between" alignItems="center" backgroundColor="$gray1" padding="$4" borderRadius="$4">
              <XStack alignItems="center" gap="$3">
                <MapPinIcon size={20} color="$blue10" />
                <YStack>
                  <TamaText color="white" fontWeight="700" fontSize={14}>{zone.properties?.label || 'Unnamed Zone'}</TamaText>
                  <TamaText color="$gray10" fontSize={11}>{zone.properties?.radius || 200}m radius</TamaText>
                </YStack>
              </XStack>
              <TamaButton size="$2" circular icon={TrashIcon} chromeless onPress={() => handleDeleteZone(zone.id)} />
            </XStack>
          ))}
          {zones.length === 0 && (
            <TamaText color="$gray10" fontSize={12} textAlign="center" marginTop="$4">No privacy zones active.</TamaText>
          )}
        </YStack>

        <YStack gap="$2" marginTop="$4">
          <TamaButton 
            backgroundColor="$red10" 
            icon={LogOutIcon} 
            onPress={onLogout}
          >
            <TamaText color="white" fontWeight="700">LOGOUT</TamaText>
          </TamaButton>
        </YStack>

        <TamaText color="$gray8" fontSize={10} textAlign="center" marginTop="$10">
          SPORT CORE v2.4-STABILITY
        </TamaText>
        <TamaText color="$gray8" fontSize={9} textAlign="center" marginTop="$1">
          {Updates.isEmbeddedLaunch ? `Embedded Build (${Updates.runtimeVersion || '1.0.0'})` : `EAS Update: ${Updates.updateId?.substring(0, 8) || 'N/A'} (${Updates.runtimeVersion || '1.0.0'})`}
        </TamaText>
      </ScrollView>
    </YStack>
  );
});
