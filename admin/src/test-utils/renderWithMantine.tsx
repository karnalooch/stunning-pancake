import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

export function renderWithMantine(ui: React.ReactElement, options?: RenderOptions) {
  return render(
    <MantineProvider defaultColorScheme="light" forceColorScheme="light">
      {ui}
    </MantineProvider>,
    options,
  );
}
