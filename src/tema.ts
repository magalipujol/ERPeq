import { createTheme } from '@mantine/core';

// Pautas de legibilidad para dislexia (guía de estilo de la British Dyslexia Association): sans serif clara,
// texto base de 17px, interlineado 1,5, sin mayúsculas sostenidas ni itálicas. Los números tabulares y los colores
// de texto están en `estilos.css`.
// OpenDyslexic viene en 400 y 700: los pesos 500 se ven como 400 y los 600, como 700.
const fuente = 'OpenDyslexic, Verdana, system-ui, sans-serif';

export const tema = createTheme({
  primaryColor: 'salvia',
  primaryShade: { light: 6, dark: 4 },
  autoContrast: true,
  colors: {
    salvia: ['#f0f6ec', '#e0ecd7', '#c2dab0', '#a3c787', '#8bbf6e', '#6f9c52', '#4f7a3a', '#436a31', '#375828', '#2a451e'],
  },
  fontFamily: fuente,
  fontFamilyMonospace: 'ui-monospace, monospace',
  fontSizes: { xs: '0.875rem', sm: '0.9375rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.3125rem' },
  lineHeights: { xs: '1.5', sm: '1.5', md: '1.55', lg: '1.55', xl: '1.6' },
  headings: {
    fontFamily: fuente,
    fontWeight: '700',
    sizes: {
      h1: { fontSize: '1.875rem', lineHeight: '1.3' },
      h2: { fontSize: '1.5rem', lineHeight: '1.35' },
      h3: { fontSize: '1.3125rem', lineHeight: '1.4' },
      h4: { fontSize: '1.1875rem', lineHeight: '1.4' },
    },
  },
  defaultRadius: 'md',
  components: {
    Paper: { defaultProps: { withBorder: true, radius: 'lg', p: 'md' } },
    Autocomplete: { defaultProps: { limit: 30 } },
    NumberInput: { defaultProps: { hideControls: true } },
    // Mantine muestra los Badge en mayúsculas; en minúsculas se leen por la forma de la palabra.
    Badge: { styles: { label: { textTransform: 'none', letterSpacing: 'inherit', fontWeight: 600 } } },
  },
});
