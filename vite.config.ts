import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Solo en el build: el servidor de desarrollo inyecta scripts inline que esta política bloquearía.
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com/gsi/client",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data:",
  "connect-src 'self' https://sheets.googleapis.com https://oauth2.googleapis.com https://accounts.google.com/gsi/",
  'frame-src https://accounts.google.com/gsi/',
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

const csp = (): Plugin => ({
  name: 'erpeq-csp',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
  ],
})

export default defineConfig({
  // Rutas relativas: la app se publica en /ERPeq/ en GitHub Pages y en / en local.
  base: './',
  plugins: [react(), csp()],
  server: { port: 5500, strictPort: true },
  preview: { port: 5500, strictPort: true },
})
