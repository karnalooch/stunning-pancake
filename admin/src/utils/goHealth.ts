export type ControlPlaneStatus = 'go' | 'warn' | 'no-go';

export interface ControlPlaneInput {
  apiLatencyMs?: number | null;
  unverifiedTotal?: number;
  simOn?: boolean;
  routingQueueDepth?: number;
  routingBackpressure?: boolean;
  maxRoutingQueueDepth?: number | null;
  synthetic?: boolean;
  federationFallback?: boolean;
  dataStale?: boolean;
}

export function computeControlPlaneStatus(input: ControlPlaneInput): ControlPlaneStatus {
  const {
    apiLatencyMs = null,
    simOn = false,
    routingBackpressure = false,
    routingQueueDepth = 0,
    maxRoutingQueueDepth = null,
    synthetic = false,
    federationFallback = false,
    dataStale = false,
  } = input;

  if (simOn && routingBackpressure) return 'no-go';
  if (synthetic || federationFallback || dataStale) return 'warn';
  // Slow dashboard stats (federation/cold cache) is degraded, not a full platform outage.
  if (apiLatencyMs != null && apiLatencyMs > 10_000) return 'no-go';
  if (simOn && apiLatencyMs != null && apiLatencyMs > 2500) return 'no-go';
  if (apiLatencyMs != null && apiLatencyMs > 2500) return 'warn';
  if (
    simOn
    && maxRoutingQueueDepth != null
    && routingQueueDepth > maxRoutingQueueDepth
  ) {
    return 'warn';
  }
  if (apiLatencyMs != null && apiLatencyMs > 800) return 'warn';
  return 'go';
}

export function controlPlaneLabel(status: ControlPlaneStatus): string {
  if (status === 'go') return 'GO';
  if (status === 'warn') return 'WARN';
  return 'NO-GO';
}
