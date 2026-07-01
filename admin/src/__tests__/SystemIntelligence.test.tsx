// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { SystemIntelligence } from '../modules/analytics/SystemIntelligence';
import { renderWithMantine } from '../test-utils/renderWithMantine';

const INSIGHTS = [
  { title: 'Platform Health', desc: '94.2% verification rate', type: 'positive', color: 'green' },
  { title: 'Growth Insight', desc: 'Siedlce tenant grew 23%', type: 'warning', color: 'orange' },
  { title: 'Integrity Alert', desc: '3 anomalies detected', type: 'alert', color: 'red' },
  { title: 'Global Strategy', desc: 'Department adoption at 67%', type: 'positive', color: 'blue' },
];

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

vi.mock('../api/client', () => ({
  apiClient: {
    get: mockGet,
  },
}));

describe('SystemIntelligence (RTL)', () => {
  beforeEach(() => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/activities/ai/insights/') {
        return Promise.resolve({ data: INSIGHTS });
      }
      return Promise.resolve({ data: [] });
    });
  });

  it('shows skeleton loading state initially', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/activities/ai/insights/') {
        return new Promise(() => {});
      }
      return Promise.resolve({ data: [] });
    });

    renderWithMantine(<SystemIntelligence />);

    await waitFor(() => {
      expect(document.querySelectorAll('.mantine-Skeleton-root').length).toBe(3);
    });
  });

  it('renders all 4 insight cards after loading', async () => {
    renderWithMantine(<SystemIntelligence />);

    expect(await screen.findByText('Platform Health')).toBeInTheDocument();
    expect(screen.getByText('Growth Insight')).toBeInTheDocument();
    expect(screen.getByText('Integrity Alert')).toBeInTheDocument();
    expect(screen.getByText('Global Strategy')).toBeInTheDocument();
  });

  it('renders insight descriptions', async () => {
    renderWithMantine(<SystemIntelligence />);

    expect(await screen.findByText(/94\.2% verification rate/)).toBeInTheDocument();
    expect(screen.getByText(/Siedlce tenant grew 23%/)).toBeInTheDocument();
    expect(screen.getByText(/3 anomalies detected/)).toBeInTheDocument();
    expect(screen.getByText(/Department adoption at 67%/)).toBeInTheDocument();
  });

  it('renders correct insight types', async () => {
    renderWithMantine(<SystemIntelligence />);

    await screen.findByText('Platform Health');
    expect(screen.getAllByText('positive').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('warning')).toBeInTheDocument();
    expect(screen.getByText('alert')).toBeInTheDocument();
  });

  it('stops showing skeletons after loading', async () => {
    renderWithMantine(<SystemIntelligence />);

    await waitFor(() => {
      expect(document.querySelectorAll('.mantine-Skeleton-root').length).toBe(3);
    });

    expect(await screen.findByText('Platform Health')).toBeInTheDocument();
    expect(document.querySelectorAll('.mantine-Skeleton-root').length).toBe(0);
  });
});
