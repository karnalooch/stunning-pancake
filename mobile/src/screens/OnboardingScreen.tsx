import React, { useMemo, useState, useEffect } from 'react';
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
import { ArcadeButton } from '../components/ArcadeButton';
import { useUnistyles } from 'react-native-unistyles';
import { SceneBackground } from '../components/scene/SceneBackground';
import { CyclistSprite } from '../components/sprites/CyclistSprite';
import { SpeechBubble } from '../components/narration/SpeechBubble';
import { useImmersiveTheme } from '../hooks/useImmersiveTheme';
import { useI18n, type MobileCatalog } from '../i18n/useI18n';
import { GameCard } from '../components/ui/GameCard';
import {
  AuthService,
  DepartmentService,
  EventService,
  type DepartmentTreeNode,
  type PublicTenantOption,
} from '../services/api';

type OnboardingStep = 0 | 1 | 2;
type ThemeColorMap = Record<string, string>;

interface OnboardingUser {
  username?: string | null;
}

interface OnboardingFinishPayload {
  refreshProfile: true;
}

interface OnboardingProps {
  user: OnboardingUser | null;
  onFinish: (data: OnboardingFinishPayload) => void | Promise<void>;
}

interface StepCopy {
  bubble: string;
  sprite: 'idle' | 'cruise' | 'attack';
}

function flattenDepartments(nodes: DepartmentTreeNode[]): DepartmentTreeNode[] {
  const out: DepartmentTreeNode[] = [];
  for (const n of nodes) {
    out.push(n);
    if (n.children?.length) out.push(...flattenDepartments(n.children));
  }
  return out;
}

export const OnboardingScreen: React.FC<OnboardingProps> = ({ user, onFinish }) => {
  const { t } = useI18n();
  const { theme } = useUnistyles();
  const C = theme.colors as ThemeColorMap;
  const { enabled: immersiveEnabled } = useImmersiveTheme();
  const TOTAL_STEPS = 3;

  const STEP_COPY = useMemo<StepCopy[]>(
    () => [
      { bubble: t.onboarding.city.bubble, sprite: 'idle' },
      { bubble: t.onboarding.department.bubble, sprite: 'cruise' },
      { bubble: t.onboarding.finish.bubble, sprite: 'attack' },
    ],
    [t],
  );

  const [step, setStep] = useState<OnboardingStep>(0);
  const [tenants, setTenants] = useState<PublicTenantOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentTreeNode[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const flatDepartments = useMemo(() => flattenDepartments(departments), [departments]);

  const progress = useSharedValue(0);
  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));
  const progressLabelPct = Math.round(((step + 1) / TOTAL_STEPS) * 100);

  useEffect(() => {
    progress.value = withTiming((step + 1) / TOTAL_STEPS, { duration: 500 });
  }, [progress, step]);

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

  const nextStep = async () => {
    if (step < TOTAL_STEPS - 1) {
      setStep((prev) => (Math.min(TOTAL_STEPS - 1, prev + 1) as OnboardingStep));
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
      await onFinish({ refreshProfile: true });
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
            t={t}
          />
        );
      case 1:
        return (
          <DepartmentStep
            departments={flatDepartments}
            selectedDepartmentId={selectedDepartmentId}
            setSelectedDepartmentId={setSelectedDepartmentId}
            onNext={() => void nextStep()}
            C={C}
            t={t}
          />
        );
      case 2:
        return (
          <FinishStep
            user={user}
            tenantName={tenants.find((t) => t.id === selectedTenantId)?.name ?? '—'}
            departmentName={
              flatDepartments.find((d) => d.id === selectedDepartmentId)?.name ?? '—'
            }
            onNext={() => void nextStep()}
            C={C}
            busy={isSubmitting}
            t={t}
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
          <PixelText size="xs" style={{ fontSize: 8, color: C.primary }}>
            {t.onboarding.characterInit}
          </PixelText>
          <PixelText size="xs" style={{ fontSize: 8, color: C.primary }}>
            {progressLabelPct}%
          </PixelText>
        </Row>
        <Row style={{ height: 8, backgroundColor: C.onBackground, width: '100%', borderWidth: 1, borderColor: C.onBackground }}>
          <Animated.View style={[{ height: '100%', backgroundColor: C.primary }, progressBarStyle]}>
            <View style={{ position: 'absolute', right: 0, width: 2, height: 12, backgroundColor: C.primary, top: -2 }} />
          </Animated.View>
        </Row>
      </Column>

      <ScrollContainer style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {renderStep()}
      </ScrollContainer>

      <Row justifyContent="space-between" alignItems="center" style={{ marginTop: 16, paddingBottom: 16 }}>
        <PixelText size="xs" color="muted" style={{ fontSize: 8 }}>
          {t.onboarding.stagePrefix} // STEP_0{step + 1}
        </PixelText>
        <PixelText size="xs" color="muted" style={{ fontSize: 8 }}>{t.onboarding.osVersion}</PixelText>
      </Row>
    </Column>
  );
};

interface CityStepProps {
  tenants: PublicTenantOption[];
  selectedTenantId: string;
  setSelectedTenantId: (tenantId: string) => void;
  onNext: () => void;
  C: ThemeColorMap;
  t: MobileCatalog;
}

const CityStep = ({
  tenants,
  selectedTenantId,
  setSelectedTenantId,
  onNext,
  C,
  t,
}: CityStepProps) => {

  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={{ flex: 1 }}>
      <GameCard style={{ gap: 16 }}>
        <View style={{ borderWidth: 2, borderColor: C.primary, padding: 24, backgroundColor: C.parchment }}>
          <MapPin size={48} color={C.primary} />
        </View>
        <Column gap={8}>
          <PixelText size="lg" style={{ color: C.onBackground }}>
            {t.onboarding.city.title}
          </PixelText>
          <PixelText size="sm" style={{ opacity: 0.8, color: C.onBackground }}>
            {t.onboarding.city.description}
          </PixelText>
        </Column>
        <Column gap={8}>
          {tenants.map((tenant) => (
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
              <PixelText size="sm" style={{ color: C.onBackground }}>
                {tenant.name}
              </PixelText>
            </Pressable>
          ))}
        </Column>
        <ArcadeButton
          label={t.onboarding.city.next}
          onPress={onNext}
          variant="primary"
        />
      </GameCard>
    </Animated.View>
  );
};

interface DepartmentStepProps {
  departments: DepartmentTreeNode[];
  selectedDepartmentId: number | null;
  setSelectedDepartmentId: (departmentId: number) => void;
  onNext: () => void;
  C: ThemeColorMap;
  t: MobileCatalog;
}

const DepartmentStep = ({
  departments,
  selectedDepartmentId,
  setSelectedDepartmentId,
  onNext,
  C,
  t,
}: DepartmentStepProps) => {

  return (
    <Animated.View entering={SlideInRight} style={{ flex: 1 }}>
      <GameCard style={{ gap: 24 }}>
        <PixelText size="lg" style={{ color: C.onBackground }}>
          {t.onboarding.department.title}
        </PixelText>
        <PixelText size="sm" style={{ opacity: 0.8, color: C.onBackground }}>
          {t.onboarding.department.description}
        </PixelText>

        <Column gap={12}>
          {departments.map((department) => (
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
              <PixelText size="sm" style={{ color: C.onBackground }}>
                {department.name}
              </PixelText>
            </Pressable>
          ))}
        </Column>

        <ArcadeButton label={t.onboarding.department.next} onPress={onNext} variant="primary" />
      </GameCard>
    </Animated.View>
  );
};

interface FinishStepProps {
  user: OnboardingUser | null;
  tenantName: string;
  departmentName: string;
  onNext: () => void;
  C: ThemeColorMap;
  busy: boolean;
  t: MobileCatalog;
}

const FinishStep = ({ user, tenantName, departmentName, onNext, C, busy, t }: FinishStepProps) => {
  const requestPerms = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t.onboarding.finish.gpsPermissionTitle, t.onboarding.finish.gpsPermissionBody);
      return;
    }
    await Location.requestBackgroundPermissionsAsync();
    onNext();
  };

  return (
    <Animated.View entering={SlideInRight} style={{ flex: 1 }}>
      <GameCard style={{ gap: 24 }}>
        <PixelText size="lg" style={{ color: C.onBackground }}>
          {t.onboarding.finish.title}
        </PixelText>
        <PixelText size="sm" style={{ opacity: 0.8, color: C.onBackground }}>
          {t.onboarding.finish.description}
        </PixelText>
        <Column gap={8}>
          <PixelText size="sm" style={{ color: C.onBackground }}>
            {t.onboarding.finish.user}: {user?.username ?? 'unknown'}
          </PixelText>
          <PixelText size="sm" style={{ color: C.onBackground }}>
            {t.onboarding.finish.city}: {tenantName}
          </PixelText>
          <PixelText size="sm" style={{ color: C.onBackground }}>
            {t.onboarding.finish.department}: {departmentName}
          </PixelText>
        </Column>

        <ArcadeButton
          label={busy ? t.onboarding.finish.joining : t.onboarding.finish.joinCompetition}
          onPress={() => void requestPerms()}
          variant="success"
        />
      </GameCard>
    </Animated.View>
  );
};
