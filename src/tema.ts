import { createTheme } from '@mantine/core';

export const tema = createTheme({
  primaryColor: 'salvia',
  primaryShade: { light: 6, dark: 4 },
  autoContrast: true,
  colors: {
    salvia: ['#f0f6ec', '#e0ecd7', '#c2dab0', '#a3c787', '#8bbf6e', '#6f9c52', '#4f7a3a', '#436a31', '#375828', '#2a451e'],
  },
  fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  headings: { fontFamily: 'Fraunces, Georgia, serif', fontWeight: '600' },
  defaultRadius: 'md',
  components: {
    Paper: { defaultProps: { withBorder: true, radius: 'lg', p: 'md' } },
    Autocomplete: { defaultProps: { limit: 30 } },
    NumberInput: { defaultProps: { hideControls: true } },
  },
});
