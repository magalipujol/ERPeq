import { devices, type Project } from '@playwright/test'

// Samsung Galaxy A53 con Chrome: 1080 × 2400 físicos a DPR 3 → 360 × 800 CSS. Es el celular de quienes usan la app,
// y 360 px es el ancho más angosto que hay que soportar (ver spec/legibilidad.md). El alto del viewport descuenta la
// barra de estado y la de direcciones de Chrome.
export const galaxyA53 = {
  userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  viewport: { width: 360, height: 720 },
  screen: { width: 360, height: 800 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
} satisfies Project['use']

export const escritorio = devices['Desktop Chrome']
