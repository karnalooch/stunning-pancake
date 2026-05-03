import React, { useState, useEffect } from 'react';
import { StyleSheet, Dimensions, Alert } from 'react-native';
import { YStack, XStack, Text, H1, View, Input, Label, ScrollView, useTheme } from 'tamagui';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  FadeIn,
  FadeOut,
  SlideInRight
} from 'react-native-reanimated';
import { Shield, Zap, MapPin, ArrowRight, Check, Wifi } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Location from 'expo-location';

import { RetroCard } from '../components/RetroCard';
import { HD2DButton } from '../components/HD2DButton';

const { width, height } = Dimensions.get('window');

interface OnboardingProps {
  user: any;
  onFinish: (data: any) => void;
}

export const OnboardingScreen: React.FC<OnboardingProps> = ({ user, onFinish }) => {
  const theme = useTheme();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    weight: '75',
    height: '180',
    age: '28',
    stravaConnected: false,
    garminConnected: false,
  });

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming((step + 1) / 5, { duration: 500 });
  }, [step]);

  const nextStep = () => {
    if (step < 4) setStep(step + 1);
    else onFinish(formData);
  };

  const renderStep = () => {
    switch (step) {
      case 0: return <PermissionsStep onNext={nextStep} />;
      case 1: return <IntegrationsStep formData={formData} setFormData={setFormData} onNext={nextStep} />;
      case 2: return <DataValidationStep formData={formData} setFormData={setFormData} onNext={nextStep} />;
      case 3: return <AntiCheatStep onNext={nextStep} />;
      case 4: return <IdentityStep user={user} onNext={nextStep} />;
      default: return null;
    }
  };

  return (
    <YStack flex={1} backgroundColor="$background" padding="$4" paddingTop="$12">
      {/* RPG-Style HUD Progress */}
      <YStack marginBottom="$6" gap="$2">
        <XStack justifyContent="space-between" alignItems="center">
           <Text color="$primary" fontFamily="$pixel" fontSize={8}>CHARACTER_INIT</Text>
           <Text color="$primary" fontFamily="$pixel" fontSize={8}>{Math.round(progress.value * 100)}%</Text>
        </XStack>
        <XStack height={8} backgroundColor="#111" width="100%" borderWidth={1} borderColor="$hd2d.outlineColor">
          <Animated.View style={[{ height: '100%', backgroundColor: theme.primary.get() }, useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }))]}>
             <View position="absolute" right={0} width={2} height={12} backgroundColor={theme.primary.get()} top={-2} />
          </Animated.View>
        </XStack>
      </YStack>

      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        {renderStep()}
      </ScrollView>

      <XStack justifyContent="space-between" alignItems="center" marginTop="$4" paddingBottom="$4">
        <Text color="$color" opacity={0.5} fontSize={8} fontFamily="$pixel">
          STG_01 // LVL_0{step + 1}
        </Text>
        <Text color="$color" opacity={0.5} fontSize={8} fontFamily="$pixel">SPORT_OS v3.0</Text>
      </XStack>
    </YStack>
  );
};

const PermissionsStep = ({ onNext }: any) => {
  const requestPerms = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      await Location.requestBackgroundPermissionsAsync();
      onNext();
    } else {
      Alert.alert("Permission Required", "SPORT requires GPS to track your performance.");
    }
  };

  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={{ flex: 1 }}>
      <RetroCard gap="$6" alignItems="center">
        <View borderWidth={2} borderColor="$accent" padding="$6" backgroundColor="$background">
           <MapPin size={48} color="$accent" />
        </View>
        <YStack gap="$4" alignItems="center">
          <Text color="$color" fontSize={18} fontFamily="$pixel" textAlign="center">NEURAL_LINK</Text>
          <Text color="$color" textAlign="center" fontSize={12} opacity={0.8}>
            Enable GPS for real-time telemetry and character localization.
          </Text>
        </YStack>
        <HD2DButton 
          label="AUTHORIZE ACCESS"
          width="100%" 
          onPress={requestPerms}
          theme="green"
        />
      </RetroCard>
    </Animated.View>
  );
};

const IntegrationsStep = ({ formData, setFormData, onNext }: any) => {
  const connect = (service: string) => {
    setFormData({ ...formData, [`${service}Connected`]: true });
    Alert.alert(`${service} Connected`, "Biometric data synchronized successfully.");
  };

  return (
    <Animated.View entering={SlideInRight} style={{ flex: 1 }}>
      <RetroCard gap="$6">
        <Text color="$color" fontSize={18} fontFamily="$pixel">EXTERNAL_CORE</Text>
        <Text color="$color" fontSize={12} opacity={0.8}>Connect your wearable for One-Tap attribute sync.</Text>
        
        <YStack gap="$3">
          <IntegrationCard 
            label="STRAVA" 
            icon={<Zap color="white" />} 
            connected={formData.stravaConnected} 
            onPress={() => connect('strava')}
            color="#FC4C02"
          />
          <IntegrationCard 
            label="GARMIN" 
            icon={<Wifi color="white" />} 
            connected={formData.garminConnected} 
            onPress={() => connect('garmin')}
            color="#007CC3"
          />
        </YStack>

        <HD2DButton 
          label="SKIP FOR NOW"
          onPress={onNext}
          backgroundColor="transparent"
          borderWidth={1}
        />
      </RetroCard>
    </Animated.View>
  );
};

const IntegrationCard = ({ label, icon, connected, onPress, color }: any) => (
  <XStack 
    backgroundColor="$background" 
    padding="$4" 
    alignItems="center" 
    justifyContent="space-between"
    borderWidth={1}
    borderColor={connected ? color : '$hd2d.outlineColor'}
    onPress={onPress}
  >
    <XStack gap="$4" alignItems="center">
      <View backgroundColor={color} padding="$2">{icon}</View>
      <Text color="$color" fontSize={12} fontFamily="$pixel">{label}</Text>
    </XStack>
    {connected ? <Check color="$accent" /> : <ArrowRight color="$color" opacity={0.3} />}
  </XStack>
);

const DataValidationStep = ({ formData, setFormData, onNext }: any) => {
  return (
    <Animated.View entering={SlideInRight} style={{ flex: 1 }}>
      <RetroCard gap="$6">
        <Text color="$color" fontSize={18} fontFamily="$pixel">BIOMETRIC_SYNC</Text>
        <Text color="$color" fontSize={12} opacity={0.8}>Verify physical parameters for power calculation.</Text>
        
        <YStack gap="$4">
          <YStack gap="$2">
            <Label color="$color" fontSize={8} fontFamily="$pixel" opacity={0.6}>WEIGHT (KG)</Label>
            <Input 
              value={formData.weight} 
              onChangeText={(t) => setFormData({...formData, weight: t})}
              backgroundColor="$background" borderRadius={0} color="$color" borderWidth={1} borderColor="$hd2d.outlineColor"
            />
          </YStack>
          <YStack gap="$2">
            <Label color="$color" fontSize={8} fontFamily="$pixel" opacity={0.6}>HEIGHT (CM)</Label>
            <Input 
              value={formData.height} 
              onChangeText={(t) => setFormData({...formData, height: t})}
              backgroundColor="$background" borderRadius={0} color="$color" borderWidth={1} borderColor="$hd2d.outlineColor"
            />
          </YStack>
        </YStack>

        <HD2DButton label="VALIDATE DATA" onPress={onNext} theme="green" />
      </RetroCard>
    </Animated.View>
  );
};

const AntiCheatStep = ({ onNext }: any) => (
  <Animated.View entering={SlideInRight} style={{ flex: 1 }}>
    <RetroCard gap="$6" alignItems="center">
      <View borderWidth={2} borderColor="$primary" padding="$6" backgroundColor="$background">
         <Shield size={48} color="$primary" />
      </View>
      <YStack gap="$4" alignItems="center">
        <Text color="$primary" fontSize={18} fontFamily="$pixel" textAlign="center">INTEGRITY</Text>
        <Text color="$color" textAlign="center" fontSize={12} opacity={0.8}>
          Our Viterbi Anti-Cheat engine is rigorous. Calibrate GPS before every mission.
        </Text>
      </YStack>
      <HD2DButton label="I ACKNOWLEDGE" width="100%" onPress={onNext} theme="green" />
    </RetroCard>
  </Animated.View>
);

const IdentityStep = ({ user, onNext }: any) => (
  <Animated.View entering={FadeIn} style={{ flex: 1 }}>
    <RetroCard gap="$8" alignItems="center">
      <YStack gap="$2" alignItems="center">
        <Text color="$color" fontSize={18} fontFamily="$pixel">PILOT_ID</Text>
        <Text color="$color" fontSize={10} opacity={0.6} textAlign="center">Scan at checkpoints for verification.</Text>
      </YStack>

      <View backgroundColor="white" padding="$4" borderRadius={0} borderWidth={4} borderColor="$accent">
        <QRCode 
          value={`sport_v1:pilot:${user?.id || 'unknown'}`} 
          size={160}
          color="#000000" backgroundColor="#FFFFFF" />
      </View>

      <YStack alignItems="center" gap="$2">
         <Text color="$accent" fontSize={14} fontFamily="$pixel">{user?.username?.toUpperCase() || 'UNIDENTIFIED'}</Text>
         <Text color="$color" fontSize={8} opacity={0.5} fontFamily="$pixel">UID: {String(user?.id || '').slice(0, 8) || '####'}</Text>
      </YStack>

      <HD2DButton label="INITIALIZE MISSION" width="100%" onPress={onNext} theme="green" />
    </RetroCard>
  </Animated.View>
);

