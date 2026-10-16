import type { Page } from '@playwright/test'
import { expect, test } from './google-falso'

test.beforeEach(async ({ page, ingresar }) => {
  await page.goto('/#ventas')
  await ingresar()
})

const formVenta = (page: Page) =>
  page.getByRole('form', { name: 'Registrar venta' })

test('KPIs y detalle del mes', async ({ page }) => {
  const kpi = (label: string) => page.getByRole('group', { name: label })
  await expect(kpi('Vendido')).toContainText('12.000')
  await expect(kpi('Ganancia')).toContainText('6.000')
  await expect(kpi('Clientes distintos')).toContainText('1')
  await expect(page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Ana', exact: true }) })).toContainText('Almendras')
})

test('registra una venta con comisión y ganancia', async ({ page, google }) => {
  const form = formVenta(page)
  const cliente = form.getByLabel('Cliente', { exact: true })
  await cliente.fill('Ana')
  await cliente.blur()
  // Completa los datos de la última venta al cliente.
  await expect(form.getByLabel('Localidad', { exact: true })).toHaveValue('Funes')
  await expect(form.getByLabel('Carga', { exact: true })).toHaveValue('Leo')

  await form.getByLabel('Tipo de cliente', { exact: true }).selectOption('Revendedor')
  await expect(form.getByLabel('Comisión', { exact: true })).toHaveValue('10')

  await form.getByLabel('Producto', { exact: true }).fill('Almendras')
  // Toma el último precio de venta del producto.
  await expect(form.getByLabel('Precio unitario', { exact: true })).toHaveValue('3000')
  await form.getByLabel('Cantidad', { exact: true }).fill('2')
  await expect(form.getByText('Stock en General: 16 kg')).toBeVisible()

  const resumen = (label: string) => form.getByRole('group', { name: label })
  await expect(resumen('Importe')).toContainText('6.000')
  await expect(resumen('Comisión')).toContainText('600')
  await expect(resumen('Ganancia')).toContainText('2.400')

  await form.getByRole('button', { name: 'Registrar venta' }).click()
  await expect(form.getByText(/✓ Venta a Ana registrada \(1 producto, \$\s6\.000\)\./)).toBeVisible()
  expect(google.escrituras).toEqual([{
    tipo: 'append', hoja: 'Ventas',
    body: { values: [['2026-10-16', "'General", "'Ana", "'Revendedor", "'Funes", "'Santa Fe", "'P001", "'Almendras",
      2, 3000, 6000, 600, 1500, 2400, "'Leo", '']] },
  }])
  // El formulario queda listo para la próxima venta.
  await expect(cliente).toHaveValue('')
  await expect(form.getByLabel('Producto', { exact: true })).toHaveValue('')
})

test('avisa cuando la venta deja stock negativo', async ({ page }) => {
  const form = formVenta(page)
  await form.getByLabel('Producto', { exact: true }).fill('Avena')
  await form.getByLabel('Cantidad', { exact: true }).fill('5')
  await expect(form.getByText('Stock en General: 0 kg — queda negativo')).toBeVisible()
})

test('una línea sin precio suma 0 en el resumen y no deja guardar', async ({ page, google }) => {
  const form = formVenta(page)
  await form.getByLabel('Cliente', { exact: true }).fill('Bruno')
  await form.getByLabel('Producto', { exact: true }).fill('Miel')
  await form.getByLabel('Cantidad', { exact: true }).fill('3')
  await expect(form.getByRole('group', { name: 'Importe' })).toContainText(/\$\s0$/)
  await form.getByRole('button', { name: 'Registrar venta' }).click()
  await expect(form.getByText('Falta el precio de algún producto.')).toBeVisible()
  expect(google.escrituras).toEqual([])
})

test('no guarda una venta con productos inexistentes', async ({ page, google }) => {
  const form = formVenta(page)
  await form.getByLabel('Cliente', { exact: true }).fill('Bruno')
  await form.getByLabel('Producto', { exact: true }).fill('Turrón')
  await expect(form.getByText('No existe ese producto.')).toBeVisible()
  await form.getByRole('button', { name: 'Registrar venta' }).click()
  await expect(form.getByText('Hay productos que no existen en la lista.')).toBeVisible()
  expect(google.escrituras).toEqual([])
})

test('muestra el error de Google si no se pudo guardar', async ({ page, google }) => {
  const form = formVenta(page)
  await form.getByLabel('Cliente', { exact: true }).fill('Bruno')
  await form.getByLabel('Producto', { exact: true }).fill('Almendras')
  await form.getByLabel('Cantidad', { exact: true }).fill('1')
  google.fallarProxima(500)
  await form.getByRole('button', { name: 'Registrar venta' }).click()
  await expect(form.getByText('No se guardó: falla forzada 500')).toBeVisible()
  // Lo cargado no se pierde.
  await expect(form.getByLabel('Cliente', { exact: true })).toHaveValue('Bruno')
})
