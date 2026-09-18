import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import * as Location from 'expo-location';
import { useUnistyles } from 'react-native-unistyles';

import { SceneBackground } from '../components/scene/SceneBackground';
import { CyclistSprite } from '../components/sprites/CyclistSprite';
import { CrestIcon } from '../components/ui/CrestIcon';
import { DepartmentIcon } from '../components/ui/DepartmentIcon';
import { useImmersiveTheme } from '../hooks/useImmersiveTheme';
import { APP_BRAND_NAME } from '../theme/brand';
import { useI18n } from '../i18n/useI18n';
import {
  AuthService,
  DepartmentService,
  EventService,
  type DepartmentTreeNode,
  type PublicTenantOption,
} from '../services/api';
import { filterTenants, flattenDepartments, isJoinableDepartmentId } from './onboardingModel';

type OnboardingStep = 0 | 1 | 2;
type LoadState = 'loading' | 'ready' | 'empty' | 'error';
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

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  C: ThemeColorMap;
  disabled?: boolean;
  testID?: string;
  variant?: 'primary' | 'secondary';
}

function PrimaryButton({
  label,
  onPress,
  C,
  disabled = false,
  testID,
  variant = 'primary',
}: PrimaryButtonProps) {
  const primary = variant === 'primary';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: primary ? C.goldAmber : C.surfaceContainerLowest,
          borderColor: primary ? C.goldAmber : C.outlineVariant,
          opacity: disabled ? 0.5 : pressed ? 0.82 : 1,
        },
      ]}
    >
      <Text style={[styles.buttonText, { color: C.onBackground }]}>{label}</Text>
    </Pressable>
  );
}

interface ChoiceCardProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  C: ThemeColorMap;
  leading?: React.ReactNode;
  compact?: boolean;
}

function ChoiceCard({ label, selected, onPress, C, leading, compact = false }: ChoiceCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        compact ? styles.cityCard : styles.teamCard,
        {
          borderColor: selected ? C.goldAmber : C.outlineVariant,
          backgroundColor: selected ? C.selection : C.surfaceContainerLowest,
          opacity: pressed ? 0.84 : 1,
        },
      ]}
    >
      {leading}
      <Text
        numberOfLines={2}
        style={[styles.choiceLabel, { color: selected ? C.onSelection : C.onBackground }]}
      >
        {label}
      </Text>
      <View
        style={[
          styles.choiceMarker,
          {
            borderColor: selected ? C.selectionBorder : C.outlineVariant,
            backgroundColor: selected ? C.selectionBorder : 'transparent',
          },
        ]}
      >
        {selected ? <Text style={[styles.check, { color: C.onPrimary }]}>✓</Text> : null}
      </View>
    </Pressable>
  );
}

export const OnboardingScreen: React.FC<OnboardingProps> = ({ user, onFinish }) => {
  const { t } = useI18n();
  const { theme } = useUnistyles();
  const C = theme.colors as ThemeColorMap;
  const { enabled: immersiveEnabled } = useImmersiveTheme();

  const [step, setStep] = useState<OnboardingStep>(0);
  const [tenants, setTenants] = useState<PublicTenantOption[]>([]);
  const [tenantState, setTenantState] = useState<LoadState>('loading');
  const [tenantQuery, setTenantQuery] = useState('');
  const [departments, setDepartments] = useState<DepartmentTreeNode[]>([]);
  const [departmentState, setDepartmentState] = useState<LoadState>('empty');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const flatDepartments = useMemo(() => flattenDepartments(departments), [departments]);
  const visibleTenants = useMemo(
    () => filterTenants(tenants, tenantQuery),
    [tenantQuery, tenants],
  );
  const selectedTenant = tenants.find((tenant) => tenant.id === selectedTenantId);
  const selectedDepartment = flatDepartments.find(
    (department) => department.id === selectedDepartmentId,
  );

  const stepNames = useMemo(
    () => [t.onboarding.city.step, t.onboarding.department.step, t.onboarding.finish.step],
    [t],
  );

  const loadTenants = useCallback(async () => {
    setTenantState('loading');
    try {
      const rows = await AuthService.getPublicTenants();
      setTenants(rows);
      setTenantState(rows.length > 0 ? 'ready' : 'empty');
      const [onlyTenant] = rows;
      if (rows.length === 1 && onlyTenant) setSelectedTenantId(onlyTenant.id);
    } catch {
      setTenants([]);
      setTenantState('error');
    }
  }, []);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  const loadDepartmentsForTenant = async (tenantId: string) => {
    setDepartmentState('loading');
    setDepartments([]);
    setSelectedDepartmentId(null);

    if (tenantId) {
      try {
        await AuthService.updateProfile({ tenant_id: tenantId });
      } catch {
        // Keep onboarding recoverable. Profile refresh at completion may retry.
      }
    }

    try {
      const rows = await DepartmentService.getTree();
      setDepartments(rows);
      setDepartmentState(rows.length > 0 ? 'ready' : 'empty');
    } catch {
      setDepartments([]);
      setDepartmentState('error');
    }
  };

  const advanceFromCity = async () => {
    if (!selectedTenantId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await loadDepartmentsForTenant(selectedTenantId);
      setStep(1);
    } finally {
      setIsSubmitting(false);
    }
  };

  const advanceFromTeam = () => {
    setStep(2);
  };

  const skipTeam = () => {
    setSelectedDepartmentId(null);
    setStep(2);
  };

  const finishOnboarding = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (selectedTenantId) {
        try {
          await AuthService.updateProfile({ tenant_id: selectedTenantId });
        } catch {
          // Local completion remains available if profile sync is temporarily unavailable.
        }
      }

      if (isJoinableDepartmentId(selectedDepartmentId)) {
        try {
          await DepartmentService.selfJoin(selectedDepartmentId as number);
        } catch {
          // Team membership is optional for entering the app.
        }
      }

      try {
        const events = await EventService.list();
        const active = events.find((event) => event.status === 'ACTIVE');
        if (active) await EventService.join(active.id);
      } catch {
        // Optional auto-join remains best-effort.
      }
    } finally {
      await onFinish({ refreshProfile: true });
      setIsSubmitting(false);
    }
  };

  const requestPermissionsAndFinish = async () => {
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      if (existing.status === 'granted') {
        await Location.requestBackgroundPermissionsAsync().catch(() => null);
        await finishOnboarding();
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        await Location.requestBackgroundPermissionsAsync().catch(() => null);
        await finishOnboarding();
        return;
      }

      Alert.alert(t.onboarding.finish.gpsPermissionTitle, t.onboarding.finish.gpsPermissionBody, [
        {
          text: t.onboarding.finish.continueWithoutGps,
          onPress: () => void finishOnboarding(),
        },
        { text: t.common.close, style: 'cancel' },
      ]);
    } catch {
      await finishOnboarding();
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: C.hudBackground }]}>
      {immersiveEnabled ? <SceneBackground sceneId="onboarding" scrim="strong" /> : null}
      <View style={styles.shell}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={[styles.brand, { color: C.gpGoldLight }]}>{APP_BRAND_NAME}</Text>
            <Text style={[styles.stepCounter, { color: C.hudText }]}>
              {t.onboarding.stepWord} {step + 1} {t.onboarding.ofWord} 3
            </Text>
          </View>
          <Text style={[styles.stepName, { color: C.hudText }]}>{stepNames[step]}</Text>
          <View style={[styles.progressTrack, { backgroundColor: C.hudSurface }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: C.goldAmber, width: `${((step + 1) / 3) * 100}%` },
              ]}
            />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 0 ? (
            <Animated.View
              entering={FadeIn}
              style={[styles.panel, { backgroundColor: C.parchment, borderColor: C.goldAmber }]}
            >
              <Text style={[styles.eyebrow, { color: C.secondary }]}>{t.onboarding.city.eyebrow}</Text>
              <Text style={[styles.title, { color: C.onBackground }]}>{t.onboarding.city.title}</Text>
              <Text style={[styles.description, { color: C.secondary }]}>
                {t.onboarding.city.description}
              </Text>

              <TextInput
                accessibilityLabel={t.onboarding.city.search}
                style={[
                  styles.search,
                  {
                    color: C.onBackground,
                    borderColor: C.outlineVariant,
                    backgroundColor: C.surfaceContainerLowest,
                  },
                ]}
                placeholder={t.onboarding.city.search}
                placeholderTextColor={C.secondary}
                value={tenantQuery}
                onChangeText={setTenantQuery}
                autoCorrect={false}
              />

              {tenantState === 'loading' ? (
                <View style={styles.stateBlock}>
                  <ActivityIndicator color={C.primary} />
                  <Text style={[styles.stateText, { color: C.secondary }]}>{t.common.loading}</Text>
                </View>
              ) : tenantState === 'error' ? (
                <View style={styles.stateBlock}>
                  <Text style={[styles.stateText, { color: C.secondary }]}>{t.onboarding.city.error}</Text>
                  <PrimaryButton
                    label={t.common.retry}
                    onPress={() => void loadTenants()}
                    C={C}
                    variant="secondary"
                  />
                </View>
              ) : tenantState === 'empty' ? (
                <Text style={[styles.stateText, { color: C.secondary }]}>{t.onboarding.city.empty}</Text>
              ) : (
                <View style={styles.cityGrid}>
                  {visibleTenants.map((tenant) => (
                    <ChoiceCard
                      key={tenant.id}
                      label={tenant.name}
                      selected={selectedTenantId === tenant.id}
                      onPress={() => setSelectedTenantId(tenant.id)}
                      C={C}
                      compact
                      leading={<CrestIcon tenant={tenant.name} size={38} />}
                    />
                  ))}
                  {visibleTenants.length === 0 ? (
                    <Text style={[styles.stateText, { color: C.secondary }]}>
                      {t.onboarding.city.noSearchResults}
                    </Text>
                  ) : null}
                </View>
              )}

              <PrimaryButton
                label={isSubmitting ? t.common.loading : t.onboarding.city.next}
                onPress={() => void advanceFromCity()}
                C={C}
                disabled={!selectedTenantId || tenantState !== 'ready' || isSubmitting}
                testID="onboarding-city-next"
              />
            </Animated.View>
          ) : null}

          {step === 1 ? (
            <Animated.View
              entering={SlideInRight}
              style={[styles.panel, { backgroundColor: C.parchment, borderColor: C.goldAmber }]}
            >
              <Text style={[styles.eyebrow, { color: C.secondary }]}>
                {t.onboarding.department.eyebrow}
              </Text>
              <Text style={[styles.title, { color: C.onBackground }]}>{t.onboarding.department.title}</Text>
              <Text style={[styles.description, { color: C.secondary }]}>
                {t.onboarding.department.description}
              </Text>

              {departmentState === 'loading' ? (
                <View style={styles.stateBlock}>
                  <ActivityIndicator color={C.primary} />
                  <Text style={[styles.stateText, { color: C.secondary }]}>{t.common.loading}</Text>
                </View>
              ) : departmentState === 'error' ? (
                <Text style={[styles.stateText, { color: C.secondary }]}>
                  {t.onboarding.department.error}
                </Text>
              ) : departmentState === 'empty' ? (
                <Text style={[styles.stateText, { color: C.secondary }]}>
                  {t.onboarding.department.empty}
                </Text>
              ) : (
                <View style={styles.teamList}>
                  {flatDepartments.map((department) => (
                    <ChoiceCard
                      key={department.id}
                      label={department.name}
                      selected={selectedDepartmentId === department.id}
                      onPress={() => setSelectedDepartmentId(department.id)}
                      C={C}
                      leading={<DepartmentIcon name={department.name} size={32} />}
                    />
                  ))}
                </View>
              )}

              <View style={styles.buttonStack}>
                <PrimaryButton
                  label={t.onboarding.department.next}
                  onPress={advanceFromTeam}
                  C={C}
                  disabled={!isJoinableDepartmentId(selectedDepartmentId)}
                  testID="onboarding-department-next"
                />
                <PrimaryButton
                  label={t.onboarding.department.skip}
                  onPress={skipTeam}
                  C={C}
                  variant="secondary"
                  testID="onboarding-department-skip"
                />
              </View>
            </Animated.View>
          ) : null}

          {step === 2 ? (
            <Animated.View
              entering={SlideInRight}
              style={[styles.panel, { backgroundColor: C.parchment, borderColor: C.goldAmber }]}
            >
              <View style={styles.readyHero}>
                <View
                  style={[
                    styles.riderFrame,
                    { backgroundColor: C.hudSurface, borderColor: C.goldAmber },
                  ]}
                >
                  <CyclistSprite size={94} state="idle" expressionMode />
                </View>
                {selectedTenant ? <CrestIcon tenant={selectedTenant.name} size={46} /> : null}
              </View>

              <Text style={[styles.eyebrow, { color: C.secondary }]}>
                {t.onboarding.finish.eyebrow}
              </Text>
              <Text style={[styles.title, { color: C.onBackground }]}>{t.onboarding.finish.title}</Text>
              <Text style={[styles.description, { color: C.secondary }]}>
                {t.onboarding.finish.description}
              </Text>

              <View
                style={[
                  styles.summaryCard,
                  {
                    backgroundColor: C.surfaceContainerLowest,
                    borderColor: C.outlineVariant,
                  },
                ]}
              >
                <SummaryRow label={t.onboarding.finish.user} value={user?.username ?? '—'} C={C} />
                <SummaryRow label={t.onboarding.finish.city} value={selectedTenant?.name ?? '—'} C={C} />
                <SummaryRow
                  label={t.onboarding.finish.department}
                  value={selectedDepartment?.name ?? t.onboarding.finish.teamSkipped}
                  C={C}
                />
              </View>

              <PrimaryButton
                label={
                  isSubmitting
                    ? t.onboarding.finish.joining
                    : t.onboarding.finish.joinCompetition
                }
                onPress={() => void requestPermissionsAndFinish()}
                C={C}
                disabled={isSubmitting}
                testID="onboarding-finish-join"
              />
            </Animated.View>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

function SummaryRow({ label, value, C }: { label: string; value: string; C: ThemeColorMap }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color: C.secondary }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: C.onBackground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  shell: { flex: 1, paddingHorizontal: 16 },
  header: { paddingTop: 8, paddingBottom: 14, gap: 5 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontSize: 26, fontWeight: '900', letterSpacing: 1 },
  stepCounter: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  stepName: { fontSize: 14, fontWeight: '700' },
  progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  progressFill: { height: '100%', borderRadius: 3 },
  scrollContent: { paddingBottom: 24 },
  panel: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 14 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  title: { fontSize: 30, lineHeight: 35, fontWeight: '800' },
  description: { fontSize: 15, lineHeight: 21 },
  search: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 15 },
  cityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cityCard: {
    width: '48%',
    minHeight: 128,
    borderWidth: 2,
    borderRadius: 14,
    padding: 12,
    gap: 8,
    position: 'relative',
    alignItems: 'flex-start',
  },
  teamList: { gap: 10 },
  teamCard: {
    minHeight: 68,
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  choiceLabel: { flexShrink: 1, fontSize: 15, fontWeight: '800', lineHeight: 19, paddingRight: 20 },
  choiceMarker: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderWidth: 1,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: { fontSize: 13, fontWeight: '900' },
  stateBlock: { gap: 10, alignItems: 'center', paddingVertical: 18 },
  stateText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  buttonStack: { gap: 10 },
  button: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  readyHero: { alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 2 },
  riderFrame: {
    width: 126,
    height: 126,
    borderWidth: 1,
    borderRadius: 63,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14 },
  summaryRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryLabel: { fontSize: 13, fontWeight: '700' },
  summaryValue: { flexShrink: 1, textAlign: 'right', fontSize: 15, fontWeight: '800' },
});
