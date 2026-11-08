// Pantalla Análisis. A la planilla de google-falso.ts (Ana compra 4 kg de almendras el 05/10 con $1.200 de
// comisión, y un flete de $5.000 sin asignar el 08/10) se le suman dos clientes:
//   Bruno compraba 2 unid. de miel cada 30 días y su último pedido fue el 10/04/2026 (hace 189 días).
//   Carla compra 10 kg de avena por mes; el último pedido fue el 01/10/2026.
import type { Page } from '@playwright/test'
import { expect, type GoogleFalso, serie, test } from './google-falso'

function agregarClientes(hojas: GoogleFalso['hojas']) {
  hojas.Contactos.push(
    ['C0005', 'cliente', 'Bruno', 'Revendedor', '', '', '', 'Rosario', 'Santa Fe', ''],
    ['C0006', 'cliente', 'Carla', 'Minorista', '', '', '', 'Funes', 'Santa Fe', ''],
  )
  // Costo de la miel $600 y de la avena $500, para todo el año.
  hojas.Costos.push(['P003', 600, serie('2026-01-01')], ['P002', 500, serie('2026-01-01')])
  const compras: [string, string, string, number, number][] = [
    ['2026-01-10', 'C0005', 'P003', 2, 1000],
    ['2026-02-09', 'C0005', 'P003', 2, 1000],
    ['2026-03-11', 'C0005', 'P003', 2, 1000],
    ['2026-04-10', 'C0005', 'P003', 2, 1000],
    ['2026-08-01', 'C0006', 'P002', 10, 800],
    ['2026-09-01', 'C0006', 'P002', 10, 800],
    ['2026-10-01', 'C0006', 'P002', 10, 800],
  ]
  compras.forEach(([fecha, contacto, productoId, cantidad, precio], i) => {
    const pedido = `PE${String(i + 3).padStart(4, '0')}`
    const venta = `V${String(i + 2).padStart(4, '0')}`
    hojas.Pedidos.push([pedido, serie(fecha), contacto, 'ROS', ''])
    hojas['Pedidos ítems'].push([pedido, 1, productoId, cantidad, precio, precio])
    hojas.Ventas.push([venta, serie(fecha), pedido, 'ROS', ''])
    hojas['Ventas ítems'].push([venta, 1, 1, productoId, cantidad, precio, cantidad * precio])
  })
}

const kpi = (page: Page, nombre: string) => page.getByRole('group', { name: nombre, exact: true })
const tabla = (page: Page, nombre: string) => page.getByRole('table', { name: nombre })
const fila = (page: Page, tablaNombre: string, texto: string) =>
  tabla(page, tablaNombre).getByRole('row').filter({ has: page.getByRole('cell', { name: texto, exact: true }) })

test.beforeEach(async ({ page, google, ingresar }) => {
  agregarClientes(google.hojas)
  await page.goto('/#analisis')
  await ingresar()
})

test('el dueño ve qué productos y clientes rinden más y quién dejó de comprar', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Análisis', exact: true })).toBeVisible()
  const periodo = page.getByRole('radiogroup', { name: 'Período' })

  // Últimos 6 meses (desde el 16/04): Ana y Carla. Bruno compró antes.
  // Almendras: $12.000 − $1.200 − 4 × $1.500 = $4.800. Avena: $24.000 − 30 × $500 = $9.000.
  await expect(kpi(page, 'Vendido')).toContainText('36.000')
  await expect(kpi(page, 'Ganancia de productos')).toContainText('13.800')
  await expect(kpi(page, 'Margen')).toContainText('38,3')
  await expect(kpi(page, 'Fletes del período')).toContainText('5.000')
  await expect(kpi(page, 'Ganancia después de fletes')).toContainText('8.800')

  // Margen mensual, en meses enteros: desde el 01/04, así que entra la miel que Bruno compró el 10/04.
  // Octubre: ventas $12.000 (Ana) + $8.000 (Carla) = $20.000; costo 4 × $1.500 + 10 × $500 = $11.000; comisión $1.200;
  // flete $5.000 → margen $2.800 (14%). Compras de octubre: $10.000 de almendras + $15.000 de avena = $25.000.
  await expect(fila(page, 'Margen mensual', 'Octubre de 2026').getByRole('cell')).toHaveText(
    ['Octubre de 2026', /20\.000/, /0/, /11\.000/, /1\.200/, /0/, /5\.000/, /2\.800/, '14%', /25\.000/])
  // Septiembre: $8.000 de avena − $5.000 de costo = $3.000, con $20.000 de compras de almendras.
  await expect(fila(page, 'Margen mensual', 'Septiembre de 2026').getByRole('cell').nth(7)).toContainText('3.000')
  // Abril: 2 unid. de miel × $1.000 − 2 × $600 = $800. Total: 800 + 3.000 (agosto) + 3.000 + 2.800 = $9.600.
  await expect(fila(page, 'Margen mensual', 'Abril de 2026').getByRole('cell').nth(7)).toContainText('800')
  const total = fila(page, 'Margen mensual', 'Total').getByRole('cell')
  await expect(total.nth(7)).toContainText('9.600')
  await expect(total.nth(9)).toContainText('45.000')

  await expect(fila(page, 'Ganancia por producto', 'Avena').getByRole('cell')).toHaveText(
    ['Avena', '30 kg', /24\.000/, /0/, /15\.000/, /9\.000/, /37,5/])
  await expect(fila(page, 'Ganancia por producto', 'Almendras').getByRole('cell').nth(5)).toContainText('4.800')
  await expect(fila(page, 'Ganancia por producto', 'Miel')).toHaveCount(0)
  await expect(page.getByText('Más vendido por cantidad: Avena (30 kg)')).toBeVisible()

  // Clientes más activos: Carla hizo 3 pedidos; Ana, 2 (uno sin entregar).
  const activos = tabla(page, 'Clientes más activos').getByRole('row')
  await expect(activos.nth(1)).toContainText('Carla')
  await expect(activos.nth(1).getByRole('cell').nth(1)).toHaveText('3')
  await expect(activos.nth(2)).toContainText('Ana')
  await expect(activos.nth(2).getByRole('cell').nth(1)).toHaveText('2')

  // Bruno compraba cada 30 días y hace 189 que no compra. Carla compra seguido; Ana solo tiene 2 pedidos.
  const inactivos = tabla(page, 'Clientes que dejaron de comprar')
  await expect(fila(page, 'Clientes que dejaron de comprar', 'Bruno').getByRole('cell')).toHaveText(
    ['Bruno', '4', '30 días', '10/04/26', '189 días', /8\.000/])
  await expect(inactivos.getByRole('row')).toHaveCount(2)

  // Con toda la historia aparece la miel de Bruno, que se cuenta en unidades y no se mezcla con los kg.
  await periodo.getByText('Todo', { exact: true }).click()
  await expect(kpi(page, 'Vendido')).toContainText('44.000')
  await expect(fila(page, 'Ganancia por producto', 'Miel').getByRole('cell').nth(1)).toHaveText('8 unid.')
  await expect(page.getByText('Más vendido por cantidad: Avena (30 kg) · Miel (8 unid.)')).toBeVisible()
  await expect(fila(page, 'Clientes más activos', 'Bruno').getByRole('cell').nth(1)).toHaveText('4')

  // En los últimos 3 meses (desde el 16/07) Carla sigue y Bruno no aparece entre los activos.
  await periodo.getByText('3 meses', { exact: true }).click()
  await expect(fila(page, 'Clientes más activos', 'Bruno')).toHaveCount(0)
  await expect(fila(page, 'Clientes más activos', 'Carla')).toHaveCount(1)
})
