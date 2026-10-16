import type { Page } from '@playwright/test'
import { expect, test } from './google-falso'

test.beforeEach(async ({ page, ingresar }) => {
  await page.goto('/#stock')
  await ingresar()
})

// Columnas: Producto, Unidad, General, Rosario, Total, Mínimo, Estado, Costo prom., Valor
const fila = (page: Page, producto: string) =>
  page.getByRole('row').filter({ has: page.getByRole('cell', { name: producto, exact: true }) })

test('calcula stock, costo promedio y estado por producto', async ({ page }) => {
  await expect(fila(page, 'Almendras').getByRole('cell')).toHaveText(
    ['Almendras', 'kg', '16', '0', '16', '–', 'OK', /1\.500/, /24\.000/])
  await expect(fila(page, 'Avena').getByRole('cell')).toHaveText(
    ['Avena', 'kg', '0', '25', '25', '50', 'Reponer', /500/, /12\.500/])
  await expect(fila(page, 'Miel').getByRole('cell').nth(6)).toHaveText('Sin stock')
})

test('KPIs de stock', async ({ page }) => {
  const kpi = (label: string) => page.getByRole('group', { name: label })
  await expect(kpi('Productos con stock')).toContainText('2')
  await expect(kpi('Bajo el mínimo')).toContainText('1')
  await expect(kpi('Stock negativo')).toContainText('0')
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

  await page.getByRole('button', { name: 'Total' }).click()
  await expect(filas.nth(1)).toContainText('Miel')
  await page.getByRole('button', { name: 'Total' }).click()
  await expect(filas.nth(1)).toContainText('Avena')
})

test('registra un ajuste de stock', async ({ page, google }) => {
  const form = page.getByRole('form', { name: 'Ajuste de stock' })
  await form.getByLabel('Producto', { exact: true }).fill('Almendras')
  await form.getByLabel('Cantidad', { exact: true }).fill('-2')
  await expect(form.getByText(/Stock en General: 16 → 14 kg/)).toBeVisible()
  await form.getByLabel('Motivo', { exact: true }).fill('conteo')
  await form.getByRole('button', { name: 'Registrar ajuste' }).click()

  await expect(form.getByText('✓ Ajuste registrado: -2 kg de Almendras.')).toBeVisible()
  expect(google.escrituras).toEqual([{
    tipo: 'append', hoja: 'Ajustes',
    body: { values: [['2026-10-16', "'General", "'P001", "'Almendras", -2, "'conteo"]] },
  }])
  await expect(fila(page, 'Almendras').getByRole('cell').nth(2)).toHaveText('14')
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
