import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@mantine/core/styles.css';
import './theme/globals.css';
import App from './App.tsx';
import { MantineProvider, createTheme } from '@mantine/core';

const theme = createTheme({
  /** Cyber-Monolith V3.0 Theme Overrides **/
  primaryColor: 'lime',
  colors: {
    lime: [
      '#f4ffcc', '#eaff99', '#dfff66', '#d4ff00', '#bee600',
      '#a3cc00', '#88aa00', '#6e8800', '#546600', '#3a4400'
    ],
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <App />
    </MantineProvider>
  </StrictMode>,
);
