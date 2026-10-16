import '@mantine/core/styles.css';
import '@mantine/charts/styles.css';
import './estilos.css';

import { MantineProvider } from '@mantine/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { tema } from './tema';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={tema} defaultColorScheme="auto">
      <App />
    </MantineProvider>
  </StrictMode>,
);
