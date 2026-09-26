import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../src');

function source(relative: string): string {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

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

  test('Summary celebration and success haptic are gated by durable truth', () => {
    const summary = source('screens/RideSummaryScreen.tsx');

    expect(summary).toContain('if (!durableSuccess) return;');

    const durableStart = summary.indexOf('{durableSuccess ? (');
    const fallbackStart = summary.indexOf(') : (', durableStart);
    const finishArt = summary.indexOf('APPROVED_ASSETS.summaryFinish', durableStart);

    expect(durableStart).toBeGreaterThan(-1);
    expect(fallbackStart).toBeGreaterThan(durableStart);
    expect(finishArt).toBeGreaterThan(durableStart);
    expect(finishArt).toBeLessThan(fallbackStart);
    expect(summary).not.toContain('SummaryFinishV1');
    expect(summary).not.toContain('AchievementCoreSetV1');
    expect(summary).not.toContain('FinishCelebration');
    expect(summary).not.toContain('ParticleSystem');
    expect(summary).toContain('ride-summary-${finishState.kind}');
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
