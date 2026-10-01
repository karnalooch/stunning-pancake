import fs from 'fs';
import path from 'path';
const source = (file: string) => fs.readFileSync(path.resolve(__dirname, '../../src', file), 'utf8');

describe('Roadbook truthful summary architecture', () => {
  test('summary uses shared semantic surfaces instead of celebration scaffolding', () => {
    const text = source('screens/RideSummaryScreen.tsx');
    for (const marker of ['RoadbookPage', 'RoadbookNotice', 'PrimaryButton', 'Metric']) expect(text).toContain(marker);
    for (const forbidden of ['FONTS.display', 'FONTS.mono', 'shadowOffset', 'shadowOpacity', 'ShareResultCard',
      'computeRideRank', 'estimateXpGain', 'APPROVED_ASSETS', 'SceneBackground']) expect(text).not.toContain(forbidden);
    const shared = source('components/roadbook/Surface.tsx'); expect(shared).toContain('getSemanticColors'); expect(shared).toContain('PRODUCT_TYPOGRAPHY');
  });
  test('kind, missing metrics and primary back action are explicit; rendering is behavior-tested', () => {
    const text = source('screens/RideSummaryScreen.tsx');
    for (const marker of ['isDurableRideSuccess', "finishState.kind === 'pending-finalization'", "finishState.kind === 'recovery-required'",
      'ride-summary-${finishState.kind}', 'summary?.distanceKm', 'ride-summary-unknown-metrics', 'ride-summary-back']) expect(text).toContain(marker);
  });
  test('share never guesses an activity from the latest history entry', () => {
    const shell = source('bootstrap/NavigationShell.tsx');
    expect(shell).toContain('buildSummaryShare(state, locale)');
    expect(shell).not.toContain('ActivityService.getHistory()'); expect(shell).not.toContain('shareData(latest.id)');
  });
});
