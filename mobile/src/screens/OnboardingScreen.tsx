import React, { useState, useEffect } from 'react';
import { StyleSheet, Dimensions, Alert } from 'react-native';
import { YStack, XStack, Text, Button, H1, View, Input, Label, Circle } from 'tamagui';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSpring,
  withSequence,
  withDelay,
  Easing,
  FadeIn,
  FadeOut,
  SlideInRight
} from 'react-native-reanimated';
import { Shield, Zap, MapPin, Activity, QrCode, ArrowRight, Check, Wifi } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Location from 'expo-location';

const { width, height } = Dimensions.get('window');

interface OnboardingProps {
  user: any;
  onFinish: (data: any) => void;
}

const ACTION_CYAN = '#FF6B35'; // Metal Slug Orange (Legacy name)
const SOLAR_YELLOW = '#D4A373'; // Octopath Gold (Legacy name)
const VOID_BLACK = '#0B1D33'; // Dave the Diver Deep Blue (Legacy name)

export const OnboardingScreen: React.FC<OnboardingProps> = ({ user, onFinish }) => {
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
    <YStack flex={1} backgroundColor={VOID_BLACK} padding="$6" paddingTop="$12">
      {/* HUD Progress Bar */}
      <XStack height={4} backgroundColor="#111" width="100%" marginBottom="$8" borderWidth={1} borderColor="#222">
        <Animated.View style={[{ height: '100%', backgroundColor: ACTION_CYAN }, useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }))]}>
           <View position="absolute" right={0} width={2} height={10} backgroundColor={ACTION_CYAN} top={-3} />
        </Animated.View>
      </XStack>

      <View flex={1}>
        {renderStep()}
      </View>

      <XStack justifyContent="space-between" alignItems="center" marginTop="$4">
        <Text color="$gray10" fontSize={10} ff="monospace" letterSpacing={2}>
          STAGE_01 // LEVEL_0{step + 1}
        </Text>
        <Text color="$gray10" fontSize={10} ff="monospace">MISSION_START</Text>
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
    <Animated.View entering={FadeIn} exiting={FadeOut} style={{ flex: 1, justifyContent: 'center' }}>
      <YStack gap="$6" alignItems="center">
        <View borderWidth={2} borderColor={ACTION_CYAN} padding="$6">
           <MapPin size={48} color={ACTION_CYAN} />
        </View>
        <YStack gap="$2" alignItems="center">
          <H1 color="white" fontWeight="900" textAlign="center" letterSpacing={2}>NEURAL_LINK</H1>
          <Text color="$gray10" textAlign="center" fontSize={14}>Enable GPS for real-time telemetry and geofencing.</Text>
        </YStack>
        <Button 
          backgroundColor={ACTION_CYAN} 
          borderRadius={0} 
          width="100%" 
          onPress={requestPerms}
          pressStyle={{ scale: 0.98 }}
        >
          <Text color="black" fontWeight="900" letterSpacing={2}>AUTHORIZE ACCESS</Text>
        </Button>
      </YStack>
    </Animated.View>
  );
};

const IntegrationsStep = ({ formData, setFormData, onNext }: any) => {
  const connect = (service: string) => {
    setFormData({ ...formData, [`${service}Connected`]: true });
    // Simulate data fetch
    Alert.alert(`${service} Connected`, "Biometric data synchronized successfully.");
  };

  return (
    <Animated.View entering={SlideInRight} style={{ flex: 1, justifyContent: 'center' }}>
      <YStack gap="$6">
        <H1 color="white" fontWeight="900" letterSpacing={2}>EXTERNAL_CORE</H1>
        <Text color="$gray10" fontSize={14}>Connect your wearable for One-Tap onboarding.</Text>
        
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

        <Button 
          backgroundColor="transparent" 
          borderWidth={1} 
          borderColor="$gray8" 
          borderRadius={0}
          onPress={onNext}
        >
          <Text color="white" fontWeight="900" letterSpacing={2}>SKIP FOR NOW</Text>
        </Button>
      </YStack>
    </Animated.View>
  );
};

const IntegrationCard = ({ label, icon, connected, onPress, color }: any) => (
  <XStack 
    backgroundColor="#111" 
    padding="$4" 
    alignItems="center" 
    justifyContent="space-between"
    borderWidth={1}
    borderColor={connected ? color : '#222'}
    onPress={onPress}
  >
    <XStack gap="$4" alignItems="center">
      <View backgroundColor={color} padding="$2">{icon}</View>
      <Text color="white" fontWeight="900" letterSpacing={1}>{label}</Text>
    </XStack>
    {connected ? <Check color={ACTION_CYAN} /> : <ArrowRight color="#444" />}
  </XStack>
);

const DataValidationStep = ({ formData, setFormData, onNext }: any) => {
  return (
    <Animated.View entering={SlideInRight} style={{ flex: 1, justifyContent: 'center' }}>
      <YStack gap="$6">
        <H1 color="white" fontWeight="900" letterSpacing={2}>BIOMETRIC_SYNC</H1>
        <Text color="$gray10" fontSize={14}>Verify your physical parameters for power calculation.</Text>
        
        <YStack gap="$4">
          <YStack gap="$2">
            <Label color="$gray10" fontSize={10} fontWeight="900">WEIGHT (KG)</Label>
            <Input 
              value={formData.weight} 
              onChangeText={(t) => setFormData({...formData, weight: t})}
              backgroundColor="#111" borderRadius={0} color="white" fontWeight="900"
            />
          </YStack>
          <YStack gap="$2">
            <Label color="$gray10" fontSize={10} fontWeight="900">HEIGHT (CM)</Label>
            <Input 
              value={formData.height} 
              onChangeText={(t) => setFormData({...formData, height: t})}
              backgroundColor="#111" borderRadius={0} color="white" fontWeight="900"
            />
          </YStack>
        </YStack>

        <Button backgroundColor={ACTION_CYAN} borderRadius={0} onPress={onNext}>
          <Text color="black" fontWeight="900" letterSpacing={2}>VALIDATE DATA</Text>
        </Button>
      </YStack>
    </Animated.View>
  );
};

const AntiCheatStep = ({ onNext }: any) => (
  <Animated.View entering={SlideInRight} style={{ flex: 1, justifyContent: 'center' }}>
    <YStack gap="$6" alignItems="center">
      <View borderWidth={2} borderColor={SOLAR_YELLOW} padding="$6">
         <Shield size={48} color={SOLAR_YELLOW} />
      </View>
      <YStack gap="$2" alignItems="center">
        <H1 color={SOLAR_YELLOW} fontWeight="900" textAlign="center" letterSpacing={2}>INTEGRITY_CHECK</H1>
        <Text color="$gray10" textAlign="center" fontSize={14}>Our Viterbi Anti-Cheat engine is rygorous. Ensure your GPS is calibrated before every mission.</Text>
      </YStack>
      <Button backgroundColor={SOLAR_YELLOW} borderRadius={0} width="100%" onPress={onNext}>
        <Text color="black" fontWeight="900" letterSpacing={2}>I ACKNOWLEDGE</Text>
      </Button>
    </YStack>
  </Animated.View>
);

const IdentityStep = ({ user, onNext }: any) => (
  <Animated.View entering={FadeIn} style={{ flex: 1, justifyContent: 'center' }}>
    <YStack gap="$8" alignItems="center">
      <YStack gap="$2" alignItems="center">
        <H1 color="white" fontWeight="900" letterSpacing={2}>PILOT_IDENTITY</H1>
        <Text color="$gray10" fontSize={12} textAlign="center">Scan at city checkpoints for mission verification.</Text>
      </YStack>

      <View backgroundColor="white" padding="$4" borderRadius={0} borderWidth={4} borderColor={ACTION_CYAN}>
        <QRCode 
          value={`sport_v1:pilot:${user?.id || 'unknown'}`} 
          size={180}
          color="#050505"
        />
      </YStack>

      <YStack alignItems="center">
         <Text color={ACTION_CYAN} fontWeight="900" fontSize={18} ff="monospace">{user?.username?.toUpperCase() || 'UNIDENTIFIED'}</Text>
         <Text color="$gray10" fontSize={10} ff="monospace">ID: {user?.id?.substring(0, 8) || '####'}</Text>
      </YStack>

      <Button backgroundColor={ACTION_CYAN} borderRadius={0} width="100%" onPress={onNext}>
        <Text color="black" fontWeight="900" letterSpacing={2}>INITIALIZE MISSION</Text>
      </Button>
    </YStack>
  </Animated.View>
);
