import type { Page } from '@playwright/test'
import { AHORA, esperarDatosStock, expect, HOY_SERIE, ir, stockEn, test } from './google-falso'

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

test('registra una transferencia en camino con parte del costo asignada a un pedido', async ({ page, google }) => {
  const form = formFlete(page)
  await form.getByLabel('Transporte', { exact: true }).fill('Interprovincial')
  await form.getByLabel('Costo', { exact: true }).fill('10000')
  await form.getByLabel('Producto', { exact: true }).fill('Almendras')
  await form.getByLabel('Cantidad', { exact: true }).fill('5')
  await expect(form.getByText('Stock en General: 10 kg')).toBeVisible()

  await form.getByLabel('Pedidos que lleva', { exact: true }).click()
  await page.getByRole('option', { name: 'Ana · 10/10/26' }).click()
  const asignado = form.getByLabel('Costo asignado a Ana · 10/10/26')
  // Propone todo el costo al único pedido; se puede cambiar.
  await expect(asignado).toHaveValue('10000')
  await asignado.fill('4000')
  await expect(form.getByRole('group', { name: 'Gasto de logística' })).toContainText('6.000')
  await form.getByRole('radiogroup', { name: 'Estado inicial' }).getByText('En camino').click()

  await form.getByRole('button', { name: 'Registrar flete' }).click()
  await expect(form.getByText('✓ Flete de Interprovincial registrado (en camino).')).toBeVisible()
  expect(google.escrituras).toEqual([{
    'Fletes': [['F0002', HOY_SERIE, 'C0004', 'BB', 'ROS', 10000, '', '']],
    'Fletes ítems': [['F0002', 'P001', 5]],
    'Fletes estados': [['F0002', AHORA, 'preparacion'], ['F0002', AHORA, 'camino']],
    'Pedidos fletes': [['PE0002', 'F0002', 4000]],
  }])
})

test('valida origen, destino y costo asignado', async ({ page, google }) => {
  const form = formFlete(page)
  await form.getByLabel('Transporte', { exact: true }).fill('Expreso')
  await form.getByLabel('Destino', { exact: true }).selectOption({ label: 'General' })
  await form.getByRole('button', { name: 'Registrar flete' }).click()
  await expect(form.getByText('El origen y el destino tienen que ser distintos.')).toBeVisible()

  await form.getByLabel('Destino', { exact: true }).selectOption({ label: 'Rosario' })
  await form.getByLabel('Costo', { exact: true }).fill('100')
  await form.getByLabel('Pedidos que lleva', { exact: true }).click()
  await page.getByRole('option', { name: 'Ana · 10/10/26' }).click()
  await form.getByLabel('Costo asignado a Ana · 10/10/26').fill('200')
  await form.getByRole('button', { name: 'Registrar flete' }).click()
  await expect(form.getByText('Lo asignado a pedidos supera el costo del flete.')).toBeVisible()
  expect(google.escrituras).toEqual([])
})
