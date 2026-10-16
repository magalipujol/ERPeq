import { expect, HOY_SERIE, test } from './google-falso'

test.beforeEach(async ({ page, ingresar }) => {
  await page.goto('/#compras')
  await ingresar()
})

test('KPIs del mes', async ({ page }) => {
  const kpi = (label: string) => page.getByRole('group', { name: label })
  await expect(kpi('Comprado')).toContainText('25.000')
  await expect(kpi('Compras (líneas)')).toContainText('2')
  await expect(kpi('Proveedores')).toContainText('2')
})

test('registra una compra con un producto y un proveedor nuevos en una sola escritura', async ({ page, google }) => {
  const form = page.getByRole('form', { name: 'Registrar compra' })
  await form.getByLabel('Proveedor', { exact: true }).fill('Prov C')
  await form.getByLabel('Remito', { exact: true }).fill('R-9')

  await form.getByLabel('Producto', { exact: true }).fill('Pasas')
  await expect(form.getByText('Producto nuevo.')).toBeVisible()
  await form.getByLabel('Cantidad', { exact: true }).fill('5')
  await form.getByLabel('Precio unitario', { exact: true }).fill('100')

  await form.getByRole('button', { name: '+ Agregar producto' }).click()
  await form.getByLabel('Producto', { exact: true }).nth(1).fill('Avena')
  await form.getByLabel('Cantidad', { exact: true }).nth(1).fill('10')
  // Toma el último precio de compra del producto.
  await expect(form.getByLabel('Precio unitario', { exact: true }).nth(1)).toHaveValue('500')
  await expect(form.getByText('Stock en General: 0 → 10 kg')).toBeVisible()
  await form.getByLabel('Para el pedido', { exact: true }).selectOption({ label: 'PE0002 · Ana' })

  await expect(form.getByRole('group', { name: 'Total' })).toContainText('5.500')
  await expect(form.getByRole('group', { name: 'Productos nuevos' })).toContainText('1')

  await form.getByRole('button', { name: 'Registrar compra' }).click()
  await expect(form.getByText('✓ Compra a Prov C registrada (2 productos, 1 nuevo).')).toBeVisible()

  expect(google.escrituras).toEqual([{
    'Productos': [['P004', 'Pasas', 'kg', '']],
    'Contactos': [['C0005', 'proveedor', 'Prov C', '', '', '', '', '', '', '']],
    'Compras': [
      [HOY_SERIE, 'BB', 'Prov C', 'C0005', 'P004', 'Pasas', 5, 100, 500, 'R-9', 'PE0002', ''],
      [HOY_SERIE, 'BB', 'Prov C', 'C0005', 'P002', 'Avena', 10, 500, 5000, 'R-9', 'PE0002', ''],
    ],
  }])
  await expect(page.getByRole('row').filter({ hasText: 'Pasas' })).toContainText('Prov C')
})

test('un proveedor conocido no se vuelve a agregar a Contactos', async ({ page, google }) => {
  const form = page.getByRole('form', { name: 'Registrar compra' })
  await form.getByLabel('Proveedor', { exact: true }).fill('prov a')
  await form.getByLabel('Producto', { exact: true }).fill('Miel')
  await form.getByLabel('Cantidad', { exact: true }).fill('2')
  await form.getByRole('button', { name: 'Registrar compra' }).click()
  await expect(form.getByText(/✓ Compra a prov a registrada/)).toBeVisible()
  expect(Object.keys(google.escrituras[0])).toEqual(['Compras'])
  expect(google.escrituras[0].Compras[0][3]).toBe('C0002')
})

test('no guarda una compra sin proveedor', async ({ page, google }) => {
  const form = page.getByRole('form', { name: 'Registrar compra' })
  await form.getByRole('button', { name: 'Registrar compra' }).click()
  await expect(form.getByText('Ingresá el proveedor.')).toBeVisible()
  expect(google.escrituras).toEqual([])
})
