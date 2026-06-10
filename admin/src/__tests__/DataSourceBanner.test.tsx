// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { DataSourceBanner } from '../core/components/DataSourceBanner';

function renderBanner(props: React.ComponentProps<typeof DataSourceBanner>) {
  return render(
    <MantineProvider>
      <DataSourceBanner {...props} />
    </MantineProvider>,
  );
}

describe('DataSourceBanner', () => {
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

  it('renders nothing for production data', () => {
    renderBanner({ dataSource: 'production', synthetic: false });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('warns on sim-lab federation', () => {
    renderBanner({ dataSource: 'sim-lab', synthetic: true, simLabLabel: 'sim-lab' });
    expect(screen.getByText(/Synthetic KPIs/i)).toBeTruthy();
    expect(screen.getByText(/load testing only/i)).toBeTruthy();
  });

  it('warns on federation fallback', () => {
    renderBanner({ dataSource: 'production', federationFallback: true });
    expect(screen.getByText(/Production stats degraded/i)).toBeTruthy();
  });
});
