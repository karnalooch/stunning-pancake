import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import * as Updates from 'expo-updates';
import { User, Shield, MapPin, LogOut, Trash2, Plus } from 'lucide-react-native';
import { YStack, XStack, Text as TamaText, Button as TamaButton, H2, Paragraph, ScrollView, Switch, Circle } from 'tamagui';
import { observer, useObservable } from '@legendapp/state/react';
import { AuthService, PrivacyService } from '../services/api';

const ShieldIcon = Shield as any;
const PlusIcon = Plus as any;
const MapPinIcon = MapPin as any;
const TrashIcon = Trash2 as any;
const LogOutIcon = LogOut as any;

export const ProfileScreen = observer(({ onLogout }: any) => {
  const state = useObservable({
    user: null as any,
    zones: [] as any[],
    isIncognito: false,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const profile = await AuthService.getProfile();
        state.user.set(profile);
        const zoneData = await PrivacyService.getZones();
        state.zones.set(zoneData);
      } catch (e) {
        console.error(e);
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

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop="$10">
      <TamaText paddingHorizontal="$4" fontWeight="900" fontSize={28} color="white" marginBottom="$4">Profile</TamaText>

      <YStack alignItems="center" marginBottom="$8">
        <Circle size={100} backgroundColor="$gray1" borderWidth={1} borderColor="$gray4" marginBottom="$4">
          <TamaText color="white" fontSize={42} fontWeight="900">{user?.username?.[0]?.toUpperCase() || 'U'}</TamaText>
        </Circle>
        <TamaText color="white" fontSize={22} fontWeight="900">{user?.username || 'Loading...'}</TamaText>
        <TamaText color="$gray10" fontSize={14} marginTop="$1">{user?.email || 'athlete@sport.com'}</TamaText>
      </YStack>

      <ScrollView paddingHorizontal="$4" paddingBottom="$10">
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
              checked={state.isIncognito.get()} 
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
            zones.filter(Boolean).map((zone: any) => (
              <XStack key={zone.id} justifyContent="space-between" alignItems="center" backgroundColor="$gray1" padding="$4" borderRadius="$4">
                <XStack alignItems="center" gap="$3">
                  <MapPinIcon size={18} color="$gray10" />
                  <YStack>
                    <TamaText color="white" fontWeight="700" fontSize={14}>{zone.name || 'Unnamed Zone'}</TamaText>
                    <TamaText color="$gray10" fontSize={11}>{zone.radius || 200}m Radius</TamaText>
                  </YStack>
                </XStack>
                <TamaButton chromeless onPress={() => handleDeleteZone(zone.id)}>
                  <TrashIcon size={18} color="$red10" />
                </TamaButton>
              </XStack>
            ))
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
