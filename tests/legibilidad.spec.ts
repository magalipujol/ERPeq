import type { Page } from '@playwright/test'
import { galaxyA53 } from './dispositivos'
import { expect, ir, type Pantalla, test } from './google-falso'

// Una cifra cortada en dos renglones ("$ 1.234." arriba y "567" abajo) no se lee. Con OpenDyslexic, que es ancha,
// pasa con los importes de verdad en un celular de 360 px: esta prueba los agranda y recorre cada pantalla.

// Corre en los dos proyectos, siempre con la pantalla del celular.
test.use(galaxyA53)

// Cantidades ×10 y precios ×100 (importes ×1000), como en la dietética: ventas de millones de pesos.
const AGRANDAR: Record<string, Record<number, number>> = {
  'Precios': { 1: 100 },
  'Compras': { 4: 10, 5: 100, 6: 1000 },
  'Pedidos ítems': { 3: 10, 4: 100, 5: 100 },
  'Ventas ítems': { 4: 10, 5: 100, 6: 1000, 7: 100 },
  'Ventas comisiones': { 5: 1000 },
  'Fletes': { 5: 100 },
  'Fletes ítems': { 2: 10 },
  'Ajustes': { 3: 10 },
}

// Cifras ("$ 1.234.567", "-12,5", "7 %") cuyo texto ocupa más de un renglón.
const cifrasPartidas = async (page: Page) => page.evaluate(() => {
  const partidas: string[] = []
  const recorrido = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let nodo = recorrido.nextNode(); nodo; nodo = recorrido.nextNode()) {
    for (const m of (nodo.textContent ?? '').matchAll(/-?(\$\s)?\d[\d.,]*(\s?%)?/g)) {
      const rango = document.createRange()
      rango.setStart(nodo, m.index)
      rango.setEnd(nodo, m.index + m[0].length)
      const cajas = [...rango.getClientRects()].filter((c) => c.width > 0 && c.height > 0)
      if (cajas.length < 2) continue
      const arriba = Math.min(...cajas.map((c) => c.top))
      if (cajas.some((c) => c.top >= arriba + c.height / 2)) partidas.push(m[0])
    }
  }
  return partidas
})

// Cada pantalla y su dirección (`#stock`).
const PANTALLAS: [Pantalla, string][] = [
  ['Inicio', 'inicio'], ['Stock', 'stock'], ['Pedidos', 'pedidos'], ['Ventas', 'ventas'], ['Compras', 'compras'],
  ['Recetas', 'recetas'], ['Fletes', 'fletes'], ['Precios', 'precios'], ['Contactos', 'contactos'], ['Productos', 'productos'],
  ['Caja', 'caja'], ['Análisis', 'analisis'],
]

// Con CAPTURAS=1 guarda cómo se ve la pantalla en .tmp/capturas/, para revisarla a ojo.
const capturar = async (page: Page, pantalla: Pantalla) => {
  if (process.env.CAPTURAS !== undefined) await page.screenshot({ path: `.tmp/capturas/${pantalla}.png`, fullPage: true })
}

test('ninguna cifra queda partida en dos renglones', async ({ page, google, ingresar }) => {
  for (const [hoja, columnas] of Object.entries(AGRANDAR)) {
    for (const fila of google.hojas[hoja]) {
      for (const [c, factor] of Object.entries(columnas)) fila[Number(c)] = Number(fila[Number(c)]) * factor
    }
  }
  await page.goto('/')
  await ingresar()

  for (const [pantalla, direccion] of PANTALLAS) {
    await ir(page, pantalla)
    await expect(page).toHaveURL(new RegExp(`#${direccion}$`))
    await capturar(page, pantalla)
    expect.soft(await cifrasPartidas(page), pantalla).toEqual([])
  }
})
