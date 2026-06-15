import React, { useMemo, useState, useEffect } from 'react';
import { Alert, View, Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInRight } from 'react-native-reanimated';
import * as Location from 'expo-location';

import { Column } from '../components/Column';
import { Row } from '../components/Row';
import { PixelText } from '../components/PixelText';
import { ScrollContainer } from '../components/ScrollContainer';
import { ArcadeButton } from '../components/ArcadeButton';
import { useUnistyles } from 'react-native-unistyles';
import { SceneBackground } from '../components/scene/SceneBackground';
import { useImmersiveTheme } from '../hooks/useImmersiveTheme';
import { APP_BRAND_NAME } from '../theme/brand';
import { useI18n, type MobileCatalog } from '../i18n/useI18n';
import { GameCard } from '../components/ui/GameCard';
import { PixelIcon } from '../components/ui/PixelIcon';
import { CHROME_ICONS } from '../assets/chromeIcons';
import { CrestIcon } from '../components/ui/CrestIcon';
import { DepartmentIcon } from '../components/ui/DepartmentIcon';
import { FinishCelebration } from '../components/game/FinishCelebration';
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

function flattenDepartments(nodes: DepartmentTreeNode[]): DepartmentTreeNode[] {
  const out: DepartmentTreeNode[] = [];
  for (const n of nodes) {
    out.push(n);
    if (n.children?.length) out.push(...flattenDepartments(n.children));
  }
  return out;
}

/**
 * Local fallback teams so the department step never renders empty when the
 * tenant tree is missing or the API call fails (emulator audit P0 #3).
 * Negative ids signal "local only" — self-join is skipped for them.
 */
const FALLBACK_DEPARTMENTS: DepartmentTreeNode[] = [
  { id: -1, name: 'IT', department_type: 'TEAM', member_count: 0 },
  { id: -2, name: 'Marketing', department_type: 'TEAM', member_count: 0 },
  { id: -3, name: 'HR', department_type: 'TEAM', member_count: 0 },
  { id: -4, name: 'Sprzedaż', department_type: 'TEAM', member_count: 0 },
];

export const OnboardingScreen: React.FC<OnboardingProps> = ({ user, onFinish }) => {
  const { t } = useI18n();
  const { theme } = useUnistyles();
  const C = theme.colors as ThemeColorMap;
  const { enabled: immersiveEnabled } = useImmersiveTheme();
  const TOTAL_STEPS = 3;

  const [step, setStep] = useState<OnboardingStep>(0);
  const [tenants, setTenants] = useState<PublicTenantOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentTreeNode[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const flatDepartments = useMemo(() => flattenDepartments(departments), [departments]);

  const STEP_NAMES = useMemo(
    () => [t.onboarding.city.step, t.onboarding.department.step, t.onboarding.finish.step],
    [t],
  );

  useEffect(() => {
    AuthService.getPublicTenants()
      .then((rows) => {
        setTenants(rows);
        if (rows[0]?.id) setSelectedTenantId(rows[0].id);
      })
      .catch(() => setTenants([]));
  }, []);

  const loadDepartmentsForTenant = async (tenantId: string) => {
    if (tenantId) {
      try {
        await AuthService.updateProfile({ tenant_id: tenantId });
      } catch {
        // Continue — tree may still load for authenticated user.
      }
    }
    try {
      const rows = await DepartmentService.getTree();
      const effective = rows.length > 0 ? rows : FALLBACK_DEPARTMENTS;
      setDepartments(effective);
      const flat = flattenDepartments(effective);
      if (flat[0]?.id != null) {
        setSelectedDepartmentId(flat[0].id);
      }
    } catch {
      setDepartments(FALLBACK_DEPARTMENTS);
      setSelectedDepartmentId(FALLBACK_DEPARTMENTS[0]?.id ?? null);
    }
  };

  const nextStep = async () => {
    if (step === 0) {
      await loadDepartmentsForTenant(selectedTenantId);
      setStep(1);
      return;
    }

    if (step === 1) {
      setStep(2);
      return;
    }

    setIsSubmitting(true);
    try {
      if (selectedTenantId) {
        try {
          await AuthService.updateProfile({ tenant_id: selectedTenantId });
        } catch {
          // Local onboarding completion must not depend on profile sync.
        }
      }
      if (selectedDepartmentId != null && selectedDepartmentId > 0) {
        try {
          await DepartmentService.selfJoin(selectedDepartmentId);
        } catch {
          // Optional cohort join — user can still enter the app.
        }
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
    } finally {
      await onFinish({ refreshProfile: true });
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
    <Column flex={1} style={{ backgroundColor: C.parchment, paddingTop: 48, position: 'relative' }} padding={16}>
      {immersiveEnabled && <SceneBackground sceneId="onboarding" scrim="soft" />}

      <Column gap={6} style={{ alignItems: 'center', marginBottom: 16 }}>
        <PixelText size="lg" style={{ color: C.cta }}>
          {APP_BRAND_NAME}
        </PixelText>
        <PixelText size="xs" style={{ color: C.onBackground, opacity: 0.85, textAlign: 'center' }}>
          {`${t.onboarding.stepWord} ${step + 1} ${t.onboarding.ofWord} ${TOTAL_STEPS} — ${STEP_NAMES[step]}`}
        </PixelText>
        <Row gap={8} style={{ marginTop: 4 }}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                borderWidth: 2,
                borderColor: i <= step ? C.cta : C.selectionBorder,
                backgroundColor: i <= step ? C.cta : 'transparent',
              }}
            />
          ))}
        </Row>
      </Column>

      <ScrollContainer style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {renderStep()}
      </ScrollContainer>
    </Column>
  );
};

interface SelectRowProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  C: ThemeColorMap;
  leading?: React.ReactNode;
}

/** Vision selection row: white card → green fill + check when selected. */
const SelectRow = ({ label, selected, onPress, C, leading }: SelectRowProps) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 2,
      borderColor: selected ? C.selectionBorder : C.outlineVariant,
      backgroundColor: selected ? C.selection : C.surfaceContainerLowest,
      padding: 12,
      gap: 10,
    }}
  >
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
      {leading}
      <PixelText size="sm" style={{ color: selected ? C.onSelection : C.onBackground }}>
        {label}
      </PixelText>
    </View>
    {selected ? (
      <PixelText size="sm" style={{ color: C.selectionBorder }}>
        {'\u2713'}
      </PixelText>
    ) : null}
  </Pressable>
);

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
        <View style={{ borderWidth: 2, borderColor: C.primary, padding: 24, backgroundColor: C.parchment, alignItems: 'center' }}>
          <PixelIcon source={CHROME_ICONS.map} size={48} baseSize={32} />
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
            <SelectRow
              key={tenant.id}
              label={tenant.name}
              selected={selectedTenantId === tenant.id}
              onPress={() => setSelectedTenantId(tenant.id)}
              C={C}
              leading={<CrestIcon tenant={tenant.name} size={26} />}
            />
          ))}
        </Column>
        <ArcadeButton
          label={t.onboarding.city.next}
          onPress={onNext}
          variant="cta"
          testID="onboarding-city-next"
          accessibilityLabel={t.onboarding.city.next}
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
            <SelectRow
              key={department.id}
              label={department.name}
              selected={selectedDepartmentId === department.id}
              onPress={() => setSelectedDepartmentId(department.id)}
              C={C}
              leading={<DepartmentIcon name={department.name} size={28} />}
            />
          ))}
        </Column>

        <ArcadeButton
          label={t.onboarding.department.next}
          onPress={onNext}
          variant="cta"
          testID="onboarding-department-next"
          accessibilityLabel={t.onboarding.department.next}
        />
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
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      if (existing.status === 'granted') {
        await Location.requestBackgroundPermissionsAsync().catch(() => null);
        onNext();
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        await Location.requestBackgroundPermissionsAsync().catch(() => null);
        onNext();
        return;
      }

      Alert.alert(t.onboarding.finish.gpsPermissionTitle, t.onboarding.finish.gpsPermissionBody, [
        { text: t.onboarding.finish.continueWithoutGps, onPress: onNext },
        { text: t.common.close, style: 'cancel' },
      ]);
    } catch {
      // Permission APIs can throw on some devices/emulators — never strand the
      // user on onboarding; complete locally and let them enter the app.
      onNext();
    }
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
          variant="cta"
          testID="onboarding-finish-join"
          accessibilityLabel={t.onboarding.finish.joinCompetition}
        />
        <View style={{ marginTop: 8, marginHorizontal: -16, marginBottom: -16 }}>
          <FinishCelebration height={120} />
        </View>
      </GameCard>
    </Animated.View>
  );
};
