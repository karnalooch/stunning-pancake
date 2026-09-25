import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../src');

function source(relative: string): string {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

describe('ride finish truth architecture', () => {
  test('progression effects are gated by durable success outside finally cleanup', () => {
    const lifecycle = source('bootstrap/useRideLifecycle.ts');

    const finallyIndex = lifecycle.indexOf('} finally {');
    const classifyIndex = lifecycle.indexOf('classifyRideFinishState(');
    const durableIndex = lifecycle.indexOf('if (isDurableRideSuccess(finishState))');
    const progressIndex = lifecycle.indexOf('recordRideComplete(');
    const questIndex = lifecycle.indexOf('syncRideQuestProgress(');

    expect(finallyIndex).toBeGreaterThan(-1);
    expect(classifyIndex).toBeGreaterThan(finallyIndex);
    expect(durableIndex).toBeGreaterThan(classifyIndex);
    expect(progressIndex).toBeGreaterThan(durableIndex);
    expect(questIndex).toBeGreaterThan(durableIndex);
  });

  test('Summary celebration and success haptic are gated by durable truth', () => {
    const summary = source('screens/RideSummaryScreen.tsx');

    expect(summary).toContain('if (!durableSuccess) return;');
    expect(summary).toContain(
      '<ParticleSystem trigger={immersiveEnabled && durableSuccess} />',
    );
    expect(summary).toContain(
      '{durableSuccess ? <FinishCelebration /> : null}',
    );
    expect(summary).toContain('ride-summary-${finishState.kind}');
  });

  test('navigation routes terminal truth instead of a non-null summary payload', () => {
    const navigation = source('bootstrap/NavigationShell.tsx');

    expect(navigation).toContain("navigate('RideSummary', rideFinishState)");
    expect(navigation).not.toContain("navigate('RideSummary', rideSummary)");
  });
});
