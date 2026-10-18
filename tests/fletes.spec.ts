import type { Page } from '@playwright/test'
import { AHORA, esperarDatosStock, expect, HOY_SERIE, ir, serie, stockEn, test } from './google-falso'

test.beforeEach(async ({ page, ingresar }) => {
  await page.goto('/#fletes')
  await ingresar()
})

const formFlete = (page: Page) => page.getByRole('form', { name: 'Nuevo flete' })

test('marca un flete en camino como recibido y el stock entra en el destino', async ({ page, google }) => {
  await expect(page.getByRole('group', { name: 'En camino', exact: true })).toContainText('1')
  await expect(page.getByRole('group', { name: 'Mercadería en camino (a costo)' })).toContainText('9.000')
  await page.getByRole('button', { name: 'Recibido flete de Interprovincial · 08/10/26' }).click()
  await expect(page.getByText('✓ Flete de Interprovincial · 08/10/26: finalizado.')).toBeVisible()
  expect(google.escrituras).toEqual([{ 'Fletes estados': [['F0001', AHORA, 'finalizado']] }])

  await ir(page, 'Stock')
  await esperarDatosStock(page, stockEn(page, 'Rosario', 'Almendras'), { 'En depósito': '6', 'En camino': '–' })
})

test('registra una transferencia en camino con la salida y la llegada previstas', async ({ page, google }) => {
  const form = formFlete(page)
  await form.getByLabel('Transporte', { exact: true }).fill('Interprovincial')
  await form.getByLabel('Costo', { exact: true }).fill('10000')
  await form.getByLabel('Salida prevista', { exact: true }).fill('2026-10-17T09:00')
  await form.getByLabel('Llegada estimada', { exact: true }).fill('2026-10-18T18:00')
  await form.getByLabel('Producto', { exact: true }).fill('Almendras')
  await form.getByLabel('Cantidad', { exact: true }).fill('5')
  await expect(form.getByText('Stock en General: 10 kg')).toBeVisible()
  // El flete no se reparte entre pedidos: es gasto de logística.
  await expect(form.getByLabel('Pedidos que lleva')).toHaveCount(0)
  await form.getByRole('radiogroup', { name: 'Estado inicial' }).getByText('En camino').click()

  await form.getByRole('button', { name: 'Registrar flete' }).click()
  await expect(form.getByText('✓ Flete de Interprovincial registrado (en camino).')).toBeVisible()
  // Salida y llegada con fecha y hora: 9:00 es 0,375 de día y 18:00, 0,75.
  expect(google.escrituras).toEqual([{
    'Fletes': [['F0002', HOY_SERIE, 'C0004', 'BB', 'ROS', 10000, '', '', serie('2026-10-17') + 0.375, serie('2026-10-18') + 0.75]],
    'Fletes ítems': [['F0002', 'P001', 5]],
    'Fletes estados': [['F0002', AHORA, 'preparacion'], ['F0002', AHORA, 'camino']],
  }])
  await expect(page.getByRole('row', { name: 'Flete Interprovincial · 16/10/26' })).toContainText('Sale 17/10/26 09:00 · llega 18/10/26 18:00')
})

test('valida origen, destino y que la llegada no sea antes de la salida', async ({ page, google }) => {
  const form = formFlete(page)
  await form.getByLabel('Transporte', { exact: true }).fill('Expreso')
  await form.getByLabel('Destino', { exact: true }).selectOption({ label: 'General' })
  await form.getByRole('button', { name: 'Registrar flete' }).click()
  await expect(form.getByText('El origen y el destino tienen que ser distintos.')).toBeVisible()

  await form.getByLabel('Destino', { exact: true }).selectOption({ label: 'Rosario' })
  await form.getByLabel('Salida prevista', { exact: true }).fill('2026-10-18T09:00')
  await form.getByLabel('Llegada estimada', { exact: true }).fill('2026-10-17T09:00')
  await form.getByRole('button', { name: 'Registrar flete' }).click()
  await expect(form.getByText('La llegada estimada no puede ser antes de la salida.')).toBeVisible()
  expect(google.escrituras).toEqual([])
})
