import {
  createTheme, DEFAULT_THEME, defaultVariantColorsResolver, parseThemeColor, type MantineColorsTuple,
  type VariantColorsResolver,
} from '@mantine/core';

// Pautas de legibilidad para dislexia (guía de estilo de la British Dyslexia Association): sans serif clara,
// texto base de 17px, interlineado 1,5, sin mayúsculas sostenidas ni itálicas. Los números tabulares y los colores
// de texto están en `estilos.css`.
// OpenDyslexic viene en 400 y 700: los pesos 500 se ven como 400 y los 600, como 700.
const fuente = 'OpenDyslexic, Verdana, system-ui, sans-serif';

// Los tonos 8 y 9 de Mantine para rojo, verde, amarillo y naranja no llegan a 4,5:1 sobre el fondo crema:
// se oscurecen para que los textos de color y las etiquetas `light` (texto en el tono 9) se lean.
const oscurecer = (color: string, tono8: string, tono9: string): MantineColorsTuple => {
  const [t0, t1, t2, t3, t4, t5, t6, t7] = DEFAULT_THEME.colors[color];
  return [t0, t1, t2, t3, t4, t5, t6, t7, tono8, tono9];
};

// Polaridad positiva: la variante `filled` (botones y etiquetas) usa un fondo claro del color, con borde más
// oscuro, y el texto normal de la app en lugar de blanco.
const variantes: VariantColorsResolver = (entrada) => {
  const base = defaultVariantColorsResolver(entrada);
  const color = parseThemeColor({ color: entrada.color, theme: entrada.theme });
  if (entrada.variant !== 'filled' || !color.isThemeColor) return base;
  return {
    background: `var(--mantine-color-${color.color}-2)`,
    hover: `var(--mantine-color-${color.color}-3)`,
    color: 'var(--mantine-color-text)',
    border: `1px solid var(--mantine-color-${color.color}-6)`,
  };
};

export const tema = createTheme({
  primaryColor: 'salvia',
  primaryShade: 6,
  variantColorResolver: variantes,
  colors: {
    red: oscurecer('red', '#b42323', '#8f1d1d'),
    green: oscurecer('green', '#256f33', '#1d5628'),
    yellow: oscurecer('yellow', '#a35f00', '#7a4700'),
    orange: oscurecer('orange', '#b33c0a', '#8a2e08'),
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
    // Sin `color` ni `variant`, Mantine pinta estos componentes con sus variables propias y no pasa por `variantes`.
    Button: { defaultProps: { color: 'salvia' } },
    ActionIcon: { defaultProps: { color: 'salvia' } },
    ThemeIcon: { defaultProps: { color: 'salvia' } },
    Paper: { defaultProps: { withBorder: true, radius: 'lg', p: 'md' } },
    Autocomplete: { defaultProps: { limit: 30 } },
    NumberInput: { defaultProps: { hideControls: true } },
    // Mantine muestra los Badge en mayúsculas; en minúsculas se leen por la forma de la palabra.
    Badge: { defaultProps: { color: 'salvia' }, styles: { label: { textTransform: 'none', letterSpacing: 'inherit', fontWeight: 600 } } },
  },
});
