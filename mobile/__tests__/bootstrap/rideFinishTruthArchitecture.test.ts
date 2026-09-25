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
