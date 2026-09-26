import fs from 'fs';
import path from 'path';

const SCREEN = path.resolve(
  __dirname,
  '../../src/screens/RideSummaryScreen.tsx',
);

function source(): string {
  return fs.readFileSync(SCREEN, 'utf8');
}

describe('T81 Ride Summary Frozen UI v1.2 contract', () => {
  test('routine Summary chrome uses semantic product primitives', () => {
    const text = source();

    expect(text).toContain('PRODUCT_TYPOGRAPHY');
    expect(text).toContain('getSemanticColors');
    expect(text).toContain('ProductCard');
    expect(text).toContain('PrimaryButton');
    expect(text).toContain('Metric');

    expect(text).not.toContain('FONTS.display');
    expect(text).not.toContain('FONTS.mono');
    expect(text).not.toContain('shadowOffset');
    expect(text).not.toContain('shadowOpacity');
    expect(text).not.toContain('shadowRadius');
  });

  test('durable success exclusively owns production celebration art and share action', () => {
    const text = source();

    const durableStart = text.indexOf('{durableSuccess ? (');
    const fallbackStart = text.indexOf(') : (', durableStart);
    const art = text.indexOf('APPROVED_ASSETS.summaryFinish', durableStart);
    const share = text.indexOf('testID="ride-summary-share"', durableStart);

    expect(durableStart).toBeGreaterThan(-1);
    expect(fallbackStart).toBeGreaterThan(durableStart);
    expect(art).toBeGreaterThan(durableStart);
    expect(art).toBeLessThan(fallbackStart);
    expect(share).toBeGreaterThan(durableStart);
    expect(share).toBeLessThan(fallbackStart);
  });

  test('pending and recovery keep truthful metrics without success-only presentation', () => {
    const text = source();

    expect(text).toContain("finishState.kind === 'pending-finalization'");
    expect(text).toContain('ride-summary-${finishState.kind}');
    expect(text).toContain('t.rideMessages.stopPending');
    expect(text).toContain('t.rideMessages.stopError');
    expect(text).toContain('label={t.share.distance}');
    expect(text).toContain('label={t.share.time}');
    expect(text).toContain('label={t.share.elev}');
  });

  test('Back to Hub remains the primary exit action', () => {
    const text = source();

    const share = text.indexOf('testID="ride-summary-share"');
    const back = text.indexOf('testID="ride-summary-back-home"');

    expect(share).toBeGreaterThan(-1);
    expect(back).toBeGreaterThan(share);
    expect(text).toContain('label={t.summary.backToHub}');
  });
});
