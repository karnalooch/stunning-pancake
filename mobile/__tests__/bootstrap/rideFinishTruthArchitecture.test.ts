import fs from 'fs';
import path from 'path';
const ROOT = path.resolve(__dirname, '../../src');
function source(relative: string): string { return fs.readFileSync(path.join(ROOT, relative), 'utf8'); }

describe('ride finish truth architecture', () => {
  test('progression effects run only after terminal truth classification and cleanup', () => {
    const lifecycle = source('bootstrap/useRideLifecycle.ts');
    const finallyIndex = lifecycle.indexOf('} finally {');
    const classifyIndex = lifecycle.indexOf('classifyRideFinishState(');
    const effectsIndex = lifecycle.indexOf('applyDurableRideCompletionEffects(');
    expect(finallyIndex).toBeGreaterThan(-1);
    expect(classifyIndex).toBeGreaterThan(finallyIndex);
    expect(effectsIndex).toBeGreaterThan(classifyIndex);
  });
  test('Summary success feedback and sharing are gated by durable truth, independent of art', () => {
    const summary = source('screens/RideSummaryScreen.tsx');
    expect(summary).toContain('isDurableRideSuccess(finishState)');
    const guard = summary.indexOf('if (!durableSuccess) return;');
    expect(guard).toBeGreaterThan(-1);
    expect(summary.indexOf('Haptics.notificationAsync', guard)).toBeGreaterThan(guard);
    expect(summary).toContain('durableSuccess && onShare');
    expect(summary).toContain("finishState.kind === 'pending-finalization'");
    expect(summary).toContain("finishState.kind === 'recovery-required'");
    for (const retired of ['APPROVED_ASSETS.summaryFinish', 'SummaryFinishV1', 'AchievementCoreSetV1', 'FinishCelebration', 'ParticleSystem']) expect(summary).not.toContain(retired);
    expect(summary).toContain('ride-summary-${finishState.kind}');
    // Rendered tests separately verify no haptic/share for non-durable states.
  });
  test('relaunch recovery cannot drop pending finalization truth', () => {
    const lifecycle = source('bootstrap/useRideLifecycle.ts');
    const gps = source('services/GpsSyncManager.ts');
    expect(gps).toContain('pendingFinalization: boolean;');
    expect(gps).toContain('pendingFinalization,');
    expect(lifecycle).toContain('result.pendingFinalization');
    expect(lifecycle).toContain('classifyRideRecoveryAfterLaunch(');
  });
  test('navigation routes terminal truth instead of a non-null summary payload', () => {
    const navigation = source('bootstrap/NavigationShell.tsx');
    expect(navigation).toContain("navigate('RideSummary', rideFinishState)");
    expect(navigation).not.toContain("navigate('RideSummary', rideSummary)");
  });
});
