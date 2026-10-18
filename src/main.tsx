import '@mantine/core/styles.css';
import '@mantine/charts/styles.css';
import './estilos.css';
import './celular.css';

import { MantineProvider } from '@mantine/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { CONFIG } from './config';
import { crearBaseSheets } from './db/sheets';
import { tema } from './tema';

// Raíz de composición: el único lugar de la UI que elige el adaptador de la base.
const db = crearBaseSheets(CONFIG);

const raiz = document.getElementById('root');
if (!raiz) throw new Error('Falta el elemento #root en index.html');

createRoot(raiz).render(
  <StrictMode>
    <MantineProvider theme={tema} forceColorScheme="light">
      <App db={db} />
    </MantineProvider>
  </StrictMode>,
);
