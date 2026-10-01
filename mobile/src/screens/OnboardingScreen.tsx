import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { PrimaryButton } from '../components/product';
import { RoadbookPage, RoadbookSection, RoadbookRow, RoadbookNotice } from '../components/roadbook/Surface';
import { getAppCopy } from '../components/roadbook/appCopy';
import { APP_BRAND_NAME } from '../theme/brand';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';
import { useI18n } from '../i18n/useI18n';
import { AuthService, DepartmentService, EventService, type DepartmentTreeNode, type PublicTenantOption } from '../services/api';
import { filterTenants, flattenDepartments, isJoinableDepartmentId } from './onboardingModel';

type LoadState = 'loading' | 'ready' | 'empty' | 'error';
interface OnboardingProps {
  user: { username?: string | null } | null;
  onFinish: (data: { refreshProfile: true }) => void | Promise<void>;
}
export const OnboardingScreen: React.FC<OnboardingProps> = ({ user, onFinish }) => {
  const { t, locale } = useI18n();
  const copy = getAppCopy(locale);
  const { theme } = useUnistyles();
  const c = getSemanticColors(theme.colors);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [tenants, setTenants] = useState<PublicTenantOption[]>([]);
  const [tenantState, setTenantState] = useState<LoadState>('loading');
  const [tenantQuery, setTenantQuery] = useState('');
  const [departments, setDepartments] = useState<DepartmentTreeNode[]>([]);
  const [departmentState, setDepartmentState] = useState<LoadState>('empty');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const alive = useRef(false);
  const locked = useRef(false);
  const tenantRequest = useRef(0);
  const flatDepartments = useMemo(() => flattenDepartments(departments), [departments]);
  const visibleTenants = useMemo(() => filterTenants(tenants, tenantQuery), [tenants, tenantQuery]);
  const selectedTenant = tenants.find((tenant) => tenant.id === selectedTenantId);
  const selectedDepartment = flatDepartments.find((department) => department.id === selectedDepartmentId);
  const stepNames = [t.onboarding.city.step, t.onboarding.department.step, t.onboarding.finish.step];
  const readTenants = useCallback(async () => {
    const request = ++tenantRequest.current;
    try {
      const rows = await AuthService.getPublicTenants();
      if (!alive.current || request !== tenantRequest.current) return;
      setTenants(rows); setTenantState(rows.length > 0 ? 'ready' : 'empty');
      if (rows.length === 1 && rows[0]) setSelectedTenantId(rows[0].id);
    } catch {
      if (alive.current && request === tenantRequest.current) { setTenants([]); setTenantState('error'); }
    }
  }, []);
  useEffect(() => { alive.current = true; void readTenants(); return () => { alive.current = false; }; }, [readTenants]);
  const loadTenants = () => { setTenantState('loading'); void readTenants(); };
  const loadDepartmentsForTenant = async (tenantId: string): Promise<boolean> => {
    setDepartmentState('loading'); setDepartments([]); setSelectedDepartmentId(null);
    try {
      await AuthService.updateProfile({ tenant_id: tenantId });
    } catch { if (alive.current) { setDepartmentState('error'); setSubmitError(true); } return false; }
    if (!alive.current) return false;
    try {
      const rows = await DepartmentService.getTree();
      if (alive.current) { setDepartments(rows); setDepartmentState(rows.length > 0 ? 'ready' : 'empty'); }
    } catch { if (alive.current) { setDepartments([]); setDepartmentState('error'); } }
    return true;
  };
  const advanceFromCity = async () => {
    if (!selectedTenantId || locked.current) return;
    locked.current = true; setIsSubmitting(true); setSubmitError(false);
    try { if (await loadDepartmentsForTenant(selectedTenantId) && alive.current) setStep(1); }
    finally { locked.current = false; if (alive.current) setIsSubmitting(false); }
  };
  const confirmWithoutGps = () => new Promise<boolean>((resolve) => {
    Alert.alert(t.onboarding.finish.gpsPermissionTitle, t.onboarding.finish.gpsPermissionBody, [
      { text: t.onboarding.finish.continueWithoutGps, onPress: () => resolve(true) },
      { text: t.common.close, style: 'cancel', onPress: () => resolve(false) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
  const finishOnboarding = async () => {
    if (locked.current) return;
    // The same lock covers permission prompts, confirmation and membership writes.
    locked.current = true; setIsSubmitting(true); setSubmitError(false);
    try {
      let gpsGranted = false;
      try {
        const existing = await Location.getForegroundPermissionsAsync();
        const result = existing.status === 'granted' ? existing : await Location.requestForegroundPermissionsAsync();
        gpsGranted = result.status === 'granted';
        if (gpsGranted) await Location.requestBackgroundPermissionsAsync().catch(() => null);
      } catch { gpsGranted = false; }
      if (!alive.current || (!gpsGranted && !(await confirmWithoutGps()))) return;
      if (!alive.current) return;
      if (selectedTenantId) await AuthService.updateProfile({ tenant_id: selectedTenantId });
      if (!alive.current) return;
      if (isJoinableDepartmentId(selectedDepartmentId)) await DepartmentService.selfJoin(selectedDepartmentId as number);
      if (!alive.current) return;
      // Preserve optional active-event enrollment, without inventing an active event.
      try { const events = await EventService.list(); const active = events.find((event) => event.status === 'ACTIVE');
        if (active && alive.current) await EventService.join(active.id); } catch { /* Event enrollment is optional. */ }
      if (alive.current) await onFinish({ refreshProfile: true });
    } catch { if (alive.current) setSubmitError(true); }
    finally { locked.current = false; if (alive.current) setIsSubmitting(false); }
  };
  return <RoadbookPage title={APP_BRAND_NAME} testID="roadbook-onboarding">
    <View style={styles.progress} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: 3, now: step + 1 }}>
      <Text style={styles.caption}>{t.onboarding.stepWord} {step + 1} {t.onboarding.ofWord} 3 · {stepNames[step]}</Text>
    </View>
    {submitError ? <RoadbookNotice error title={copy.actionError} testID="onboarding-submit-error" /> : null}
    {step === 0 ? <RoadbookSection>
      <Text accessibilityRole="header" style={styles.title}>{t.onboarding.city.title}</Text>
      <Text style={styles.body}>{t.onboarding.city.description}</Text>
      <TextInput testID="onboarding-city-search" accessibilityLabel={t.onboarding.city.search} placeholder={t.onboarding.city.search}
        placeholderTextColor={c.text.secondary} value={tenantQuery} onChangeText={setTenantQuery} style={styles.input} autoCorrect={false} />
      {tenantState === 'loading' ? <Text style={styles.body}>{t.common.loading}</Text>
        : tenantState === 'error' ? <RoadbookNotice error title={t.onboarding.city.error} action={<PrimaryButton
          label={t.common.retry} variant="secondary" onPress={loadTenants} />} />
          : tenantState === 'empty' ? <Text style={styles.body}>{t.onboarding.city.empty}</Text> : <>
            {visibleTenants.map((tenant) => <Choice key={tenant.id} label={tenant.name} selected={selectedTenantId === tenant.id}
              onPress={() => setSelectedTenantId(tenant.id)} disabled={isSubmitting} />)}
            {visibleTenants.length === 0 ? <Text style={styles.body}>{t.onboarding.city.noSearchResults}</Text> : null}
          </>}
      <PrimaryButton label={isSubmitting ? t.common.loading : t.onboarding.city.next} onPress={() => void advanceFromCity()}
        disabled={!selectedTenantId || tenantState !== 'ready' || isSubmitting} testID="onboarding-city-next" />
    </RoadbookSection> : null}
    {step === 1 ? <RoadbookSection>
      <Text accessibilityRole="header" style={styles.title}>{t.onboarding.department.title}</Text>
      <Text style={styles.body}>{t.onboarding.department.description}</Text>
      {departmentState === 'loading' ? <Text style={styles.body}>{t.common.loading}</Text>
        : departmentState === 'error' ? <Text style={styles.body}>{t.onboarding.department.error}</Text>
          : departmentState === 'empty' ? <Text style={styles.body}>{t.onboarding.department.empty}</Text>
            : flatDepartments.map((department) => <Choice key={department.id} label={department.name}
              selected={selectedDepartmentId === department.id} onPress={() => setSelectedDepartmentId(department.id)} />)}
      <PrimaryButton label={t.onboarding.department.next} onPress={() => setStep(2)}
        disabled={!isJoinableDepartmentId(selectedDepartmentId)} testID="onboarding-department-next" />
      <PrimaryButton label={t.onboarding.department.skip} variant="secondary"
        onPress={() => { setSelectedDepartmentId(null); setStep(2); }} testID="onboarding-department-skip" />
      <RoadbookRow label={t.onboarding.city.step} onPress={() => setStep(0)} />
    </RoadbookSection> : null}
    {step === 2 ? <RoadbookSection>
      <Text accessibilityRole="header" style={styles.title}>{t.onboarding.finish.title}</Text>
      <Text style={styles.body}>{t.onboarding.finish.description}</Text>
      <RoadbookRow label={t.onboarding.finish.user} detail={user?.username ?? '—'} />
      <RoadbookRow label={t.onboarding.finish.city} detail={selectedTenant?.name ?? '—'} />
      <RoadbookRow label={t.onboarding.finish.department} detail={selectedDepartment?.name ?? t.onboarding.finish.teamSkipped} />
      <PrimaryButton label={isSubmitting ? t.onboarding.finish.joining : t.onboarding.finish.joinCompetition}
        onPress={() => void finishOnboarding()} disabled={isSubmitting} testID="onboarding-finish-join" />
      <RoadbookRow label={t.onboarding.department.step} onPress={() => setStep(1)} disabled={isSubmitting} />
    </RoadbookSection> : null}
  </RoadbookPage>;
};
function Choice({ label, selected, onPress, disabled = false }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled }}
    disabled={disabled} onPress={onPress} style={[styles.choice, selected && styles.selected]}>
    <Text style={styles.label}>{label}</Text><Text accessible={false} style={styles.label}>{selected ? '✓' : '○'}</Text>
  </Pressable>;
}
const styles = StyleSheet.create((theme) => {
  const c = getSemanticColors(theme.colors);
  return {
    progress: { borderBottomWidth: 2, borderColor: c.action.primary, paddingBottom: 16 },
    caption: { ...PRODUCT_TYPOGRAPHY.metricLabel, color: c.text.secondary }, title: { ...PRODUCT_TYPOGRAPHY.displayEditorial, color: c.text.primary },
    body: { ...PRODUCT_TYPOGRAPHY.body, lineHeight: 25, color: c.text.secondary }, label: { ...PRODUCT_TYPOGRAPHY.bodyMedium, color: c.text.primary, flexShrink: 1 },
    choice: { minHeight: 64, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      borderWidth: 1, borderColor: c.border.subtle, backgroundColor: c.surface.default, borderRadius: 8 },
    selected: { borderColor: c.action.primary, backgroundColor: c.surface.raised },
    input: { minHeight: 52, padding: 14, borderWidth: 1, borderColor: c.border.strong, backgroundColor: c.surface.default,
      borderRadius: 8, ...PRODUCT_TYPOGRAPHY.body, color: c.text.primary },
  };
});
