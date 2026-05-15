/**
 * SystemIntelligence Unit Tests
 * ==============================
 * Tests current behavior of SystemIntelligence component:
 *   - Header (title + AI badge) is rendered
 *   - Loading state shows Loader and "Analyzing platform data..."
 *   - Successful API response: insights from parsed JSON array are rendered
 *   - Successful API response: when content is non-JSON, raw content is rendered as a single insight
 *   - Failed fetch: static fallback insights are rendered
 *
 * Run from admin/: npx vitest run src/__tests__/SystemIntelligence.test.tsx
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { SystemIntelligence } from '../modules/analytics/SystemIntelligence';

// Mock fetch globally
const mockFetch = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).fetch = mockFetch;

const renderWithProvider = (ui: React.ReactElement) =>
  render(<MantineProvider>{ui}</MantineProvider>);

describe('SystemIntelligence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom does not implement matchMedia; Mantine needs it.
    if (!window.matchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }),
      });
    }
  });

  afterEach(() => {
    cleanup();
  });

  it('renders header (title + AI badge)', async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({ choices: [{ message: { content: '[]' } }] }),
    });

    renderWithProvider(<SystemIntelligence />);

    expect(screen.getByText('System Intelligence')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    // Never resolve — stays loading
    mockFetch.mockImplementation(() => new Promise(() => {}));

    renderWithProvider(<SystemIntelligence />);

    expect(screen.getByText(/Analyzing platform data\.\.\./i)).toBeInTheDocument();
  });

  it('renders insights from a JSON array response', async () => {
    const insights = [
      'Integrity: pipeline OK',
      'Growth: tenants up 12%',
      'Strategy: ship beta',
    ];
    mockFetch.mockResolvedValue({
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(insights) } }],
      }),
    });

    renderWithProvider(<SystemIntelligence />);

    for (const text of insights) {
      // eslint-disable-next-line no-await-in-loop
      await waitFor(() => {
        expect(screen.getByText(text)).toBeInTheDocument();
      });
    }

    // Loading text gone
    expect(screen.queryByText(/Analyzing platform data\.\.\./i)).not.toBeInTheDocument();
  });

  it('renders raw content as a single insight when response is not JSON', async () => {
    const raw = 'Plain non-JSON answer from the model.';
    mockFetch.mockResolvedValue({
      json: async () => ({ choices: [{ message: { content: raw } }] }),
    });

    renderWithProvider(<SystemIntelligence />);

    await waitFor(() => {
      expect(screen.getByText(raw)).toBeInTheDocument();
    });
  });

  it('renders static fallback insights when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    renderWithProvider(<SystemIntelligence />);

    await waitFor(() => {
      expect(screen.getByText(/^Integrity:/)).toBeInTheDocument();
    });
    expect(screen.getByText(/^Growth:/)).toBeInTheDocument();
    expect(screen.getByText(/^Strategy:/)).toBeInTheDocument();
  });

  it('calls fetch with the LLM proxy endpoint and POST method', async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({ choices: [{ message: { content: '[]' } }] }),
    });

    renderWithProvider(<SystemIntelligence />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/llm\/proxy\/?$/);
    expect(init).toMatchObject({ method: 'POST' });
  });
});
