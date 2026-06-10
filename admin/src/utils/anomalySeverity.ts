export type AnomalySeverity = 'critical' | 'high' | 'medium';

export function severityColor(severity?: string): string {
  if (severity === 'critical') return 'red';
  if (severity === 'high') return 'orange';
  return 'yellow';
}

export function severityLabel(severity?: string): string {
  if (severity === 'critical') return 'Critical';
  if (severity === 'high') return 'High';
  return 'Medium';
}
