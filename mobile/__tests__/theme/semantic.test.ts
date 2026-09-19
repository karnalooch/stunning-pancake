import { getSemanticColors } from '../../src/theme/semantic';
import { grandPrixTheme } from '../../src/theme/grandPrix';
import { grandPrixNightTheme } from '../../src/theme/grandPrixNight';

describe('Frozen UI v1.2 semantic colours', () => {
  test.each([
    ['day', grandPrixTheme],
    ['night', grandPrixNightTheme],
  ])('%s theme keeps action, selection and success semantics distinct', (_name, theme) => {
    const semantic = getSemanticColors(theme.colors);

    expect(semantic.action.primary).toBe(theme.colors.cta);
    expect(semantic.action.primaryPressed).toBe(theme.colors.ctaDark);
    expect(semantic.selection.border).toBe(theme.colors.goldAmber);
    expect(semantic.progress.primary).toBe(theme.colors.goldAmber);
    expect(semantic.status.success).toBe(theme.colors.primary);
    expect(semantic.ride.gpsLocked).toBe(theme.colors.primary);

    expect(semantic.action.primary).not.toBe(semantic.status.success);
    expect(semantic.selection.border).not.toBe(semantic.status.success);
    expect(semantic.navigation.active).not.toBe(semantic.status.success);
  });

  test('selected product surface ignores the legacy green selection token', () => {
    const semantic = getSemanticColors(grandPrixTheme.colors);

    expect(semantic.selection.background).toBe(grandPrixTheme.colors.surfaceContainerHigh);
    expect(semantic.selection.background).not.toBe(grandPrixTheme.colors.selection);
    expect(semantic.selection.border).not.toBe(grandPrixTheme.colors.selectionBorder);
  });
});
