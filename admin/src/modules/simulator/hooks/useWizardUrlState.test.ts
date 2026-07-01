import { describe, expect, it } from 'vitest';
import { parseSimulatorTab, parseWizardStep } from './useWizardUrlState';

describe('useWizardUrlState parsers', () => {
    it('parses tab and step from search params', () => {
        expect(parseSimulatorTab('garmin')).toBe('garmin');
        expect(parseWizardStep('2', 3)).toBe(2);
    });

    it('defaults to mass step 0', () => {
        expect(parseSimulatorTab(null)).toBe('mass');
        expect(parseWizardStep(null, 3)).toBe(0);
    });

    it('clamps step to max-1', () => {
        expect(parseWizardStep('99', 3)).toBe(2);
    });
});
