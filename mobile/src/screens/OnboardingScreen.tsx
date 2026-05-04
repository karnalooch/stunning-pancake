import React, { useState, useEffect } from 'react';
import { StyleSheet, Dimensions, Alert, View, Pressable } from 'react-native';
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

import { Column } from '../components/Column';
import { Row } from '../components/Row';
import { PixelText } from '../components/PixelText';
import { RetroInput } from '../components/RetroInput';
import { ScrollContainer } from '../components/ScrollContainer';
import { GameCard } from '../components/GameCard';
import { ArcadeButton } from '../components/ArcadeButton';
import { colors as tokens } from '@tokens/generated/restyle-colors';

const { width, height } = Dimensions.get('window');

interface OnboardingProps {
  user: any;
  onFinish: (data: any) => void;
}

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
    <Column flex={1} style={{ backgroundColor: tokens.primitive.parchment, paddingTop: 48 }} padding={16}>
      {/* RPG-Style HUD Progress */}
      <Column gap={8} style={{ marginBottom: 24 }}>
        <Row justifyContent="space-between" alignItems="center">
          <PixelText size="xs" color="primary" style={{ fontSize: 8 }}>CHARACTER_INIT</PixelText>
          <PixelText size="xs" color="primary" style={{ fontSize: 8 }}>{Math.round(progress.value * 100)}%</PixelText>
        </Row>
        <Row style={{ height: 8, backgroundColor: tokens.primitive.pixelBlack, width: '100%', borderWidth: 1, borderColor: tokens.primitive.pixelBlack } as any}>
          <Animated.View style={[{ height: '100%', backgroundColor: tokens.semantic.primary }, useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }))]}>
            <View style={{ position: 'absolute', right: 0, width: 2, height: 12, backgroundColor: tokens.semantic.primary, top: -2 }} />
          </Animated.View>
        </Row>
      </Column>

      <ScrollContainer style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {renderStep()}
      </ScrollContainer>

      <Row justifyContent="space-between" alignItems="center" style={{ marginTop: 16, paddingBottom: 16 }}>
        <PixelText size="xs" color="muted" style={{ fontSize: 8 }}>
          STG_01 // LVL_0{step + 1}
        </PixelText>
        <PixelText size="xs" color="muted" style={{ fontSize: 8 }}>SPORT_OS v3.0</PixelText>
      </Row>
    </Column>
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
      <GameCard variant="parchment" style={{ alignItems: 'center', gap: 24 }}>
        <View style={{ borderWidth: 2, borderColor: tokens.semantic.success, padding: 24, backgroundColor: tokens.primitive.parchment }}>
          <MapPin size={48} color={tokens.semantic.success} />
        </View>
        <Column gap={16} alignItems="center">
          <PixelText size="lg" color="text" style={{ textAlign: 'center' }}>NEURAL_LINK</PixelText>
          <PixelText size="sm" color="text" style={{ textAlign: 'center', opacity: 0.8 }}>
            Enable GPS for real-time telemetry and character localization.
          </PixelText>
        </Column>
        <ArcadeButton
          label="AUTHORIZE ACCESS"
          onPress={requestPerms}
          variant="success"
        />
      </GameCard>
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
      <GameCard variant="parchment" style={{ gap: 24 }}>
        <PixelText size="lg" color="text">EXTERNAL_CORE</PixelText>
        <PixelText size="sm" color="text" style={{ opacity: 0.8 }}>Connect your wearable for One-Tap attribute sync.</PixelText>

        <Column gap={12}>
          <IntegrationCard
            label="STRAVA"
            icon={<Zap color="white" />}
            connected={formData.stravaConnected}
            onPress={() => connect('strava')}
            color={tokens.semantic.error}
          />
          <IntegrationCard
            label="GARMIN"
            icon={<Wifi color="white" />}
            connected={formData.garminConnected}
            onPress={() => connect('garmin')}
            color={tokens.octopath.buttonBlueBg}
          />
        </Column>

        <ArcadeButton
          label="SKIP FOR NOW"
          onPress={onNext}
          variant="ghost"
        />
      </GameCard>
    </Animated.View>
  );
};

const IntegrationCard = ({ label, icon, connected, onPress, color }: any) => (
  <Pressable onPress={onPress}>
    <Row
      style={{ backgroundColor: tokens.primitive.parchment, padding: 16, borderWidth: 1, borderColor: connected ? color : tokens.primitive.pixelBlack } as any}
      alignItems="center"
      justifyContent="space-between"
    >
      <Row gap={16} alignItems="center">
        <View style={{ backgroundColor: color, padding: 8 }}>{icon}</View>
        <PixelText size="sm" color="text">{label}</PixelText>
      </Row>
      {connected ? <Check color={tokens.semantic.success} /> : <ArrowRight color={tokens.octopath.text} opacity={0.3} />}
    </Row>
  </Pressable>
);

const DataValidationStep = ({ formData, setFormData, onNext }: any) => {
  return (
    <Animated.View entering={SlideInRight} style={{ flex: 1 }}>
      <GameCard variant="parchment" style={{ gap: 24 }}>
        <PixelText size="lg" color="text">BIOMETRIC_SYNC</PixelText>
        <PixelText size="sm" color="text" style={{ opacity: 0.8 }}>Verify physical parameters for power calculation.</PixelText>

        <Column gap={16}>
          <Column gap={8}>
            <PixelText size="xs" color="muted" style={{ fontSize: 8 }}>WEIGHT (KG)</PixelText>
            <RetroInput
              value={formData.weight}
              onChangeText={(t: string) => setFormData({ ...formData, weight: t })}
            />
          </Column>
          <Column gap={8}>
            <PixelText size="xs" color="muted" style={{ fontSize: 8 }}>HEIGHT (CM)</PixelText>
            <RetroInput
              value={formData.height}
              onChangeText={(t: string) => setFormData({ ...formData, height: t })}
            />
          </Column>
        </Column>

        <ArcadeButton label="VALIDATE DATA" onPress={onNext} variant="success" />
      </GameCard>
    </Animated.View>
  );
};

const AntiCheatStep = ({ onNext }: any) => (
  <Animated.View entering={SlideInRight} style={{ flex: 1 }}>
    <GameCard variant="parchment" style={{ alignItems: 'center', gap: 24 }}>
      <View style={{ borderWidth: 2, borderColor: tokens.semantic.primary, padding: 24, backgroundColor: tokens.primitive.parchment }}>
        <Shield size={48} color={tokens.semantic.primary} />
      </View>
      <Column gap={16} alignItems="center">
        <PixelText size="lg" color="primary" style={{ textAlign: 'center' }}>INTEGRITY</PixelText>
        <PixelText size="sm" color="text" style={{ textAlign: 'center', opacity: 0.8 }}>
          Our Viterbi Anti-Cheat engine is rigorous. Calibrate GPS before every mission.
        </PixelText>
      </Column>
      <ArcadeButton label="I ACKNOWLEDGE" onPress={onNext} variant="success" />
    </GameCard>
  </Animated.View>
);

const IdentityStep = ({ user, onNext }: any) => (
  <Animated.View entering={FadeIn} style={{ flex: 1 }}>
    <GameCard variant="parchment" style={{ alignItems: 'center', gap: 32 }}>
      <Column gap={8} alignItems="center">
        <PixelText size="lg" color="text">PILOT_ID</PixelText>
        <PixelText size="xs" color="muted" style={{ textAlign: 'center' }}>Scan at checkpoints for verification.</PixelText>
      </Column>

      <View style={{ backgroundColor: 'white', padding: 16, borderRadius: 0, borderWidth: 4, borderColor: tokens.semantic.success }}>
        <QRCode
          value={`sport_v1:pilot:${user?.id || 'unknown'}`}
          size={160}
          color={tokens.primitive.pixelBlack} backgroundColor="#FFFFFF" />
      </View>

      <Column alignItems="center" gap={8}>
        <PixelText size="md" color="success">{user?.username?.toUpperCase() || 'UNIDENTIFIED'}</PixelText>
        <PixelText size="xs" color="muted" style={{ fontSize: 8 }}>UID: {String(user?.id || '').slice(0, 8) || '####'}</PixelText>
      </Column>

      <ArcadeButton label="INITIALIZE MISSION" onPress={onNext} variant="success" />
    </GameCard>
  </Animated.View>
);
