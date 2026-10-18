import { expect, test } from './google-falso'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

test.beforeEach(async ({ page, ingresar }) => {
  await page.goto('/#pedidos')
  await ingresar()
})

const ABIERTOS = [
  '*Pedidos abiertos* (16/10/26)',
  '1 pedido',
  '',
  '*Ana* · 10/10/26',
  'Funes, Santa Fe · desde Rosario',
  'Estado: Pendiente',
  'Vendedores: Guada/Hernán',
  '• 10 kg Avena',
].join('\n')

test('exporta los pedidos abiertos para WhatsApp: vista previa, copiar y enlace', async ({ page }) => {
  await page.getByRole('button', { name: 'Exportar a WhatsApp' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Exportar a WhatsApp' })
  const vista = dialogo.getByRole('document', { name: 'Vista previa del mensaje' })
  await expect(vista).toHaveText(ABIERTOS, { useInnerText: true })

  const enlace = dialogo.getByRole('link', { name: 'Abrir en WhatsApp' })
  await expect(enlace).toHaveAttribute('href', `https://wa.me/?text=${encodeURIComponent(ABIERTOS)}`)
  await expect(enlace).toHaveAttribute('target', '_blank')

  await dialogo.getByRole('button', { name: 'Copiar' }).click()
  await expect(dialogo.getByText('✓ Mensaje copiado. Pegalo en el grupo.')).toBeVisible()
  expect(await page.evaluate(async () => navigator.clipboard.readText())).toBe(ABIERTOS)
})

test('cambia el criterio: de hoy y últimos 7 días', async ({ page }) => {
  await page.getByRole('button', { name: 'Exportar a WhatsApp' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Exportar a WhatsApp' })
  const criterio = dialogo.getByRole('radiogroup', { name: 'Pedidos a exportar' })
  const vista = dialogo.getByRole('document', { name: 'Vista previa del mensaje' })

  await criterio.getByText('De hoy').click()
  await expect(vista).toHaveText('*Pedidos de hoy* (16/10/26)\nNo hay pedidos.', { useInnerText: true })
  await expect(dialogo.getByRole('button', { name: 'Copiar' })).toBeDisabled()
  await expect(dialogo.getByRole('link', { name: 'Abrir en WhatsApp' })).toBeHidden()

  // Ana tiene un pedido del 10/10 (entra) y otro del 05/10 (queda afuera).
  await criterio.getByText('Últimos 7 días').click()
  await expect(vista).toContainText('*Pedidos de los últimos 7 días* (16/10/26)')
  await expect(vista).toContainText('*Ana* · 10/10/26')
  await expect(vista).not.toContainText('05/10/26')
})
