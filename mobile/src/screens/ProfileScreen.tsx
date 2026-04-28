import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import * as Updates from 'expo-updates';
import { User, Shield, MapPin, LogOut, Trash2, Plus, Zap, Activity } from 'lucide-react-native';
import { YStack, XStack, Text as TamaText, Button as TamaButton, H2, Paragraph, ScrollView, Switch, Circle, Slider } from 'tamagui';
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
            <YStack backgroundColor="rgba(59, 130, 246, 0.1)" padding="$4" borderRadius="$4" gap="$4" borderWidth={1} borderColor="rgba(59, 130, 246, 0.2)">
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
              <Slider 
                value={[integritySensitivity * 100]} 
                onValueChange={(val) => state.integritySensitivity.set(val[0] / 100)}
                max={100} 
                step={5}
              >
                <Slider.Track backgroundColor="$gray4">
                  <Slider.ActiveTrack backgroundColor="$blue10" />
                </Slider.Track>
                <Slider.Thumb index={0} circular elevation="$4" />
              </Slider>
            </YStack>
          </YStack>
        )}

        <YStack gap="$2" marginBottom="$6">
          <TamaText color="$gray10" fontSize={10} fontWeight="800" letterSpacing={1}>PRIVACY SETTINGS</TamaText>
          <XStack justifyContent="space-between" alignItems="center" backgroundColor="$gray1" padding="$4" borderRadius="$4">
            <XStack alignItems="center" gap="$3">
              <ShieldIcon size={20} color="#00D1FF" />
              <YStack>
                <TamaText color="white" fontWeight="700" fontSize={14}>Global Incognito</TamaText>
                <TamaText color="$gray10" fontSize={11}>Mask all tracks by default</TamaText>
              </YStack>
            </XStack>
            <Switch 
              size="$3" 
              checked={isIncognito} 
              onCheckedChange={(val) => state.isIncognito.set(val)}
            >
              <Switch.Thumb />
            </Switch>
          </XStack>
        </YStack>

        <YStack gap="$4">
          <XStack justifyContent="space-between" alignItems="center">
            <TamaText color="$gray10" fontSize={10} fontWeight="800" letterSpacing={1}>PRIVACY ZONES</TamaText>
            <TamaButton size="$2" circular backgroundColor="$blue10" icon={<PlusIcon size={16} color="white" />} />
          </XStack>
          
          {zones.length === 0 ? (
            <TamaText color="$gray10" fontSize={12} textAlign="center" paddingVertical="$4" fontStyle="italic">
              No zones defined. Add your home or office to mask your starts and finishes.
            </TamaText>
          ) : (
            zones.filter(Boolean).map((zone: any) => {
              const id = zone.id;
              const name = zone.properties?.label || zone.label || zone.name || 'Unnamed Zone';
              const radius = zone.properties?.radius || zone.radius || 200;
              return (
                <XStack key={id} justifyContent="space-between" alignItems="center" backgroundColor="$gray1" padding="$4" borderRadius="$4">
                  <XStack alignItems="center" gap="$3">
                    <MapPinIcon size={18} color="$gray10" />
                    <YStack>
                      <TamaText color="white" fontWeight="700" fontSize={14}>{name}</TamaText>
                      <TamaText color="$gray10" fontSize={11}>{radius}m Radius</TamaText>
                    </YStack>
                  </XStack>
                  <TamaButton chromeless onPress={() => handleDeleteZone(id)}>
                    <TrashIcon size={18} color="$red10" />
                  </TamaButton>
                </XStack>
              );
            })
          )}
        </YStack>

        <TamaButton 
          marginTop="$6"
          backgroundColor="transparent"
          alignItems="center" 
          justifyContent="center" 
          gap="$3" 
          onPress={onLogout}
        >
          <LogOutIcon size={20} color="$red10" />
          <TamaText color="$red10" fontWeight="900" fontSize={14} letterSpacing={1}>Log Out</TamaText>
        </TamaButton>

        <TamaText color="$gray8" fontSize={10} textAlign="center" marginTop="$4" marginBottom="$8">
          {Updates.isEmbeddedLaunch ? `Embedded Build (${Updates.runtimeVersion || '1.0.0'})` : `EAS Update: ${Updates.updateId?.substring(0, 8) || 'N/A'} (${Updates.runtimeVersion || '1.0.0'})`}
        </TamaText>
      </ScrollView>
    </YStack>
  );
});
