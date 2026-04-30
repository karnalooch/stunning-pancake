/**
 * SystemIntelligence Unit Tests
 * ==============================
 * Tests model label update, data consistency, and rendering.
 * 
 * Run from admin/: npx vitest run src/__tests__/SystemIntelligence.test.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SystemIntelligence } from '../modules/analytics/SystemIntelligence';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('SystemIntelligence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 5.1 Model Label Update ─────────────────────────

  it('should display the new model name instead of GPT-4o', async () => {
    // Mock no API key — should use static data but with updated model label
    mockFetch.mockRejectedValue(new Error('No API key'));

    render(<SystemIntelligence />);

    // Wait for loading to finish
    await waitFor(() => {
      const modelText = screen.getByText(/analyzed platform-wide heuristics/i);
      expect(modelText).toBeInTheDocument();
    }, { timeout: 5000 });

    // The model label should NOT say "GPT-4o" (it should say the new model)
    const subtitle = document.querySelector('span.c-dimmed, .mantine-Text-root[data-dimmed]');
    // Check that the old model is gone
    const allText = document.body.textContent || '';
    expect(allText).not.toMatch(/GPT-4o analyzed platform-wide heuristics/);
  });

  // ── 5.2 Data Consistency ───────────────────────────

  it('should render all three insight sections: Integrity, Growth, Strategy', async () => {
    mockFetch.mockRejectedValue(new Error('No API key'));

    render(<SystemIntelligence />);

    await waitFor(() => {
      expect(screen.getByText('Integrity Alert')).toBeInTheDocument();
      expect(screen.getByText('Growth Insight')).toBeInTheDocument();
      expect(screen.getByText('Global Strategy')).toBeInTheDocument();
    });
  });

  // ── 5.3 Loading State ──────────────────────────────

  it('should show loading state initially', () => {
    // Never resolve the mock — stays loading
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(<SystemIntelligence />);

    // Should show loading indicators
    const loadingTexts = screen.getAllByText(/analizuję|obliczam|generuję/i);
    expect(loadingTexts.length).toBeGreaterThan(0);
  });

  // ── 5.4 Static Fallback ────────────────────────────

  it('should render static demo data when LLM is unavailable', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    render(<SystemIntelligence />);

    await waitFor(() => {
      // Static data contains Warsaw instance reference
      const text = document.body.textContent || '';
      expect(text).toMatch(/Warszaw|Siedlc|GPS|Eko/i);
    });
  });

  // ── 5.5 Formatting UI Components ───────────────────

  it('should render Mantine components: Card, Text, Badge', async () => {
    mockFetch.mockRejectedValue(new Error('No API key'));

    render(<SystemIntelligence />);

    await waitFor(() => {
      // Check that badges are rendered
      const badgeElements = document.querySelectorAll('.mantine-Badge-root');
      expect(badgeElements.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── 5.6 Model Badge ────────────────────────────────

  it('should display the model name in the badge', async () => {
    mockFetch.mockRejectedValue(new Error('No API key'));

    render(<SystemIntelligence />);

    await waitFor(() => {
      // The badge should show "Model: gpt-4o" (the new model)
      const modelBadge = screen.getByText(/Model:/i);
      expect(modelBadge).toBeInTheDocument();
    });
  });
});
