// Genera los íconos PNG de la app instalable a partir de public/icono.svg, con el Chromium de Playwright.
// Uso: node herramientas/iconos.mjs
import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const svg = await readFile(new URL('../public/icono.svg', import.meta.url), 'utf8')
const TAMANIOS = { 'icono-192.png': 192, 'icono-512.png': 512, 'apple-touch-icon.png': 180 }

const navegador = await chromium.launch()
for (const [archivo, lado] of Object.entries(TAMANIOS)) {
  const pagina = await navegador.newPage({ viewport: { width: lado, height: lado } })
  await pagina.setContent(`<style>*{margin:0}svg{display:block;width:${lado}px;height:${lado}px}</style>${svg}`)
  await pagina.screenshot({ path: new URL(`../public/${archivo}`, import.meta.url).pathname, omitBackground: true })
  await pagina.close()
}
await navegador.close()
console.log(`Íconos generados en public/: ${Object.keys(TAMANIOS).join(', ')}`)
