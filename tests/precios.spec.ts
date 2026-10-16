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
  expect(google.escrituras).toEqual([{ 'Precios': [['P003', 'Miel', 600, HOY_SERIE]] }])
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
