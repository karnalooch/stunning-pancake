import { describe, it, expect } from 'vitest';
import { severityColor, severityLabel } from '../utils/anomalySeverity';

describe('anomalySeverity', () => {
  it('maps critical', () => {
    expect(severityColor('critical')).toBe('red');
    expect(severityLabel('critical')).toBe('Critical');
  });

  it('maps high', () => {
    expect(severityColor('high')).toBe('orange');
    expect(severityLabel('high')).toBe('High');
  });

  it('defaults to medium', () => {
    expect(severityColor(undefined)).toBe('yellow');
    expect(severityLabel('medium')).toBe('Medium');
  });
});
