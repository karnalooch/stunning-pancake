import { parseIngestAck } from '../../src/services/gpsIngestAck';

describe('parseIngestAck', () => {
  test('accepts a matching complete ACK', () => {
    expect(
      parseIngestAck(
        { client_batch_id: 'batch-1', acked: true, inserted: 2, dropped_privacy: 0 },
        2,
        'batch-1',
      ),
    ).toMatchObject({ acked: true, inserted: 2 });
  });

  test('rejects an ACK for another batch', () => {
    expect(
      parseIngestAck(
        { client_batch_id: 'other', acked: true, inserted: 2, dropped_privacy: 0 },
        2,
        'batch-1',
      ).acked,
    ).toBe(false);
  });

  test('rejects incomplete coverage', () => {
    expect(
      parseIngestAck(
        { client_batch_id: 'batch-1', acked: true, inserted: 1, dropped_privacy: 0 },
        2,
        'batch-1',
      ).acked,
    ).toBe(false);
  });

  test('accepts inserted plus privacy-dropped coverage', () => {
    expect(
      parseIngestAck(
        { client_batch_id: 'batch-1', acked: true, inserted: 1, dropped_privacy: 1 },
        2,
        'batch-1',
      ),
    ).toMatchObject({ acked: true, inserted: 1, droppedPrivacy: 1 });
  });

  test('accepts a durable duplicate ACK for the same batch', () => {
    expect(
      parseIngestAck(
        { client_batch_id: 'batch-1', acked: true, deduped: true, inserted: 0 },
        2,
        'batch-1',
      ),
    ).toMatchObject({ acked: true, deduped: true });
  });

  test('does not treat plain accepted status as an ACK', () => {
    expect(
      parseIngestAck(
        { client_batch_id: 'batch-1', status: 'accepted', inserted: 2 },
        2,
        'batch-1',
      ).acked,
    ).toBe(false);
  });
});
