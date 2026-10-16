import type { Page } from '@playwright/test'
import { expect, HOY_SERIE, test } from './google-falso'

test.beforeEach(async ({ page, ingresar }) => {
  await page.goto('/#stock')
  await ingresar()
})

// Columnas: Producto, Unidad, General, Rosario, En camino, Total, Comprometido, Mínimo, Estado, Costo prom., Valor
const fila = (page: Page, producto: string) =>
  page.getByRole('row').filter({ has: page.getByRole('cell', { name: producto, exact: true }) })

test('calcula stock por depósito, en camino, comprometido y estado', async ({ page }) => {
  // Almendras: 20 compradas − 4 vendidas − 6 en un flete en camino a Rosario.
  await expect(fila(page, 'Almendras').getByRole('cell')).toHaveText(
    ['Almendras', 'kg', '10', '0', '6', '16', '–', '–', 'OK', /1\.500/, /24\.000/])
  // Avena: 30 en Rosario − 5 de rotura; 10 pedidos sin entregar.
  await expect(fila(page, 'Avena').getByRole('cell')).toHaveText(
    ['Avena', 'kg', '0', '25', '–', '25', '10', '50', 'Reponer', /500/, /12\.500/])
  await expect(fila(page, 'Miel').getByRole('cell').nth(8)).toHaveText('Sin stock')
})

test('KPIs de stock', async ({ page }) => {
  const kpi = (label: string) => page.getByRole('group', { name: label })
  await expect(kpi('Productos con stock')).toContainText('2')
  await expect(kpi('Bajo el mínimo')).toContainText('1')
  await expect(kpi('Stock negativo')).toContainText('0')
  await expect(kpi('Faltan para pedidos')).toContainText('0')
  await expect(kpi('Valor del stock (a costo)')).toContainText('36.500')
})

test('busca, filtra y ordena el inventario', async ({ page }) => {
  const filas = page.getByRole('table').first().getByRole('row')

  await page.getByRole('searchbox', { name: 'Buscar producto' }).fill('alm')
  await expect(filas).toHaveCount(2)
  await page.getByRole('searchbox', { name: 'Buscar producto' }).fill('')

  await page.getByRole('combobox', { name: 'Filtrar' }).selectOption({ label: 'Bajo el mínimo' })
  await expect(filas).toHaveCount(2)
  await expect(filas.nth(1)).toContainText('Avena')
  await page.getByRole('combobox', { name: 'Filtrar' }).selectOption({ label: 'Todos' })

  await page.getByRole('button', { name: 'Total', exact: true }).click()
  await expect(filas.nth(1)).toContainText('Miel')
  await page.getByRole('button', { name: 'Total', exact: true }).click()
  await expect(filas.nth(1)).toContainText('Avena')
})

test('registra un ajuste de stock', async ({ page, google }) => {
  const form = page.getByRole('form', { name: 'Ajuste de stock' })
  await form.getByLabel('Producto', { exact: true }).fill('Almendras')
  await form.getByLabel('Cantidad', { exact: true }).fill('-2')
  await expect(form.getByText(/Stock en General: 10 → 8 kg/)).toBeVisible()
  await form.getByLabel('Motivo', { exact: true }).fill('conteo')
  await form.getByRole('button', { name: 'Registrar ajuste' }).click()

  await expect(form.getByText('✓ Ajuste registrado: -2 kg de Almendras.')).toBeVisible()
  expect(google.escrituras).toEqual([{ 'Ajustes': [[HOY_SERIE, 'BB', 'P001', 'Almendras', -2, 'conteo']] }])
  await expect(fila(page, 'Almendras').getByRole('cell').nth(2)).toHaveText('8')
})

test('el ajuste valida los datos antes de guardar', async ({ page, google }) => {
  const form = page.getByRole('form', { name: 'Ajuste de stock' })
  await form.getByRole('button', { name: 'Registrar ajuste' }).click()
  await expect(form.getByText('Elegí un producto de la lista.')).toBeVisible()

  await form.getByLabel('Producto', { exact: true }).fill('Almendras')
  await form.getByRole('button', { name: 'Registrar ajuste' }).click()
  await expect(form.getByText('Ingresá una cantidad distinta de 0.')).toBeVisible()

  await form.getByLabel('Cantidad', { exact: true }).fill('3')
  await form.getByRole('button', { name: 'Registrar ajuste' }).click()
  await expect(form.getByText('Indicá el motivo.')).toBeVisible()
  expect(google.escrituras).toEqual([])
})
