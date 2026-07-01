// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { DataSourceBanner } from '../core/components/DataSourceBanner';
import { renderWithMantine } from '../test-utils/renderWithMantine';

function renderBanner(props: React.ComponentProps<typeof DataSourceBanner>) {
  return renderWithMantine(<DataSourceBanner {...props} />);
}

describe('DataSourceBanner (RTL)', () => {
  it('renders nothing for production data', () => {
    renderBanner({ dataSource: 'production', synthetic: false });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('warns on sim-lab federation', () => {
    renderBanner({ dataSource: 'sim-lab', synthetic: true, simLabLabel: 'sim-lab' });
    expect(screen.getByText(/Synthetic KPIs/i)).toBeInTheDocument();
    expect(screen.getByText(/load testing only/i)).toBeInTheDocument();
  });

  it('warns on federation fallback', () => {
    renderBanner({ dataSource: 'production', federationFallback: true });
    expect(screen.getByText(/Production stats degraded/i)).toBeInTheDocument();
  });
});
