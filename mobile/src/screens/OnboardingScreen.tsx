import React, { useState, useEffect } from 'react';
import { Alert, View, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeIn,
  FadeOut,
  SlideInRight
} from 'react-native-reanimated';
import { MapPin } from 'lucide-react-native';
import * as Location from 'expo-location';

import { Column } from '../components/Column';
import { Row } from '../components/Row';
import { PixelText } from '../components/PixelText';
import { ScrollContainer } from '../components/ScrollContainer';
import { GameCard } from '../components/GameCard';
import { ArcadeButton } from '../components/ArcadeButton';
import { useUnistyles } from 'react-native-unistyles';
import { SceneBackground } from '../components/scene/SceneBackground';
import { CyclistSprite } from '../components/sprites/CyclistSprite';
import { SpeechBubble } from '../components/narration/SpeechBubble';
import { useImmersiveTheme } from '../hooks/useImmersiveTheme';
import {
  AuthService,
  DepartmentService,
  EventService,
  type DepartmentTreeNode,
  type PublicTenantOption,
} from '../services/api';

interface OnboardingProps {
  user: any;
  onFinish: (data: any) => void | Promise<void>;
}

export const OnboardingScreen: React.FC<OnboardingProps> = ({ user, onFinish }) => {
  const { theme } = useUnistyles();
  const C = theme.colors as any;
  const { enabled: immersiveEnabled } = useImmersiveTheme();

  const STEP_COPY = [
    { bubble: 'Wybierz swoje miasto!', sprite: 'idle' as const },
    { bubble: 'Dołącz do drużyny!', sprite: 'cruise' as const },
    { bubble: 'Gotowy na wyścig?', sprite: 'attack' as const },
  ];

  const [step, setStep] = useState(0);
  const [tenants, setTenants] = useState<PublicTenantOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentTreeNode[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming((step + 1) / 3, { duration: 500 });
  }, [step]);

  useEffect(() => {
    AuthService.getPublicTenants()
      .then((rows) => {
        setTenants(rows);
        if (rows[0]?.id) setSelectedTenantId(rows[0].id);
      })
      .catch(() => setTenants([]));
    DepartmentService.getTree()
      .then((rows) => setDepartments(rows))
      .catch(() => setDepartments([]));
  }, []);

  const flattenDepartments = (nodes: DepartmentTreeNode[]): DepartmentTreeNode[] => {
    const out: DepartmentTreeNode[] = [];
    for (const n of nodes) {
      out.push(n);
      if (n.children?.length) out.push(...flattenDepartments(n.children));
    }
    return out;
  };

  const nextStep = async () => {
    if (step < 2) {
      setStep(step + 1);
      return;
    }

    setIsSubmitting(true);
    try {
      if (selectedTenantId) {
        await AuthService.updateProfile({ tenant_id: selectedTenantId });
      }
      if (selectedDepartmentId != null) {
        await DepartmentService.selfJoin(selectedDepartmentId);
      }
      try {
        const events = await EventService.list();
        const active = events.find((e) => e.status === 'ACTIVE');
        if (active) {
          await EventService.join(active.id);
        }
      } catch {
        // optional auto-join
      }
      await onFinish({
        tenant_id: selectedTenantId || null,
        department_id: selectedDepartmentId,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <CityStep
            tenants={tenants}
            selectedTenantId={selectedTenantId}
            setSelectedTenantId={setSelectedTenantId}
            onNext={() => void nextStep()}
            C={C}
          />
        );
      case 1:
        return (
          <DepartmentStep
            departments={flattenDepartments(departments)}
            selectedDepartmentId={selectedDepartmentId}
            setSelectedDepartmentId={setSelectedDepartmentId}
            onNext={() => void nextStep()}
            C={C}
          />
        );
      case 2:
        return (
          <FinishStep
            user={user}
            tenantName={tenants.find((t) => t.id === selectedTenantId)?.name ?? '—'}
            departmentName={
              flattenDepartments(departments).find((d) => d.id === selectedDepartmentId)?.name ?? '—'
            }
            onNext={() => void nextStep()}
            C={C}
            busy={isSubmitting}
          />
        );
      default: return null;
    }
  };

  return (
    <Column flex={1} style={{ backgroundColor: C.background, paddingTop: 48, position: 'relative' }} padding={16}>
      {immersiveEnabled && <SceneBackground sceneId="onboarding" scrim="soft" />}
      {immersiveEnabled && (
        <Column gap={8} style={{ alignItems: 'center', marginBottom: 8 }}>
          <CyclistSprite size={64} state={STEP_COPY[step]?.sprite ?? 'idle'} />
          <SpeechBubble text={STEP_COPY[step]?.bubble ?? ''} />
        </Column>
      )}
      {/* RPG-Style HUD Progress */}
      <Column gap={8} style={{ marginBottom: 24 }}>
        <Row justifyContent="space-between" alignItems="center">
          <PixelText size="xs" color={C.primary} style={{ fontSize: 8, color: C.primary }}>CHARACTER_INIT</PixelText>
          <PixelText size="xs" color={C.primary} style={{ fontSize: 8, color: C.primary }}>{Math.round(progress.value * 100)}%</PixelText>
        </Row>
        <Row style={{ height: 8, backgroundColor: C.onBackground, width: '100%', borderWidth: 1, borderColor: C.onBackground } as any}>
          <Animated.View style={[{ height: '100%', backgroundColor: C.primary }, useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }))]}>
            <View style={{ position: 'absolute', right: 0, width: 2, height: 12, backgroundColor: C.primary, top: -2 }} />
          </Animated.View>
        </Row>
      </Column>

      <ScrollContainer style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {renderStep()}
      </ScrollContainer>

      <Row justifyContent="space-between" alignItems="center" style={{ marginTop: 16, paddingBottom: 16 }}>
        <PixelText size="xs" color="muted" style={{ fontSize: 8 }}>
          STG_CITY // STEP_0{step + 1}
        </PixelText>
        <PixelText size="xs" color="muted" style={{ fontSize: 8 }}>4VELO_OS v1.0</PixelText>
      </Row>
    </Column>
  );
};

const CityStep = ({
  tenants,
  selectedTenantId,
  setSelectedTenantId,
  onNext,
  C,
}: any) => {

  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={{ flex: 1 }}>
      <GameCard variant="parchment" style={{ gap: 16 }}>
        <View style={{ borderWidth: 2, borderColor: C.primary, padding: 24, backgroundColor: C.parchment }}>
          <MapPin size={48} color={C.primary} />
        </View>
        <Column gap={8}>
          <PixelText size="lg" color={C.onBackground} style={{ color: C.onBackground }}>SELECT CITY</PixelText>
          <PixelText size="sm" color={C.onBackground} style={{ opacity: 0.8, color: C.onBackground }}>
            Choose the city tenant you will compete in.
          </PixelText>
        </Column>
        <Column gap={8}>
          {(tenants as PublicTenantOption[]).map((tenant) => (
            <Pressable
              key={tenant.id}
              onPress={() => setSelectedTenantId(tenant.id)}
              style={{
                borderWidth: 2,
                borderColor: C.onBackground,
                backgroundColor: selectedTenantId === tenant.id ? C.primaryContainer : C.parchment,
                padding: 12,
              }}
            >
              <PixelText size="sm" color={C.onBackground} style={{ color: C.onBackground }}>
                {tenant.name}
              </PixelText>
            </Pressable>
          ))}
        </Column>
        <ArcadeButton
          label="NEXT"
          onPress={onNext}
          variant="primary"
        />
      </GameCard>
    </Animated.View>
  );
};

const DepartmentStep = ({
  departments,
  selectedDepartmentId,
  setSelectedDepartmentId,
  onNext,
  C,
}: any) => {

  return (
    <Animated.View entering={SlideInRight} style={{ flex: 1 }}>
      <GameCard variant="parchment" style={{ gap: 24 }}>
        <PixelText size="lg" color={C.onBackground} style={{ color: C.onBackground }}>SELECT DEPARTMENT</PixelText>
        <PixelText size="sm" color={C.onBackground} style={{ opacity: 0.8, color: C.onBackground }}>
          Pick your department/team to join ranking cohorts.
        </PixelText>

        <Column gap={12}>
          {(departments as DepartmentTreeNode[]).map((department) => (
            <Pressable
              key={department.id}
              onPress={() => setSelectedDepartmentId(department.id)}
              style={{
                borderWidth: 2,
                borderColor: C.onBackground,
                backgroundColor: selectedDepartmentId === department.id ? C.primaryContainer : C.parchment,
                padding: 12,
              }}
            >
              <PixelText size="sm" color={C.onBackground} style={{ color: C.onBackground }}>
                {department.name}
              </PixelText>
            </Pressable>
          ))}
        </Column>

        <ArcadeButton label="NEXT" onPress={onNext} variant="primary" />
      </GameCard>
    </Animated.View>
  );
};

const FinishStep = ({ user, tenantName, departmentName, onNext, C, busy }: any) => {
  const requestPerms = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', '4VELO requires GPS to track your performance.');
      return;
    }
    await Location.requestBackgroundPermissionsAsync();
    onNext();
  };

  return (
    <Animated.View entering={SlideInRight} style={{ flex: 1 }}>
      <GameCard variant="parchment" style={{ gap: 24 }}>
        <PixelText size="lg" color={C.onBackground} style={{ color: C.onBackground }}>READY TO JOIN</PixelText>
        <PixelText size="sm" color={C.onBackground} style={{ opacity: 0.8, color: C.onBackground }}>
          Confirm city and department, then enable GPS and enter competition.
        </PixelText>
        <Column gap={8}>
          <PixelText size="sm" color={C.onBackground} style={{ color: C.onBackground }}>
            User: {user?.username ?? 'unknown'}
          </PixelText>
          <PixelText size="sm" color={C.onBackground} style={{ color: C.onBackground }}>
            City: {tenantName}
          </PixelText>
          <PixelText size="sm" color={C.onBackground} style={{ color: C.onBackground }}>
            Department: {departmentName}
          </PixelText>
        </Column>

        <ArcadeButton
          label={busy ? 'JOINING...' : 'JOIN COMPETITION'}
          onPress={() => void requestPerms()}
          variant="success"
        />
      </GameCard>
    </Animated.View>
  );
};
