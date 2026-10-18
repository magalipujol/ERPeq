import { expect, HOY_SERIE, test } from './google-falso'

test.beforeEach(async ({ page, ingresar }) => {
  await page.goto('/#precios')
  await ingresar()
})

test('muestra los precios vigentes y agrega uno nuevo', async ({ page, google }) => {
  const fila = (p: string) => page.getByRole('table', { name: 'Lista de precios' }).getByRole('row').filter({ has: page.getByRole('cell', { name: p, exact: true }) })
  await expect(fila('Almendras')).toContainText('3.000')
  await expect(fila('Miel')).toContainText('Sin precio')

  const form = page.getByRole('form', { name: 'Cambiar precio' })
  await form.getByLabel('Producto', { exact: true }).fill('Miel')
  await form.getByLabel('Precio', { exact: true }).fill('600')
  await form.getByRole('button', { name: 'Guardar precio' }).click()
  await expect(form.getByText(/✓ Miel: \$\s600 desde 16\/10\/26\./)).toBeVisible()
  expect(google.escrituras).toEqual([{ 'Precios': [['P003', 600, HOY_SERIE]] }])
  await expect(fila('Miel')).toContainText('600')
})

test('muestra las reglas de comisión vigentes y agrega una por producto', async ({ page, google }) => {
  const reglas = page.getByRole('table', { name: 'Reglas vigentes' })
  await expect(reglas.getByRole('row').filter({ hasText: 'Leo' })).toContainText(/Todos \(general\)\s*10/)
  await expect(reglas.getByRole('row').filter({ hasText: 'Almendras' })).toContainText(/Guada\/Hernán\s*Almendras\s*7/)

  const form = page.getByRole('form', { name: 'Nueva regla de comisión' })
  await form.getByLabel('Producto', { exact: true }).fill('Avena')
  await form.getByLabel('Comisión', { exact: true }).fill('12')
  await form.getByRole('button', { name: 'Guardar regla' }).click()
  await expect(form.getByText('✓ Leo: 12% en Avena.')).toBeVisible()
  expect(google.escrituras).toEqual([{ 'Reglas de comisión': [['VEN01', 'P002', 12, HOY_SERIE]] }])
})

test('el costo de envío arranca sin cobrarse y se puede dejar de cobrar con costo 0', async ({ page, google }) => {
  await expect(page.getByText('Hoy no se cobra envío.')).toBeVisible()
  const form = page.getByRole('form', { name: 'Cambiar costo de envío' })
  await form.getByLabel('Sin cargo desde', { exact: true }).fill('150000')
  await form.getByLabel('Costo del envío', { exact: true }).fill('5000')
  await form.getByRole('button', { name: 'Guardar envío' }).click()
  await expect(page.getByText(/Hoy: los pedidos por menos de \$\s150\.000 pagan \$\s5\.000 de envío/)).toBeVisible()

  await form.getByLabel('Sin cargo desde', { exact: true }).fill('0')
  await form.getByLabel('Costo del envío', { exact: true }).fill('0')
  await form.getByRole('button', { name: 'Guardar envío' }).click()
  await expect(form.getByText('✓ Desde 16/10/26 no se cobra envío.')).toBeVisible()
  await expect(page.getByText('Hoy no se cobra envío.')).toBeVisible()
  expect(google.escrituras).toEqual([{ 'Envíos': [[150000, 5000, HOY_SERIE]] }, { 'Envíos': [[0, 0, HOY_SERIE]] }])
})
