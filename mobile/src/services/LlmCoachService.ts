/**
 * LlmCoachService — SPORT Mobile App V3.0
 * ========================================
 * LLM-powered coaching message generator.
 * 
 * Replaces static text templates with dynamic, context-aware LLM prompts
 * while maintaining personality consistency across DRILL_SERGEANT,
 * MOTIVATOR, and ANALYST profiles.
 * 
 * Features:
 * - OpenAI-compatible API (configurable endpoint & model)
 * - Response cache (per-session, per-trigger-type)
 * - Circuit breaker (3 consecutive failures → 60s fallback)
 * - Rate limiting (max 1 call per 15s per trigger type)
 * - Timeout handling (5s) with 1 retry
 * - Graceful fallback — caller provides fallback message
 * - Polish language constraint in all prompts
 * 
 * Spring Parameters (V3.0 Standard):
 *   damping: 14, stiffness: 100
 */

import axios, { AxiosInstance } from 'axios';
import { firebaseCapture } from './FirebaseService';

// ─── Configuration ────────────────────────────────────────────────

const BACKEND_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
const PROXY_URL = BACKEND_URL ? `${BACKEND_URL}/api/llm/proxy` : '';

const DEFAULT_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? '',
  apiUrl: process.env.EXPO_PUBLIC_LLM_API_URL ?? 'https://api.openai.com/v1',
  model: process.env.EXPO_PUBLIC_LLM_MODEL ?? 'gpt-4o-mini',
  timeoutMs: 5_000,
  maxRetries: 1,
  maxTokens: 80,
  temperature: 0.9,
  cacheEnabled: true,
  circuitBreakerThreshold: 3,
  circuitBreakerCooldownMs: 60_000,
  rateLimitMs: 15_000,
};

export interface LlmCoachConfig {
  apiKey?: string;
  apiUrl?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
  maxTokens?: number;
  temperature?: number;
  cacheEnabled?: boolean;
  circuitBreakerThreshold?: number;
  circuitBreakerCooldownMs?: number;
  rateLimitMs?: number;
}

export type AvatarPersonality = 'DRILL_SERGEANT' | 'MOTIVATOR' | 'ANALYST';

export type TriggerCategory =
  | 'SESSION_START'
  | 'SESSION_END'
  | 'PACE_DROP'
  | 'LOW_BATTERY'
  | 'GPS_LOST'
  | 'HR_ZONE_UP'
  | 'HR_ZONE_DOWN'
  | 'PERSONAL_BEST'
  | 'FIRST_ACTIVITY';

export interface CoachPromptContext {
  personality: AvatarPersonality;
  category: TriggerCategory;
  variables: Record<string, string>;
}

// ─── Prompt Templates (Polish) ─────────────────────────────────────

const PERSONALITY_PROFILES: Record<AvatarPersonality, string> = {
  DRILL_SERGEANT:
    'Jesteś wojskowym trenerem (Drill Sergeant). Ton: bezpośredni, surowy, wymagający. ' +
    'Używaj słownictwa militarnego (misja, żołnierz, raport, taktyka). ' +
    'Nigdy nie okazuj słabości. Każdy komunikat to rozkaz.',
  MOTIVATOR:
    'Jesteś motywującym trenerem personalnym. Ton: wspierający, pozytywny, celebrujący. ' +
    'Używaj entuzjastycznego języka, emoji, wykrzykników. ' +
    'Każdy komunikat ma dodawać energii i wiary w siebie.',
  ANALYST:
    'Jesteś analitykiem wydajności sportowej. Ton: merytoryczny, precyzyjny, oparty na danych. ' +
    'Używaj terminologii technicznej (telemetria, VO2, kadencja, baseline). ' +
    'Każdy komunikat to suchy, rzeczowy raport z pomiarów.',
};

const CATEGORY_CONTEXTS: Record<TriggerCategory, string> = {
  SESSION_START:
    'Użytkownik właśnie rozpoczął trening. Zmotywuj go na start.',
  SESSION_END:
    'Użytkownik zakończył trening. Podsumuj sesję. Zmienna: {avgSpeed} — średnia prędkość w km/h.',
  PACE_DROP:
    'Tempo użytkownika spadło o {dropPct}% poniżej średniej sesji. Zmotywuj do przyspieszenia.',
  LOW_BATTERY:
    'Bateria urządzenia jest krytycznie niska: {pct}%. Szacowany pozostały czas pracy: {est} min. Ostrzeż użytkownika.',
  GPS_LOST:
    'Sygnał GPS został utracony. Dokładność: {acc} metrów. Poinformuj użytkownika.',
  HR_ZONE_UP:
    'Użytkownik wszedł w wyższą strefę tętna: Strefa {zone}, {hr} BPM. Skomentuj intensywność.',
  HR_ZONE_DOWN:
    'Użytkownik zszedł do niższej strefy tętna: Strefa {zone}, {hr} BPM. Skomentuj regenerację.',
  PERSONAL_BEST:
    'Użytkownik pobił swój rekord życiowy! Nowy dystans: {dist} km. Świętuj to osiągnięcie.',
  FIRST_ACTIVITY:
    'To pierwsza aktywność użytkownika dzisiaj. Zachęć go do działania.',
};

const LANGUAGE_CONSTRAINT =
  'Odpowiadaj ZAWSZE po polsku. NIGDY nie mieszaj języków. ' +
  'Maksymalna długość odpowiedzi: 150 znaków. Odpowiedz TYLKO gotowym komunikatem, bez cudzysłowów.';

// ─── Circuit Breaker ──────────────────────────────────────────────

interface CircuitState {
  failures: number;
  openUntil: number;
}

// ─── Rate Limiter ─────────────────────────────────────────────────

interface RateLimitEntry {
  lastCall: number;
}

// ─── Service ──────────────────────────────────────────────────────

export class LlmCoachService {
  private _config: Required<LlmCoachConfig>;
  private _client: AxiosInstance;
  private _cache: Map<string, string> = new Map();
  private _circuit: CircuitState = { failures: 0, openUntil: 0 };
  private _rateLimits: Map<string, RateLimitEntry> = new Map();
  private _useProxy: boolean;

  constructor(config?: LlmCoachConfig) {
    this._config = { ...DEFAULT_CONFIG, ...config } as Required<LlmCoachConfig>;

    // Use backend proxy when available (hides API key from mobile bundle)
    this._useProxy = !!PROXY_URL && !this._config.apiKey;

    const baseURL = this._useProxy ? BACKEND_URL : this._config.apiUrl;

    this._client = axios.create({
      baseURL,
      timeout: this._config.timeoutMs,
      headers: this._useProxy
        ? { 'Content-Type': 'application/json' }
        : {
            'Authorization': `Bearer ${this._config.apiKey}`,
            'Content-Type': 'application/json',
          },
    });
  }

  // ─── Public API ──────────────────────────

  /**
   * Generate a coaching message using LLM.
   * Falls back to null on failure — caller provides the fallback.
   *
   * @returns The generated message, or null if LLM is unavailable
   */
  async generateMessage(ctx: CoachPromptContext): Promise<string | null> {
    const startTs = Date.now();

    // Circuit breaker check
    if (this._isCircuitOpen()) {
      console.log('[LlmCoach] Circuit breaker OPEN — skipping LLM call');
      firebaseCapture(new Error('Circuit breaker open'), 'LLM_CIRCUIT_OPEN');
      return null;
    }

    // Rate limit check
    if (!this._checkRateLimit(ctx.category)) {
      console.log(`[LlmCoach] Rate limited: ${ctx.category}`);
      return null;
    }

    // Cache check
    const cacheKey = this._buildCacheKey(ctx);
    if (this._config.cacheEnabled) {
      const cached = this._cache.get(cacheKey);
      if (cached) {
        const latency = Date.now() - startTs;
        console.log(`[LlmCoach] Cache hit: ${ctx.category}`);
        if (latency > 10) {
          firebaseCapture(new Error(`Cache latency: ${latency}ms`), 'LLM_CACHE_HIT');
        }
        return cached;
      }
    }

    // LLM call with retry
    try {
      const message = await this._callLlm(ctx);
      const latency = Date.now() - startTs;

      // Cache the successful response
      if (this._config.cacheEnabled) {
        this._cache.set(cacheKey, message);
      }

      // Reset circuit on success
      this._circuit.failures = 0;

      // Monitor latency P95/P99 thresholds
      if (latency > 450) {
        firebaseCapture(
          new Error(`LLM latency P95 breach: ${latency}ms for ${ctx.personality}/${ctx.category}`),
          'LLM_LATENCY_HIGH',
        );
      } else if (latency > 1900) {
        firebaseCapture(
          new Error(`LLM latency P99 breach: ${latency}ms — approaching timeout`),
          'LLM_LATENCY_CRITICAL',
        );
      }

      return message;
    } catch (err: any) {
      const latency = Date.now() - startTs;
      console.warn(`[LlmCoach] LLM call failed after ${latency}ms: ${err.message}`);
      firebaseCapture(
        err instanceof Error ? err : new Error(String(err)),
        `LLM_CALL_FAILURE_${ctx.personality}_${ctx.category}`,
      );
      this._recordFailure();
      return null;
    }
  }

  /**
   * Clear the response cache (call at session start).
   */
  clearCache(): void {
    this._cache.clear();
  }

  /**
   * Reset circuit breaker (useful for testing or manual recovery).
   */
  resetCircuit(): void {
    this._circuit = { failures: 0, openUntil: 0 };
  }

  /**
   * Check if the service is healthy (circuit is closed, API key is set).
   */
  isHealthy(): boolean {
    return !this._isCircuitOpen() && this._config.apiKey.length > 0;
  }

  // ─── Private ─────────────────────────────

  private _isCircuitOpen(): boolean {
    if (this._circuit.failures >= this._config.circuitBreakerThreshold) {
      if (Date.now() < this._circuit.openUntil) {
        return true;
      }
      // Cooldown expired, reset
      this._circuit = { failures: 0, openUntil: 0 };
    }
    return false;
  }

  private _recordFailure(): void {
    this._circuit.failures++;
    if (this._circuit.failures >= this._config.circuitBreakerThreshold) {
      this._circuit.openUntil = Date.now() + this._config.circuitBreakerCooldownMs;
      console.warn(`[LlmCoach] Circuit breaker OPEN for ${this._config.circuitBreakerCooldownMs}ms`);
    }
  }

  private _checkRateLimit(category: string): boolean {
    const entry = this._rateLimits.get(category);
    const now = Date.now();
    if (entry && now - entry.lastCall < this._config.rateLimitMs) {
      return false;
    }
    this._rateLimits.set(category, { lastCall: now });
    return true;
  }

  private _buildCacheKey(ctx: CoachPromptContext): string {
    // Cache by personality + category + sorted variables
    const vars = Object.entries(ctx.variables)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    return `${ctx.personality}|${ctx.category}|${vars}`;
  }

  private async _callLlm(ctx: CoachPromptContext): Promise<string> {
    const personalityProfile = PERSONALITY_PROFILES[ctx.personality];
    const categoryContext = CATEGORY_CONTEXTS[ctx.category];
    
    // Interpolate variables into category context
    let interpolatedContext = categoryContext;
    for (const [key, value] of Object.entries(ctx.variables)) {
      interpolatedContext = interpolatedContext.replace(`{${key}}`, value);
    }

    const systemPrompt = [
      personalityProfile,
      LANGUAGE_CONSTRAINT,
    ].join('\n\n');

    const userPrompt = interpolatedContext;

    let lastError: Error | null = null;
    const maxAttempts = 1 + this._config.maxRetries;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        let response;

        if (this._useProxy) {
          // Route through backend proxy — API key stays server-side
          response = await this._client.post('/api/llm/proxy/', {
            model: this._config.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            max_tokens: this._config.maxTokens,
            temperature: this._config.temperature,
          });
        } else {
          // Direct API call (development with EXPO_PUBLIC_LLM_API_KEY)
          response = await this._client.post('/chat/completions', {
            model: this._config.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            max_tokens: this._config.maxTokens,
            temperature: this._config.temperature,
          });
        }

        const content = response.data?.choices?.[0]?.message?.content;
        if (!content || typeof content !== 'string') {
          throw new Error('Empty LLM response');
        }

        // Trim and clean the response
        let message = content.trim();
        // Remove surrounding quotes if present
        message = message.replace(/^["']|["']$/g, '');

        if (message.length === 0) {
          throw new Error('Empty LLM response after cleaning');
        }

        return message;
      } catch (err: any) {
        lastError = err;
        if (attempt < maxAttempts - 1) {
          // Wait briefly before retry
          await new Promise(r => setTimeout(r, 200));
        }
      }
    }

    throw lastError ?? new Error('LLM call failed without error');
  }

  /**
   * Destroy the service — clears all state. Call on app teardown.
   */
  destroy(): void {
    this._cache.clear();
    this._rateLimits.clear();
    this._circuit = { failures: 0, openUntil: 0 };
  }
}

// Singleton instance
export const llmCoach = new LlmCoachService();
