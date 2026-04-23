import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import React from 'react';

describe('Admin Dashboard Smoke Test', () => {
  it('renders the command center title', () => {
    render(<App />);
    const titleElement = screen.getByText(/SPORT COMMAND/i);
    expect(titleElement).toBeDefined();
  });

  it('renders the stats grid', () => {
    render(<App />);
    const statsElement = screen.getByText(/Active Users/i);
    expect(statsElement).toBeDefined();
  });

  it('contains the sidebar navigation', () => {
    render(<App />);
    expect(screen.getByText(/Live Telemetry/i)).toBeDefined();
    expect(screen.getByText(/Anti-Cheat Monitor/i)).toBeDefined();
  });
});
