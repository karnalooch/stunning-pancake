export type RideSummaryPayload = {
  distanceKm: number;
  elapsedS: number;
  elevationGainM: number;
};

export type RideFinishState =
  | {
      kind: 'durable-success';
      summary: RideSummaryPayload;
    }
  | {
      kind: 'pending-finalization';
      summary: RideSummaryPayload;
      pendingUpload: number;
    }
  | {
      kind: 'recovery-required';
      summary?: RideSummaryPayload;
      reason: string;
    };

export function classifyRideFinishState(
  summary: RideSummaryPayload | null,
  result: { finalized: boolean; pendingUpload: number } | null,
  errorReason?: string,
): RideFinishState | null {
  if (!summary) return null;
  if (errorReason) {
    return {
      kind: 'recovery-required',
      summary,
      reason: errorReason,
    };
  }
  if (!result || result.pendingUpload > 0 || !result.finalized) {
    return {
      kind: 'pending-finalization',
      summary,
      pendingUpload: result?.pendingUpload ?? 0,
    };
  }
  return {
    kind: 'durable-success',
    summary,
  };
}

export function isDurableRideSuccess(
  state: RideFinishState | null,
): state is Extract<RideFinishState, { kind: 'durable-success' }> {
  return state?.kind === 'durable-success';
}
