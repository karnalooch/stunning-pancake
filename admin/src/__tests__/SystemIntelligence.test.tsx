/**
 * SystemIntelligence Unit Tests
 * ==============================
 * Component shows skeleton loading, then 4 simulated AI insight cards:
 *   Platform Health, Growth Insight, Integrity Alert, Global Strategy
 *
 * Run from admin/: npx vitest run src/__tests__/SystemIntelligence.test.tsx
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { SystemIntelligence } from '../modules/analytics/SystemIntelligence';

const renderWithProvider = (ui: React.ReactElement) =>
  render(<MantineProvider>{ui}</MantineProvider>);

describe('SystemIntelligence', () => {
  beforeEach(() => {
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

  it('shows skeleton loading state initially', () => {
    renderWithProvider(<SystemIntelligence />);

    const skeletons = document.querySelectorAll('.mantine-Skeleton-root');
    expect(skeletons.length).toBe(3);
  });

  it('renders all 4 insight cards after loading', async () => {
    renderWithProvider(<SystemIntelligence />);

    await waitFor(() => {
      expect(screen.getByText('Platform Health')).toBeInTheDocument();
    }, { timeout: 5000 });

    expect(screen.getByText('Growth Insight')).toBeInTheDocument();
    expect(screen.getByText('Integrity Alert')).toBeInTheDocument();
    expect(screen.getByText('Global Strategy')).toBeInTheDocument();
  });

  it('renders insight descriptions', async () => {
    renderWithProvider(<SystemIntelligence />);

    await waitFor(() => {
      expect(screen.getByText(/94\.2% verification rate/)).toBeInTheDocument();
    }, { timeout: 5000 });

    expect(screen.getByText(/Siedlce tenant grew 23%/)).toBeInTheDocument();
    expect(screen.getByText(/3 anomalies detected/)).toBeInTheDocument();
    expect(screen.getByText(/Department adoption at 67%/)).toBeInTheDocument();
  });

  it('renders correct insight types', async () => {
    renderWithProvider(<SystemIntelligence />);

    await waitFor(() => {
      expect(screen.getByText('Platform Health')).toBeInTheDocument();
    }, { timeout: 5000 });

    expect(screen.getAllByText('positive').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('warning')).toBeInTheDocument();
    expect(screen.getByText('alert')).toBeInTheDocument();
  });

  it('stops showing skeletons after loading', async () => {
    renderWithProvider(<SystemIntelligence />);

    expect(document.querySelectorAll('.mantine-Skeleton-root').length).toBe(3);

    await waitFor(() => {
      expect(screen.getByText('Platform Health')).toBeInTheDocument();
    }, { timeout: 5000 });

    expect(document.querySelectorAll('.mantine-Skeleton-root').length).toBe(0);
  });
});
