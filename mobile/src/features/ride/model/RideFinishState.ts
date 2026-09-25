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
