/**
 * LlmCoachService Unit Tests
 * ===========================
 * Tests the LLM coaching service: caching, circuit breaker,
 * rate limiting, timeout handling, and fallback behavior.
 * 
 * Run: npm test -- __tests__/services/LlmCoachService.test.ts
 */

import { LlmCoachService, CoachPromptContext } from '../../src/services/LlmCoachService';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('LlmCoachService', () => {
  let service: LlmCoachService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LlmCoachService({
      apiKey: 'test-key',
      apiUrl: 'https://test.openai.com/v1',
      model: 'gpt-4o-mini',
      timeoutMs: 5000,
      maxRetries: 1,
      maxTokens: 80,
      temperature: 0.9,
      cacheEnabled: true,
      circuitBreakerThreshold: 3,
      circuitBreakerCooldownMs: 60000,
      rateLimitMs: 15000,
    });
  });

  afterEach(() => {
    service.destroy();
  });

  // ── 1. Basic LLM call ───────────────────────────────

  test('should generate a message via LLM', async () => {
    const mockResponse = {
      data: {
        choices: [{ message: { content: 'Ruszaj, żołnierzu! Czas na trening.' } }],
      },
    };
    mockedAxios.create.mockReturnValue({
      post: jest.fn().mockResolvedValue(mockResponse),
      interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    } as any);

    service = new LlmCoachService({ apiKey: 'test-key' });
    const postMock = (service as any)._client.post as jest.Mock;
    postMock.mockResolvedValue(mockResponse);

    const ctx: CoachPromptContext = {
      personality: 'DRILL_SERGEANT',
      category: 'SESSION_START',
      variables: {},
    };

    const message = await service.generateMessage(ctx);
    expect(message).toBe('Ruszaj, żołnierzu! Czas na trening.');
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock).toHaveBeenCalledWith(
      '/chat/completions',
      expect.objectContaining({
        model: 'gpt-4o-mini',
        max_tokens: 80,
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' }),
        ]),
      })
    );
  });

  // ── 2. Response cache ──────────────────────────────

  test('should cache and reuse responses', async () => {
    const mockResponse = {
      data: {
        choices: [{ message: { content: 'Cached message' } }],
      },
    };

    service = new LlmCoachService({ apiKey: 'test-key', cacheEnabled: true });
    const postMock = (service as any)._client.post as jest.Mock;
    postMock.mockResolvedValue(mockResponse);

    const ctx: CoachPromptContext = {
      personality: 'MOTIVATOR',
      category: 'PACE_DROP',
      variables: { dropPct: '25' },
    };

    const msg1 = await service.generateMessage(ctx);
    const msg2 = await service.generateMessage(ctx);

    expect(msg1).toBe('Cached message');
    expect(msg2).toBe('Cached message');
    // Should only call API once due to cache
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  // ── 3. Rate limiting ───────────────────────────────

  test('should rate-limit rapid calls to same category', async () => {
    const mockResponse = {
      data: {
        choices: [{ message: { content: 'Message' } }],
      },
    };

    service = new LlmCoachService({ apiKey: 'test-key', rateLimitMs: 15_000 });
    const postMock = (service as any)._client.post as jest.Mock;
    postMock.mockResolvedValue(mockResponse);

    const ctx: CoachPromptContext = {
      personality: 'ANALYST',
      category: 'LOW_BATTERY',
      variables: { pct: '18', est: '10' },
    };

    // First call — should succeed
    const msg1 = await service.generateMessage(ctx);
    expect(msg1).toBe('Message');

    // Second call immediately — should fail (rate limited)
    const msg2 = await service.generateMessage(ctx);
    expect(msg2).toBeNull();

    expect(postMock).toHaveBeenCalledTimes(1);
  });

  // ── 4. Circuit breaker ─────────────────────────────

  test('should open circuit breaker after consecutive failures', async () => {
    service = new LlmCoachService({
      apiKey: 'test-key',
      circuitBreakerThreshold: 2,
      circuitBreakerCooldownMs: 60_000,
    });
    const postMock = (service as any)._client.post as jest.Mock;
    postMock.mockRejectedValue(new Error('Network error'));

    const ctx: CoachPromptContext = {
      personality: 'MOTIVATOR',
      category: 'FIRST_ACTIVITY',
      variables: {},
    };

    // First failure
    const msg1 = await service.generateMessage(ctx);
    expect(msg1).toBeNull();

    // Second failure — circuit should now be open
    const msg2 = await service.generateMessage(ctx);
    expect(msg2).toBeNull();

    // Third call — circuit is open, should return null immediately
    const msg3 = await service.generateMessage(ctx);
    expect(msg3).toBeNull();

    // Should have only attempted 2 API calls (not 3, because 3rd was blocked by circuit)
    expect(postMock).toHaveBeenCalledTimes(2);
  });

  // ── 5. Timeout handling ────────────────────────────

  test('should handle timeout gracefully', async () => {
    service = new LlmCoachService({ apiKey: 'test-key', timeoutMs: 500, maxRetries: 0 });
    const postMock = (service as any)._client.post as jest.Mock;
    postMock.mockRejectedValue(new Error('timeout of 500ms exceeded'));

    const ctx: CoachPromptContext = {
      personality: 'ANALYST',
      category: 'SESSION_END',
      variables: { avgSpeed: '10.5' },
    };

    const msg = await service.generateMessage(ctx);
    expect(msg).toBeNull();
  });

  // ── 6. Polish language constraint ──────────────────

  test('should include Polish language constraint in prompt', async () => {
    const mockResponse = {
      data: {
        choices: [{ message: { content: 'Gotowe do akcji! Ruszamy!' } }],
      },
    };

    service = new LlmCoachService({ apiKey: 'test-key' });
    const postMock = (service as any)._client.post as jest.Mock;
    postMock.mockResolvedValue(mockResponse);

    const ctx: CoachPromptContext = {
      personality: 'MOTIVATOR',
      category: 'SESSION_START',
      variables: {},
    };

    await service.generateMessage(ctx);

    const systemMessage = postMock.mock.calls[0][1].messages.find(
      (m: any) => m.role === 'system'
    );
    expect(systemMessage.content).toMatch(/polsku/i);
    expect(systemMessage.content).toMatch(/NIGDY nie mieszaj/i);
  });

  // ── 7. Personality consistency ─────────────────────

  test.each([
    ['DRILL_SERGEANT', 'wojskowym', 'misja'],
    ['MOTIVATOR', 'motywującym', 'entuzjastycznego'],
    ['ANALYST', 'analitykiem', 'telemetria'],
  ])(
    'should include %s personality-specific tone keywords',
    async (personality, expectedKeyword1, expectedKeyword2) => {
      const mockResponse = {
        data: {
          choices: [{ message: { content: 'Test message' } }],
        },
      };

      service = new LlmCoachService({ apiKey: 'test-key' });
      const postMock = (service as any)._client.post as jest.Mock;
      postMock.mockResolvedValue(mockResponse);

      const ctx: CoachPromptContext = {
        personality: personality as any,
        category: 'PACE_DROP',
        variables: { dropPct: '30' },
      };

      await service.generateMessage(ctx);

      const systemMessage = postMock.mock.calls[0][1].messages.find(
        (m: any) => m.role === 'system'
      );
      expect(systemMessage.content).toMatch(new RegExp(expectedKeyword1, 'i'));
      expect(systemMessage.content).toMatch(new RegExp(expectedKeyword2, 'i'));
    }
  );

  // ── 8. All 9 trigger categories ────────────────────

  test.each([
    'SESSION_START',
    'SESSION_END',
    'PACE_DROP',
    'LOW_BATTERY',
    'GPS_LOST',
    'HR_ZONE_UP',
    'HR_ZONE_DOWN',
    'PERSONAL_BEST',
    'FIRST_ACTIVITY',
  ])('should handle category: %s', async (category) => {
    const mockResponse = {
      data: {
        choices: [{ message: { content: `Message for ${category}` } }],
      },
    };

    service = new LlmCoachService({ apiKey: 'test-key' });
    const postMock = (service as any)._client.post as jest.Mock;
    postMock.mockResolvedValue(mockResponse);

    const ctx: CoachPromptContext = {
      personality: 'MOTIVATOR',
      category: category as any,
      variables: { pct: '15', dropPct: '20', zone: '3', hr: '140', dist: '5.5', acc: '60', avgSpeed: '12', est: '9' },
    };

    const msg = await service.generateMessage(ctx);
    expect(msg).not.toBeNull();
    expect(typeof msg).toBe('string');
    expect(msg!.length).toBeGreaterThan(0);
  });

  // ── 9. Empty API key → healthy check ──────────────

  test('should report unhealthy when API key is empty', () => {
    const svc = new LlmCoachService({ apiKey: '' });
    expect(svc.isHealthy()).toBe(false);
    svc.destroy();
  });

  // ── 10. Clear cache on session start ───────────────

  test('should clear cache', async () => {
    const mockResponse = {
      data: {
        choices: [{ message: { content: 'Fresh message' } }],
      },
    };

    service = new LlmCoachService({ apiKey: 'test-key', cacheEnabled: true });
    const postMock = (service as any)._client.post as jest.Mock;
    postMock.mockResolvedValue(mockResponse);

    const ctx: CoachPromptContext = {
      personality: 'ANALYST',
      category: 'GPS_LOST',
      variables: { acc: '75' },
    };

    await service.generateMessage(ctx);
    service.clearCache();
    await service.generateMessage(ctx);

    // Should have called API twice (cache cleared between calls)
    expect(postMock).toHaveBeenCalledTimes(2);
  });
});
