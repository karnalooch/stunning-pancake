import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './core/App';

describe('Admin Dashboard Smoke Test', () => {
  it('renders the command center branding', () => {
    render(<App />);
    const titleElement = screen.getByText(/COMMAND CENTER/i);
    expect(titleElement).toBeDefined();
  });

  it('renders the premium stats grid', () => {
    render(<App />);
    const statsElement = screen.getByText(/Active Athletes/i);
    expect(statsElement).toBeDefined();
  });

  it('contains the interactive sidebar navigation', () => {
    render(<App />);
    expect(screen.getByText(/Live Telemetry/i)).toBeDefined();
    expect(screen.getByText(/Anti-Cheat Monitor/i)).toBeDefined();
  });
});
