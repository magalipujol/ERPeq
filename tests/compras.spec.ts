import { expect, test } from './google-falso'

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

test('registra una compra con un producto nuevo y copia sus fórmulas de stock', async ({ page, google }) => {
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

  await expect(form.getByRole('group', { name: 'Total' })).toContainText('5.500')
  await expect(form.getByRole('group', { name: 'Productos nuevos' })).toContainText('1')

  await form.getByRole('button', { name: 'Registrar compra' }).click()
  await expect(form.getByText('✓ Compra a Prov C registrada (2 productos, 1 nuevo).')).toBeVisible()

  expect(google.escrituras).toEqual([
    { tipo: 'append', hoja: 'Productos', body: { values: [["'P004", "'Pasas", "'kg", '']] } },
    {
      tipo: 'batchUpdate',
      body: {
        requests: [{
          copyPaste: {
            source: { sheetId: 100, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 4, endColumnIndex: 6 },
            destination: { sheetId: 100, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 4, endColumnIndex: 6 },
            pasteType: 'PASTE_FORMULA',
          },
        }],
      },
    },
    {
      tipo: 'append', hoja: 'Compras', body: {
        values: [
          ['2026-10-16', "'General", "'Prov C", "'P004", "'Pasas", 5, 100, 500, "'R-9", ''],
          ['2026-10-16', "'General", "'Prov C", "'P002", "'Avena", 10, 500, 5000, "'R-9", ''],
        ],
      },
    },
  ])
  await expect(page.getByRole('row').filter({ hasText: 'Pasas' })).toContainText('Prov C')
})

test('no guarda una compra sin proveedor', async ({ page, google }) => {
  const form = page.getByRole('form', { name: 'Registrar compra' })
  await form.getByRole('button', { name: 'Registrar compra' }).click()
  await expect(form.getByText('Ingresá el proveedor.')).toBeVisible()
  expect(google.escrituras).toEqual([])
})
