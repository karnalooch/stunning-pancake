export interface IngestAckResult {
  acked: boolean;
  inserted: number;
  droppedPrivacy?: number;
  queued?: boolean;
  deduped?: boolean;
}

export function parseIngestAck(
  data: unknown,
  sentCount: number,
  expectedClientBatchId: string,
): IngestAckResult {
  const failed: IngestAckResult = { acked: false, inserted: 0 };
  if (!data || typeof data !== 'object') return failed;

  const body = data as Record<string, unknown>;
  if (body.client_batch_id !== expectedClientBatchId) return failed;

  if (body.deduped === true && body.acked === true) {
    return { acked: true, inserted: 0, deduped: true };
  }

  if (body.acked !== true) return failed;

  const inserted = typeof body.inserted === 'number' ? body.inserted : -1;
  const droppedPrivacy =
    typeof body.dropped_privacy === 'number' ? body.dropped_privacy : 0;
  if (inserted < 0 || droppedPrivacy < 0) return failed;
  if (inserted + droppedPrivacy !== sentCount) return failed;

  return {
    acked: true,
    inserted,
    droppedPrivacy,
    queued: body.queued === true,
  };
}
