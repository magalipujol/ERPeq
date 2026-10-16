import { expect, test } from './google-falso'

test.beforeEach(async ({ page, ingresar }) => {
  await page.goto('/#ventas')
  await ingresar()
})

test('KPIs, comisiones y detalle del mes', async ({ page }) => {
  const kpi = (label: string) => page.getByRole('group', { name: label })
  await expect(kpi('Vendido')).toContainText('12.000')
  await expect(kpi('Comisiones')).toContainText('1.200')
  // 12.000 − 1.200 de comisión − 4 × 1.500 de costo.
  await expect(kpi('Ganancia (antes de fletes)')).toContainText('4.800')
  await expect(kpi('Fletes del mes')).toContainText('5.000')
  await expect(kpi('Clientes distintos')).toContainText('1')

  await expect(page.getByRole('table', { name: 'Comisiones por vendedor' }).getByRole('row').nth(1)).toContainText(/Leo.*1.*1\.200/)
  await expect(page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Ana', exact: true }) })).toContainText('Almendras')
})
