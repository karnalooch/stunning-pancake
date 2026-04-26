import React from 'react';
import { Gift, MapPin, Tag } from 'lucide-react-native';
import { YStack, XStack, Text as TamaText, H1, H2, Paragraph, ScrollView, Card, Button as TamaButton } from 'tamagui';

const GiftIcon = Gift as any;
const MapPinIcon = MapPin as any;
const TagIcon = Tag as any;

const MOCK_REWARDS = [
  { id: 1, shop: 'Eco Coffee', offer: '-20% on any Latte', cost: '500 XP' },
  { id: 2, shop: 'FitStore', offer: 'Free Energy Bar', cost: '1200 XP' },
  { id: 3, shop: 'CycleWorld', offer: '-15% Service', cost: '2500 XP' },
];

export const RewardsScreen = () => {
  return (
    <YStack flex={1} backgroundColor="$background" paddingTop="$10" paddingHorizontal="$4">
      <TamaText fontWeight="900" fontSize={28} color="white" marginBottom="$6">Rewards</TamaText>
      
      <XStack backgroundColor="$blue10" padding="$6" borderRadius="$6" justifyContent="space-between" alignItems="center" marginBottom="$8">
        <YStack>
          <TamaText color="rgba(255,255,255,0.7)" fontSize={10} fontWeight="800" letterSpacing={1}>AVAILABLE BALANCE</TamaText>
          <TamaText color="white" fontSize={32} fontWeight="900" marginTop="$1">1,842 XP</TamaText>
        </YStack>
        <GiftIcon size={32} color="white" opacity={0.5} />
      </XStack>

      <ScrollView>
        <YStack gap="$4">
          {MOCK_REWARDS.map((reward) => (
            <XStack key={reward.id} backgroundColor="$gray1" padding="$4" borderRadius="$4" alignItems="center" gap="$4" borderLeftWidth={4} borderLeftColor="$blue10">
              <YStack backgroundColor="$gray2" padding="$2.5" borderRadius="$3" alignItems="center" justifyContent="center">
                <TagIcon size={20} color="white" />
              </YStack>
              
              <YStack flex={1}>
                <TamaText color="$gray10" fontSize={10} fontWeight="800" textTransform="uppercase">{reward.shop}</TamaText>
                <TamaText color="white" fontWeight="800" fontSize={16} marginVertical="$0.5">{reward.offer}</TamaText>
                <XStack alignItems="center" gap="$1">
                  <MapPinIcon size={12} color="$gray8" />
                  <TamaText color="$gray8" fontSize={11}>Siedlce, Center</TamaText>
                </XStack>
              </YStack>

              <YStack backgroundColor="$gray3" paddingHorizontal="$2" paddingVertical="$1" borderRadius="$2">
                <TamaText color="white" fontSize={11} fontWeight="900">{reward.cost}</TamaText>
              </YStack>
            </XStack>
          ))}
        </YStack>
      </ScrollView>
    </YStack>
  );
};
