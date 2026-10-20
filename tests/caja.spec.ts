import { confirmarEntrega, expect, ir, test } from './google-falso'

test('ventas a cobrar y cuenta de cada socio al empezar', async ({ page, ingresar }) => {
  await page.goto('/#caja')
  await ingresar()

  // La venta del 05/10 a Ana (vendedor Leo, $ 12.000) no tiene cobros. Su comisión es de Leo, que es Sampatti: no entra en ninguna cuenta.
  await expect(page.getByRole('group', { name: 'A cobrar de clientes' })).toContainText('12.000')
  await expect(page.getByRole('table', { name: 'Ventas a cobrar' }).getByRole('row', { name: 'Venta a Ana · 05/10/26' })).toContainText('12.000')
  await expect(page.getByRole('region', { name: 'Cuenta de Guada/Hernán' })).toContainText('Guada/Hernán y Sampatti están al día.')
  await expect(page.getByText('Faltan hojas en la planilla')).toHaveCount(0)
})

test('no se puede cobrar más que el saldo de la venta', async ({ page, ingresar, google }) => {
  await page.goto('/#caja')
  await ingresar()
  const cobro = page.getByRole('form', { name: 'Registrar cobro' })
  await cobro.getByLabel('Importe', { exact: true }).fill('12001')
  await cobro.getByRole('button', { name: 'Registrar cobro' }).click()

  await expect(cobro.getByText(/No se puede cobrar más que el saldo/)).toBeVisible()
  expect(google.escrituras).toHaveLength(0)
})

test('si la planilla todavía no tiene las hojas de caja, la app funciona y avisa cuáles crear', async ({ page, ingresar, google }) => {
  for (const hoja of ['Socios', 'Cobros', 'Rendiciones']) Reflect.deleteProperty(google.hojas, hoja)
  await page.goto('/#caja')
  await ingresar()

  await expect(page.getByText('Faltan hojas en la planilla')).toBeVisible()
  await expect(page.getByText('fecha, venta_id, importe, medio, socio_id, nota')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Registrar cobro' })).toBeDisabled()

  // La entrega se registra igual, sin la parte del cobro.
  await ir(page, 'Pedidos')
  await page.getByRole('row', { name: 'Pedido Ana · 10/10/26' }).getByRole('button', { name: 'Entregar' }).click()
  const entrega = page.getByRole('form', { name: 'Registrar entrega' })
  await expect(entrega.getByLabel('Cobrado en la entrega')).toHaveCount(0)
  await entrega.getByRole('button', { name: 'Registrar entrega' }).click()
  await confirmarEntrega(page)
  await expect(page.getByText('El pedido de Ana · 10/10/26 quedó entregado.')).toBeVisible()
})

test('si la planilla todavía no tiene las hojas de envíos, Precios avisa cuáles crear y la entrega no cobra envío', async ({ page, ingresar, google }) => {
  for (const hoja of ['Envíos', 'Ventas envíos']) Reflect.deleteProperty(google.hojas, hoja)
  await page.goto('/#precios')
  await ingresar()

  await expect(page.getByText('venta_id, vendedor_id, costo_regla, costo')).toBeVisible()
  await expect(page.getByRole('form', { name: 'Cambiar costo de envío' })).toHaveCount(0)

  await ir(page, 'Pedidos')
  await page.getByRole('row', { name: 'Pedido Ana · 10/10/26' }).getByRole('button', { name: 'Entregar' }).click()
  const entrega = page.getByRole('form', { name: 'Registrar entrega' })
  await expect(entrega.getByLabel('Costo de envío', { exact: true })).toHaveCount(0)
  await entrega.getByRole('button', { name: 'Registrar entrega' }).click()
  await confirmarEntrega(page)
  await expect(page.getByText('El pedido de Ana · 10/10/26 quedó entregado.')).toBeVisible()
  expect(google.escrituras[0]).not.toHaveProperty('Ventas envíos')
})
