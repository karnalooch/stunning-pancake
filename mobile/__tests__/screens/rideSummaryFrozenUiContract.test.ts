import fs from 'fs';
import path from 'path';

const SCREEN = path.resolve(
  __dirname,
  '../../src/screens/RideSummaryScreen.tsx',
);

function source(): string {
  return fs.readFileSync(SCREEN, 'utf8');
}

describe('Frozen UI v1.2 Ride Summary contract', () => {
  test('routine result data uses modern product primitives', () => {
    const text = source();

    expect(text).toContain(
      "import { Metric, PrimaryButton, ProductCard } from '../components/product';",
    );
    expect(text).toContain('testID="ride-summary-metrics"');
    expect(text).toContain('PRODUCT_TYPOGRAPHY.title');
    expect(text).toContain('PRODUCT_TYPOGRAPHY.body');
    expect(text).not.toContain('FONTS.display');
    expect(text).not.toContain("fontFamily: 'VT323'");
  });

  test('Grand Prix celebration stays behind durable success', () => {
    const text = source();

    expect(text).toContain('immersiveEnabled && durableSuccess ? (');
    expect(text).toContain('<SceneBackground sceneId="ride_summary"');
    expect(text).toContain(
      '<ParticleSystem trigger={immersiveEnabled && durableSuccess} />',
    );
    expect(text).toContain(
      '{durableSuccess ? <FinishCelebration /> : null}',
    );
    expect(text).toContain('testID="ride-summary-durable-success"');
    expect(text).toContain('<ShareResultCard');
    expect(text).toContain('testID="ride-summary-share"');
  });

  test('pending and recovery states keep truthful status surfaces', () => {
    const text = source();

    expect(text).toContain(
      "finishState.kind === 'pending-finalization'",
    );
    expect(text).toContain('t.rideMessages.stopPending');
    expect(text).toContain('t.rideMessages.stopPendingBody');
    expect(text).toContain('t.rideMessages.stopError');
    expect(text).toContain('t.rideMessages.stopErrorBody');
    expect(text).toContain('testID={`ride-summary-${finishState.kind}`}');
  });

  test('back-to-home remains available in every terminal state', () => {
    const text = source();

    expect(text).toContain('testID="ride-summary-back-home"');
    expect(text).toContain(
      "variant={durableSuccess ? 'secondary' : 'primary'}",
    );
    expect(text).toContain("edges={['top', 'bottom']}");
  });
});
